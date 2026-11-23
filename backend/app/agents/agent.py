"""
EHS Safety Agent - the single agent of the platform.

Loop: question -> (inspect_schema | run_query | get_chart_format)* -> final answer, all driven by DomoGPT.
The final answer is {content, kpis, charts, table}: content always, the rest only when the agent decided it is needed.
DomoGPT is a plain text-generation API, so each step is a JSON "action" the agent writes and this
module executes (see instruction.py for the protocol). All data access goes through the two tools in
app/agents/tools and is read-only.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.agents.instruction import AGENT_ROLE, LIMITATIONS, build_prompt
from app.agents.response import clean_charts, clean_kpis, clean_table
from app.agents.tools import SCHEMA, TABLES, QueryRejected, get_chart_format, inspect_schema, run_query
from app.schemas.ai_agent import (
    AgentMetadata,
    AgentTraceStep,
    AIQueryResponse,
    EvidenceItem,
    TokenUsageSchema,
)
from app.services.domogpt_service import DomoGPTService, domogpt_service

MAX_STEPS = 8  # tool calls + the final answer
MAX_TOKENS = 2800  # the final answer can carry KPIs, charts and a table
RESULT_CHARS = 3500  # how much of one tool result is shown back to the model

_PK_TO_TABLE = {doc.primary_key: doc.name for doc in TABLES.values()}


def _parse_action(raw: str) -> Optional[Dict[str, Any]]:
    """
    Extract the action the model replied with.

    Tolerates ``` fences and text around the JSON. When the model wrote several JSON objects in one reply (it
    sometimes narrates its next steps), the first "final" object is used, otherwise the first action object.
    """
    if not raw:
        return None
    cleaned = re.sub(r"```(?:json)?", "", raw, flags=re.IGNORECASE)
    decoder = json.JSONDecoder()
    found: List[Dict[str, Any]] = []
    index = cleaned.find("{")
    while index != -1:
        try:
            obj, end = decoder.raw_decode(cleaned, index)
        except ValueError:
            index = cleaned.find("{", index + 1)
            continue
        if isinstance(obj, dict) and obj.get("action"):
            found.append(obj)
        index = cleaned.find("{", end)
    if not found:
        return None
    return next((o for o in found if str(o.get("action")).lower() == "final"), found[0])


def _string_list(value: Any, limit: int = 6) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()][:limit]


def _shorten(payload: Dict[str, Any]) -> str:
    text = json.dumps(payload, default=str, separators=(",", ":"))
    return text if len(text) <= RESULT_CHARS else text[:RESULT_CHARS] + " ...[truncated]"


