"""Offline tests for the single EHS Safety Agent: SQL guard, the two tools and the agent loop.

An in-memory sqlite database stands in for Neon and a fake LLM replaces DomoGPT, so nothing here
touches the live database or the network.
"""
import asyncio
import json
from datetime import date, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.agents import EhsSafetyAgent
from app.agents.tools import QueryRejected, inspect_schema, run_query
from app.agents.tools.sql_guard import scope_sql, validate_sql
from app.main import app
from app.models.ehs_event import EhsEvent
from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance


@pytest.fixture
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with eng.connect() as conn:
        conn.exec_driver_sql("ATTACH DATABASE ':memory:' AS ehs_core")
        conn.commit()
    for model in (EhsEvent, WorkforceAttendance, MaintenanceWorkOrder):
        model.__table__.create(bind=eng)
    session = sessionmaker(bind=eng, autoflush=False, autocommit=False)()

    def event(eid, plant, area, sev, status, due):
        return EhsEvent(
            ehs_event_id=eid, event_ts=datetime(2026, 10, 1), plant_id=plant, area=area, shift_id="A",
            event_type="HAZARD_OBSERVATION", hazard_category="FIRE", risk_severity=sev, lost_time_injury=False,
            action_owner="EMP-0001", due_date=date.fromisoformat(due), action_status=status, permit_id="PTW-1",
        )

    session.add_all([
        event("EHS-1", "IN-KA-01", "SMT", "CRITICAL", "OPEN", "2026-01-01"),
        event("EHS-2", "IN-KA-01", "SMT", "LOW", "CLOSED", "2026-01-01"),
        event("EHS-3", "IN-TN-01", "TEST", "HIGH", "IN_PROGRESS", "2026-02-01"),
    ])
    session.commit()
    yield session
    session.close()


# ----------------------------------------------------------------------------- SQL guard
@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM fact_ehs_event",
        "UPDATE fact_ehs_event SET area='X'",
        "DROP TABLE fact_ehs_event",
        "SELECT 1; SELECT 2",
        "SELECT * FROM users",
        "SELECT * FROM ehs_core.safety_alerts",
        "SELECT * FROM pg_catalog.pg_tables",
        "SELECT * FROM information_schema.tables",
        "SELECT pg_sleep(10)",
        "SELECT * INTO new_table FROM fact_ehs_event",
        "WITH RECURSIVE r AS (SELECT 1) SELECT * FROM r",
        "EXPLAIN SELECT * FROM fact_ehs_event",
        "",
    ],
)
def test_unsafe_sql_is_rejected(sql):
    with pytest.raises(QueryRejected):
        validate_sql(sql)


def test_safe_select_forms_are_accepted():
    validate_sql("SELECT area, COUNT(*) FROM fact_ehs_event GROUP BY area;")
    validate_sql("select * from ehs_core.fact_ehs_event e join fact_maintenance_work_order m on e.plant_id = m.plant_id")
    validate_sql("WITH x AS (SELECT * FROM fact_ehs_event) SELECT COUNT(*) FROM x")
    validate_sql("SELECT * FROM fact_ehs_event WHERE area = 'SET UP -- not a comment'")  # keyword inside a literal


def test_scope_sql_shadows_tables_with_plant_filter():
    sql = scope_sql("SELECT * FROM ehs_core.fact_ehs_event", "in-ka-01")
    assert "fact_ehs_event AS (SELECT * FROM ehs_core.fact_ehs_event WHERE plant_id = 'IN-KA-01')" in sql
    assert "WHERE plant_id" not in scope_sql("SELECT 1 FROM fact_ehs_event", "ALL")
    assert scope_sql("WITH a AS (SELECT 1) SELECT * FROM a", None).count("WITH") == 1
    with pytest.raises(QueryRejected):
        scope_sql("SELECT 1", "X'; DROP TABLE x;--")


