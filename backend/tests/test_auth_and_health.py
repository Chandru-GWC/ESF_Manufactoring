from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_live_datasets():
    client = TestClient(app)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["supported_datasets"]["fact_ehs_event.csv"] == "AVAILABLE & INSPECTED"
    assert data["supported_datasets"]["fact_workforce_attendance.csv"] == "AVAILABLE & INSPECTED"
    assert data["supported_datasets"]["fact_maintenance_work_order.csv"] == "AVAILABLE & INSPECTED"
    assert data["record_counts"]["fact_ehs_event"] >= 400
    assert data["record_counts"]["fact_workforce_attendance"] >= 16560
    assert data["record_counts"]["fact_maintenance_work_order"] >= 400
