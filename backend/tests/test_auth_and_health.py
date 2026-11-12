from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_live_datasets_and_landing_media():
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

    media_res = client.get("/api/v1/health/landing-media")
    assert media_res.status_code == 200
    media_data = media_res.json()
    assert "video_available" in media_data
    assert "poster_available" in media_data


def test_auth_login_and_me_profile():
    client = TestClient(app)
    bad = client.post("/api/v1/auth/login", json={"email": "safety.director@ehs-enterprise.local", "password": "wrong-password"})
    assert bad.status_code == 401

    ok = client.post("/api/v1/auth/login", json={"email": "safety.director@ehs-enterprise.local", "password": "EhsSafety#2026"})
    assert ok.status_code == 200
    payload = ok.json()
    assert payload["token_type"] == "bearer"
    assert payload["user"]["email"] == "safety.director@ehs-enterprise.local"

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {payload['access_token']}"})
    assert me.status_code == 200
    assert me.json()["user_id"] == payload["user"]["user_id"]