# ----------------------------------------------------------------------------- tools
def test_run_query_returns_rows_and_columns(db):
    out = run_query(db, "SELECT area, COUNT(*) AS n FROM fact_ehs_event GROUP BY area ORDER BY area")
    assert out["columns"] == ["area", "n"]
    assert out["rows"] == [["SMT", 2], ["TEST", 1]]
    assert out["truncated"] is False


def test_run_query_enforces_plant_scope_and_row_cap(db):
    scoped = run_query(db, "SELECT ehs_event_id FROM ehs_core.fact_ehs_event", plant_id="IN-TN-01")
    assert scoped["rows"] == [["EHS-3"]]
    capped = run_query(db, "SELECT ehs_event_id FROM fact_ehs_event", max_rows=2)
    assert capped["row_count"] == 2 and capped["truncated"] is True


def test_run_query_reports_database_errors_to_the_agent(db):
    with pytest.raises(QueryRejected, match="could not run"):
        run_query(db, "SELECT no_such_column FROM fact_ehs_event")


def test_inspect_schema_lists_columns_and_live_allowed_values(db):
    info = inspect_schema(db, "ehs_core.fact_ehs_event")
    assert info["row_count"] == 3
    assert "due_date" in info["columns"] and "relationships" in info
    assert info["allowed_values"]["risk_severity"] == ["CRITICAL", "HIGH", "LOW"]
    assert inspect_schema(db, "fact_ehs_event", plant_id="IN-TN-01")["row_count"] == 1
    with pytest.raises(QueryRejected):
        inspect_schema(db, "users")