class EhsSafetyAgent:
    agent_key = "ehs_safety_agent"
    agent_name = "EHS Agent"

    def __init__(self, llm_service: DomoGPTService = domogpt_service) -> None:
        self.llm = llm_service

    def metadata(self) -> AgentMetadata:
        return AgentMetadata(
            agent_key=self.agent_key,
            agent_name=self.agent_name,
            role=AGENT_ROLE,
            data_sources=[f"{SCHEMA}.{name}" for name in TABLES],
            capabilities=[
                "inspect_schema: columns, meanings and allowed values of a table",
                "run_query: one read-only SELECT over the approved tables (max 50 rows)",
                "get_chart_format: the JSON format of one of 10 chart types (line, area, bar, horizontal_bar, stacked_bar, grouped_bar, pie, donut, heatmap, scatter)",
                "Answers grounded in query results with record ids",
            ],
            limitations=list(LIMITATIONS),
        )

    async def handle_query(
        self,
        *,
        db: Session,
        user_question: str,
        plant_id: Optional[str] = None,
        target_agent: Optional[str] = None,  # kept for API compatibility; there is only one agent
    ) -> AIQueryResponse:
        started = time.perf_counter()
        plant_scope = (plant_id or "ALL").strip().upper() or "ALL"
        today = date.today().isoformat()

        transcript: List[str] = []
        trace: List[AgentTraceStep] = []
        evidence: List[EvidenceItem] = []
        usages: List[Any] = []
        seen_calls: set[str] = set()
        final: Optional[Dict[str, Any]] = None
        prose: Optional[str] = None
        model_id = session_id = None
        records_total = 0
        bad_replies = 0

        for step in range(MAX_STEPS):
            prompt = build_prompt(
                question=user_question,
                plant_scope=plant_scope,
                today=today,
                transcript="\n".join(transcript),
                steps_left=MAX_STEPS - 1 - step,
            )
            llm_res = await self.llm.generate_text(prompt, temperature=0.1, max_tokens=MAX_TOKENS)
            model_id, session_id = llm_res.model_id, llm_res.session_id or session_id
            usages.append(llm_res.token_usage)

            action = _parse_action(llm_res.output)
            if action is None:
                looks_like_json = '"action"' in llm_res.output
                if looks_like_json and bad_replies < 2 and step < MAX_STEPS - 1:
                    # The reply was JSON that is cut off or broken: ask for a shorter, valid one instead of showing it.
                    bad_replies += 1
                    transcript.append(
                        "[!] Your last reply was not valid JSON (it may have been cut off). Reply with ONE complete, valid "
                        "JSON object. If it was the final answer, make it shorter (fewer rows, fewer points)."
                    )
                    trace.append(
                        AgentTraceStep(
                            step=len(trace) + 1,
                            agent_key=self.agent_key,
                            agent_name=self.agent_name,
                            tool_name="invalid_reply",
                            status="error",
                            duration_ms=0,
                            records_examined=0,
                            summary="The reply was not valid JSON; the agent was asked to try again.",
                        )
                    )
                    continue
                prose = llm_res.output.strip()  # the model answered in plain text: use it as the answer
                break
            kind = str(action.get("action") or "").lower()
            if kind == "final":
                final = action
                break

            t0 = time.perf_counter()
            call_key = json.dumps(action, sort_keys=True, default=str)
            records = 0
            if kind not in ("inspect_schema", "run_query", "get_chart_format"):
                result: Dict[str, Any] = {"error": "Unknown action. Use inspect_schema, run_query, get_chart_format or final."}
                status = "error"
            elif call_key in seen_calls:
                result = {"error": "You already made this exact call. Use its earlier result or give the final answer."}
                status = "skipped"
            else:
                seen_calls.add(call_key)
                try:
                    if kind == "inspect_schema":
                        result = inspect_schema(db, str(action.get("table") or ""), plant_id)
                        records = int(result.get("row_count") or 0)
                    elif kind == "get_chart_format":
                        result = get_chart_format(str(action.get("chart_type") or ""))
                    else:
                        result = run_query(db, str(action.get("sql") or ""), plant_id)
                        records = result["row_count"]
                        evidence.extend(self._evidence_from_query(len(trace) + 1, result))
                    status = "completed"
                except QueryRejected as exc:
                    result, status = {"error": str(exc)}, "error"
            records_total += records
            transcript.append(
                f"[{len(trace) + 1}] {kind}({json.dumps({k: v for k, v in action.items() if k != 'action'}, default=str)})"
                f" -> {_shorten(result)}"
            )
            trace.append(
                AgentTraceStep(
                    step=len(trace) + 1,
                    agent_key=self.agent_key,
                    agent_name=self.agent_name,
                    tool_name=kind or "unknown",
                    status=status,
                    duration_ms=int((time.perf_counter() - t0) * 1000),
                    records_examined=records,
                    summary=(result.get("error") or str(action.get("sql") or action.get("table") or action.get("chart_type") or ""))[:240],
                )
            )

        kpis: List[Any] = []
        charts: List[Any] = []
        table = None
        notes: List[str] = []
        if final is not None:
            content = str(final.get("content") or final.get("summary") or "").strip()
            suggested = _string_list(final.get("suggested_questions"), limit=3)
            kpis, kpi_notes = clean_kpis(final.get("kpis"))
            charts, chart_notes = clean_charts(final.get("charts"))
            table, table_notes = clean_table(final.get("table"))
            notes = [*kpi_notes, *chart_notes, *table_notes]
            if notes:
                trace.append(
                    AgentTraceStep(
                        step=len(trace) + 1,
                        agent_key=self.agent_key,
                        agent_name=self.agent_name,
                        tool_name="check_answer",
                        status="skipped",
                        duration_ms=0,
                        records_examined=0,
                        summary=" ".join(notes)[:240],
                    )
                )
        else:
            content = prose or "I could not complete the analysis within the allowed number of steps. Please ask a narrower question."
            suggested = []
        if not content:
            content = "No answer was produced for this question."

        valid = [u for u in usages if u is not None]
        token_usage = None
        if valid:
            token_usage = TokenUsageSchema(
                input_tokens=sum(u.input_tokens or 0 for u in valid) or None,
                output_tokens=sum(u.output_tokens or 0 for u in valid) or None,
                total_tokens=sum(u.total_tokens or ((u.input_tokens or 0) + (u.output_tokens or 0)) for u in valid) or None,
            )

        meta = self.metadata()
        return AIQueryResponse(
            success=True,
            agent_key=self.agent_key,
            agent_name=self.agent_name,
            user_question=user_question,
            plant_scope=plant_scope,
            routing_reason=f"Single agent. {len(trace)} tool call(s) in {int((time.perf_counter() - started) * 1000)} ms, "
            f"{records_total} record(s) examined.",
            specialist_agents_invoked=[],
            content=content,
            kpis=kpis,
            charts=charts,
            table=table,
            summary=content,
            supporting_evidence=evidence[:25],
            data_sources=meta.data_sources,
            limitations=meta.limitations,
            human_review_required=True,
            model_id=model_id,
            session_id=session_id,
            token_usage=token_usage,
            execution_trace=trace,
            suggested_questions=suggested,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    def _evidence_from_query(n: int, result: Dict[str, Any]) -> List[EvidenceItem]:
        """One item for the query itself, plus one per primary-key value returned (max 10)."""
        items = [
            EvidenceItem(
                id=f"query-{n}",
                label="SQL query result",
                dataset_source=", ".join(f"{SCHEMA}.{t}" for t in TABLES if t in result["sql"].lower()) or SCHEMA,
                value=f"{result['row_count']} row(s)" + (" (limited to 50)" if result["truncated"] else ""),
                excerpt=result["sql"][:300],
            )
        ]
        cols = result["columns"]
        for idx, col in enumerate(cols):
            table = _PK_TO_TABLE.get(col)
            if not table:
                continue
            for row in result["rows"][:10]:
                items.append(EvidenceItem(id=str(row[idx]), label=f"{table} record", dataset_source=f"{SCHEMA}.{table}"))
        return items


ehs_agent = EhsSafetyAgent()
