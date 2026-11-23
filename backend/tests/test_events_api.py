"""Events API against an isolated in-memory database (never the live Neon database)."""
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models.ehs_event import EhsEvent


@pytest.fixture
def client():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with eng.connect() as conn:
        conn.exec_driver_sql("ATTACH DATABASE ':memory:' AS ehs_core")
        conn.commit()
    EhsEvent.__table__.create(bind=eng)
    Session = sessionmaker(bind=eng, autoflush=False, autocommit=False)

    def event(eid, plant, area, sev, status):
        return EhsEvent(
            ehs_event_id=eid, event_ts=datetime(2026, 10, 1), plant_id=plant, area=area, shift_id="A",
            event_type="HAZARD_OBSERVATION", hazard_category="FIRE", risk_severity=sev, lost_time_injury=False,
            action_owner="EMP-0001", due_date=date(2026, 11, 1), action_status=status, permit_id="PTW-1",
        )

    seed = Session()
    seed.add_all([
        event("EHS-1", "IN-KA-01", "SMT", "CRITICAL", "OPEN"),
        event("EHS-2", "IN-KA-01", "TEST", "LOW", "CLOSED"),
        event("EHS-3", "IN-TN-01", "SMT", "HIGH", "IN_PROGRESS"),
    ])
    seed.commit()
    seed.close()

    def _get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


def test_list_events_with_filters(client):
    assert len(client.get("/api/v1/events").json()) == 3
    ka = client.get("/api/v1/events", params={"plant_id": "IN-KA-01"}).json()
    assert {e["ehs_event_id"] for e in ka} == {"EHS-1", "EHS-2"}
    crit = client.get("/api/v1/events", params={"risk_severity": "CRITICAL"}).json()
    assert [e["ehs_event_id"] for e in crit] == ["EHS-1"]
    assert len(client.get("/api/v1/events", params={"limit": 2}).json()) == 2


def test_event_summary_and_single_event(client):
    summary = client.get("/api/v1/events/summary").json()
    assert summary["total_events"] == 3
    assert summary["by_severity"]["CRITICAL"] == 1 and summary["by_plant"]["IN-KA-01"] == 2
    assert client.get("/api/v1/events/summary", params={"plant_id": "IN-TN-01"}).json()["total_events"] == 1
    assert client.get("/api/v1/events/EHS-3").json()["area"] == "SMT"
    assert client.get("/api/v1/events/EHS-NOPE").status_code == 404


def test_csv_ingestion_endpoint_is_gone(client):
    assert client.post("/api/v1/events/ingest/default-csv").status_code in (404, 405)