# ----------------------------------------------------------------------------- agent loop
class FakeLLM:
    """Replies with a fixed sequence of JSON actions and records the prompts it was given."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts = []

    async def generate_text(self, prompt, **_):
        self.prompts.append(prompt)
        reply = self.replies.pop(0)
        text = reply if isinstance(reply, str) else json.dumps(reply)
        return SimpleNamespace(
            output=text, model_id="fake-model", session_id="s1",
            token_usage=SimpleNamespace(input_tokens=10, output_tokens=5, total_tokens=15, reasoning_tokens=None),
        )


def _ask(db, llm, plant=None):
    return asyncio.run(EhsSafetyAgent(llm).handle_query(db=db, user_question="How many events per area?", plant_id=plant))


def test_agent_inspects_queries_then_answers(db):
    llm = FakeLLM(
        {"action": "inspect_schema", "table": "fact_ehs_event"},
        {"action": "run_query", "sql": "SELECT ehs_event_id, area FROM fact_ehs_event WHERE risk_severity = 'CRITICAL'"},
        {"action": "final", "summary": "One critical event (EHS-1).", "key_findings": ["EHS-1 in SMT"],
         "recommendations": ["Review"], "suggested_questions": ["By plant?"]},
    )
    res = _ask(db, llm)
    assert res.summary == "One critical event (EHS-1)."
    assert [t.tool_name for t in res.execution_trace] == ["inspect_schema", "run_query"]
    assert all(t.status == "completed" for t in res.execution_trace)
    assert any(e.id == "EHS-1" for e in res.supporting_evidence)
    assert res.human_review_required is True and res.token_usage.total_tokens == 45
    assert res.specialist_agents_invoked == []
    # the second prompt carries the first tool result back to the model
    assert "allowed_values" in llm.prompts[1]


def test_agent_recovers_from_rejected_sql(db):
    llm = FakeLLM(
        {"action": "run_query", "sql": "DELETE FROM fact_ehs_event"},
        {"action": "run_query", "sql": "SELECT COUNT(*) AS n FROM fact_ehs_event"},
        {"action": "final", "summary": "3 events."},
    )
    res = _ask(db, llm)
    assert [t.status for t in res.execution_trace] == ["error", "completed"]
    assert "Only SELECT" in llm.prompts[1] and res.summary == "3 events."
    assert db.query(EhsEvent).count() == 3  # nothing was deleted


def test_agent_plain_text_reply_is_used_as_the_answer(db):
    res = _ask(db, FakeLLM("There are three events."))
    assert res.summary == "There are three events." and res.execution_trace == []


def test_agent_stops_after_max_steps_with_a_clear_message(db):
    loop = [{"action": "run_query", "sql": f"SELECT {i} AS n FROM fact_ehs_event"} for i in range(10)]
    res = _ask(db, FakeLLM(*loop))
    assert len(res.execution_trace) == 8
    assert "could not complete" in res.summary.lower()


def test_agent_plant_scope_is_applied_to_queries(db):
    llm = FakeLLM(
        {"action": "run_query", "sql": "SELECT COUNT(*) FROM fact_ehs_event"},
        {"action": "final", "summary": "ok"},
    )
    _ask(db, llm, plant="IN-KA-01")
    assert "[1] run_query" in llm.prompts[1] and "[[2]]" in llm.prompts[1]  # only the 2 IN-KA-01 events are counted
    assert "PLANT_SCOPE: IN-KA-01" in llm.prompts[0]


# ----------------------------------------------------------------------------- API
def test_ai_routes_metadata_and_validation():
    client = TestClient(app)
    agents = client.get("/api/v1/ai/agents").json()
    assert [a["agent_key"] for a in agents] == ["ehs_safety_agent"] and agents[0]["agent_name"] == "EHS Agent"
    assert set(agents[0]["data_sources"]) == {
        "ehs_core.fact_ehs_event", "ehs_core.fact_workforce_attendance", "ehs_core.fact_maintenance_work_order",
    }
    assert client.post("/api/v1/ai/query", json={"prompt": "Summarize hazards", "plant_id": "INVALID"}).status_code == 422
    assert client.post("/api/v1/ai/query", json={"prompt": ""}).status_code == 422


# ----------------------------------------------------------------------------- charts, KPIs, table
from app.agents.response import clean_charts, clean_kpis, clean_table  # noqa: E402
from app.agents.tools import CHART_TYPES, get_chart_format  # noqa: E402


def test_the_agent_knows_exactly_ten_charts_and_each_example_is_valid():
    assert len(CHART_TYPES) == 10
    assert {"line", "area", "bar", "horizontal_bar", "stacked_bar", "grouped_bar", "pie", "donut", "heatmap", "scatter"} == set(CHART_TYPES)
    for chart_type in CHART_TYPES:
        spec = get_chart_format(chart_type)
        assert spec["chart_type"] == chart_type and spec["use_when"] and spec["rules"] and spec["required_fields"]
        charts, notes = clean_charts([spec["example"]])  # the documented example must pass the real validator
        assert len(charts) == 1 and charts[0].type == chart_type and notes == [], (chart_type, notes)


def test_chart_format_tool_accepts_loose_names_and_rejects_unknown_types():
    assert get_chart_format("Horizontal Bar")["chart_type"] == "horizontal_bar"
    with pytest.raises(QueryRejected, match="Available chart types"):
        get_chart_format("radar")


def test_bad_chart_parts_are_dropped_with_a_note_not_a_crash():
    charts, notes = clean_charts([
        {"type": "bar", "title": "ok", "series": [{"name": "n", "data": [{"x": "A", "y": 1}, {"x": "B", "y": "oops"}]}]},
        {"type": "pie", "title": "one slice", "slices": [{"label": "A", "value": 5}]},
        {"type": "stacked_bar", "title": "one series", "series": [{"name": "n", "data": [{"x": "A", "y": 1}]}]},
        {"type": "bar", "series": [{"name": "n", "data": [{"x": "A", "y": 1}]}]},
        {"type": "radar", "title": "unknown", "series": []},
        "not an object",
    ])
    assert [c.title for c in charts] == ["ok"] and len(charts[0].series[0].data) == 1  # the text value was removed
    assert len(notes) == 4  # three dropped + "only the first 4 charts are shown" (the radar and the string were never read)


def test_kpis_and_table_are_cleaned():
    kpis, _ = clean_kpis([{"label": "Overdue", "value": 257, "tone": "critical"}, {"label": "x"}, {"label": "Rate", "value": "96%", "tone": "weird"}])
    assert [k.label for k in kpis] == ["Overdue", "Rate"] and kpis[1].tone == "neutral"
    table, notes = clean_table({"columns": ["area", "n"], "rows": [["SMT", 3], ["TEST"], {"area": "QA", "n": 2}] + [["X", i] for i in range(60)]})
    assert table.columns == ["area", "n"] and table.rows[1] == ["TEST", None] and table.rows[2] == ["QA", 2]
    assert len(table.rows) == 50 and notes
    assert clean_table({"columns": [], "rows": []})[0] is None and clean_table(None)[0] is None


def test_agent_decides_kpis_charts_and_table_and_uses_the_chart_tool(db):
    chart = {"type": "bar", "title": "Events by area", "x_axis": {"label": "Area"}, "y_axis": {"label": "Events"},
             "series": [{"name": "Events", "data": [{"x": "SMT", "y": 2}, {"x": "TEST", "y": 1}]}]}
    llm = FakeLLM(
        {"action": "run_query", "sql": "SELECT area, COUNT(*) AS n FROM fact_ehs_event GROUP BY area ORDER BY n DESC"},
        {"action": "get_chart_format", "chart_type": "bar"},
        {"action": "final", "content": "**SMT** has the most events.",
         "kpis": [{"label": "Total events", "value": 3}],
         "charts": [chart, {"type": "pie", "title": "broken", "slices": []}],
         "table": {"title": "By area", "columns": ["area", "events"], "rows": [["SMT", 2], ["TEST", 1]]},
         "suggested_questions": ["By plant?"]},
    )
    res = _ask(db, llm)
    assert [t.tool_name for t in res.execution_trace] == ["run_query", "get_chart_format", "check_answer"]
    assert res.content == "**SMT** has the most events." and res.summary == res.content
    assert [k.label for k in res.kpis] == ["Total events"]
    assert len(res.charts) == 1 and res.charts[0].type == "bar" and res.charts[0].series[0].data[0].x == "SMT"
    assert res.table.columns == ["area", "events"] and res.table.rows[0] == ["SMT", 2]
    assert "broken" in res.execution_trace[-1].summary  # the invalid chart was dropped and the user can see why
    assert "get_chart_format" in llm.prompts[0] and "heatmap" in llm.prompts[0]
    assert "title" in llm.prompts[2]  # the chart format result went back to the model


def test_simple_question_needs_only_content(db):
    res = _ask(db, FakeLLM({"action": "final", "content": "There are three events."}))
    assert res.content == "There are three events." and res.kpis == [] and res.charts == [] and res.table is None


# ----------------------------------------------------------------------------- messy model replies
def test_reply_with_several_json_objects_uses_the_final_one(db):
    messy = (
        '{"action": "run_query", "sql": "SELECT 1 FROM fact_ehs_event"}\n\nI have the data.\n'
        '{"action": "get_chart_format", "chart_type": "donut"}\n\nNow the answer:\n'
        '```json\n{"action": "final", "content": "Final text.", "kpis": [{"label": "n", "value": 3}]}\n```'
    )
    res = _ask(db, FakeLLM(messy))
    assert res.content == "Final text." and [k.label for k in res.kpis] == ["n"] and res.execution_trace == []


def test_cut_off_json_is_retried_instead_of_shown_to_the_user(db):
    llm = FakeLLM('{"action": "final", "content": "Half an answ', {"action": "final", "content": "Whole answer."})
    res = _ask(db, llm)
    assert res.content == "Whole answer."
    assert [t.tool_name for t in res.execution_trace] == ["invalid_reply"]
    assert "not valid JSON" in llm.prompts[1]
