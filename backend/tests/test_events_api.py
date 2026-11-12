import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["supported_datasets"]["fact_ehs_event.csv"] == "AVAILABLE & INSPECTED"

def test_ingest_and_query_events():
    # Trigger ingestion of default verified CSV
    ingest_res = client.post("/api/v1/events/ingest/default-csv")
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert ingest_data["status"] == "SUCCESS"
    assert ingest_data["total_records"] == 400

    # Query events list
    list_res = client.get("/api/v1/events?limit=10")
    assert list_res.status_code == 200
    events = list_res.json()
    assert len(events) == 10
    assert "ehs_event_id" in events[0]
    assert "event_type" in events[0]

    # Query aggregation summary
    summary_res = client.get("/api/v1/events/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_events"] == 400
    assert "FIRST_AID" in summary["by_event_type"]
    assert "CRITICAL" in summary["by_severity"]
    assert "IN-KA-01" in summary["by_plant"]

