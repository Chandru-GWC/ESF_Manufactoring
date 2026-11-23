"""Overview dashboards and their Excel / PDF exports, on a small in-memory database (never the live Neon one)."""
import io
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.ehs_event import EhsEvent
from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance
from app.services.dashboards import builders

API = "/api/v1/dashboards"
TODAY = date.today()


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.connect() as conn:
        conn.exec_driver_sql("ATTACH DATABASE ':memory:' AS ehs_core")
        conn.commit()
    for model in (EhsEvent, WorkforceAttendance, MaintenanceWorkOrder):
        model.__table__.create(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    seed = Session()
    areas = ["SMT", "TEST", "PACKAGING"]
    for i in range(30):
        seed.add(EhsEvent(
            ehs_event_id=f"EHS-{i:05d}", event_ts=datetime(2026, 8 + i % 3, 1 + i % 25, 6), plant_id="IN-KA-01" if i % 2 else "IN-TN-01",
            area=areas[i % 3], shift_id="ABC"[i % 3], event_type=["HAZARD_OBSERVATION", "NEAR_MISS", "FIRST_AID"][i % 3],
            hazard_category=["FIRE", "FORKLIFT"][i % 2], risk_severity=["CRITICAL", "HIGH", "MEDIUM", "LOW"][i % 4], lost_time_injury=False,
            action_owner="EMP-0001", due_date=TODAY - timedelta(days=5) if i % 3 else TODAY + timedelta(days=5),
            action_status=["OPEN", "IN_PROGRESS", "CLOSED"][i % 3], permit_id="PTW-1",
        ))
    for i in range(40):
        seed.add(WorkforceAttendance(
            attendance_id=f"ATT-{i:08d}", work_date=date(2026, 8, 3) + timedelta(days=i % 30), employee_id=f"EMP-{i % 8:04d}",
            plant_id="IN-KA-01" if i % 2 else "IN-TN-01", shift_id="ABC"[i % 3], scheduled_hours=8, actual_hours=8 if i % 7 else 4,
            attendance_status=["PRESENT", "PRESENT", "PRESENT", "ABSENT", "LATE", "LEAVE"][i % 6], overtime_hours=i % 3,
            skill_match="MATCHED" if i % 5 else "GAP", training_compliance="EXPIRED" if i % 9 == 0 else "CURRENT",
        ))
    for i in range(25):
        seed.add(MaintenanceWorkOrder(
            work_order_id=f"MWO-{i:05d}", machine_id=f"M-{i % 5}", plant_id="IN-KA-01" if i % 2 else "IN-TN-01",
            created_ts=datetime(2026, 8 + i % 3, 1 + i % 20, 8), maintenance_type=["PREVENTIVE", "CORRECTIVE", "PREDICTIVE"][i % 3],
            failure_mode=["BEARING_WEAR", "BELT_MISALIGNMENT", "MOTOR_OVERHEAT"][i % 3], priority=["P1", "P2", "P3"][i % 3],
            planned_start=datetime(2026, 9, 1), actual_start=None, downtime_avoided_estimate_min=60 + i,
            status=["PLANNED", "IN_PROGRESS", "COMPLETED"][i % 3], technician_id="EMP-0002",
        ))
    seed.commit()
    seed.close()

    def _get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    builders.clear_cache()
    app.dependency_overrides[get_db] = _get_db
    test_client = TestClient(app)
    test_client.session_factory = Session  # for the test that empties a table
    yield test_client
    app.dependency_overrides.pop(get_db, None)
    builders.clear_cache()


@pytest.mark.parametrize("kind, total", [("events", 30), ("attendance", 40), ("maintenance", 25)])
def test_each_dashboard_has_five_kpis_four_charts_and_a_five_row_table(client, kind, total):
    d = client.get(f"{API}/{kind}").json()
    assert d["kind"] == kind and d["plant_scope"] == "All plants"
    assert len(d["kpis"]) == 5 and all(k["label"] and k["value"] is not None for k in d["kpis"])
    assert [c["type"] for c in d["charts"]] == ["area", "line", "heatmap", "donut"]
    assert d["table"]["total_rows"] == total and len(d["table"]["rows"]) == 5
    assert all(len(r) == len(d["table"]["columns"]) for r in d["table"]["rows"])
    area, line, heat, donut = d["charts"]
    assert area["series"] and line["series"] and heat["cells"] and donut["slices"]
    assert all(s["data"] for s in area["series"] + line["series"])


def test_events_numbers_are_correct(client):
    d = client.get(f"{API}/events").json()
    k = {x["label"]: x["value"] for x in d["kpis"]}
    assert k["Total events"] == 30 and k["Open corrective actions"] == 20 and k["Critical + High events"] == 16
    assert k["Overdue actions"] == 10  # open (not CLOSED) and due before today
    assert k["Action closure rate"] == pytest.approx(33.3)
    assert sum(s["value"] for s in d["charts"][3]["slices"]) == 30  # donut = every event
    assert sum(c["value"] for c in d["charts"][2]["cells"]) == 30  # heatmap = every event
    assert sum(p["y"] for p in d["charts"][0]["series"][0]["data"]) == 30
    assert d["table"]["rows"][0][0] == "EHS-00023"  # newest first


def test_attendance_and_maintenance_numbers(client):
    a = {x["label"]: x["value"] for x in client.get(f"{API}/attendance").json()["kpis"]}
    assert a["Employees"] == 8 and a["Hours worked"] > 0 and a["Employees with expired training"] > 0
    m = client.get(f"{API}/maintenance").json()
    mk = {x["label"]: x["value"] for x in m["kpis"]}
    assert mk["Work orders"] == 25 and mk["Open P1 orders"] == 9  # P1 and not completed
    assert sum(s["value"] for s in m["charts"][3]["slices"]) == 25


def test_plant_filter_and_unknown_kind(client):
    ka = client.get(f"{API}/events", params={"plant_id": "IN-KA-01"}).json()
    assert ka["plant_scope"] == "IN-KA-01" and ka["table"]["total_rows"] == 15
    assert client.get(f"{API}/events", params={"plant_id": "ALL"}).json()["table"]["total_rows"] == 30
    assert client.get(f"{API}/nonsense").status_code == 422


def test_empty_tables_give_zero_kpis_not_an_error(client):
    session = client.session_factory()
    session.execute(text("DELETE FROM ehs_core.fact_ehs_event"))
    session.commit()
    session.close()
    builders.clear_cache()
    d = client.get(f"{API}/events", params={"refresh": "true"}).json()
    assert d["table"]["total_rows"] == 0 and d["table"]["rows"] == [] and len(d["kpis"]) == 5
    assert d["charts"][0]["series"] == [] and d["charts"][3]["slices"] == []


def test_excel_export_contains_the_whole_table_and_the_kpis(client):
    res = client.get(f"{API}/events/export", params={"format": "xlsx"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "attachment" in res.headers["content-disposition"] and ".xlsx" in res.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(res.content))
    assert wb.sheetnames == ["Summary", "Data"]
    data = wb["Data"]
    assert data.max_row == 31 and data.max_column == 13  # header + 30 events, every column
    assert [c.value for c in data[1]][:3] == ["Ehs Event Id", "Event Ts", "Plant Id"]
    assert data["A2"].value == "EHS-00023" and isinstance(data["B2"].value, datetime)
    summary = wb["Summary"]
    assert summary["A1"].value == "Events dashboard"
    assert summary["A6"].value == "Total events" and summary["B6"].value == 30


def test_pdf_export_is_a_pdf_with_the_title_and_data(client):
    res = client.get(f"{API}/maintenance/export", params={"format": "pdf", "plant_id": "IN-KA-01"})
    assert res.status_code == 200 and res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF") and len(res.content) > 3000
    assert "in-ka-01" in res.headers["content-disposition"] and ".pdf" in res.headers["content-disposition"]
    assert client.get(f"{API}/events/export", params={"format": "csv"}).status_code == 422
