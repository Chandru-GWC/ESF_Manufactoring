"""
Safety alert system tests. Every write runs against an in-memory sqlite database standing in for the
ehs_core schema; the live Neon database is never touched.
"""
import json
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import alerts as alert_routes
from app.api.routes import detection as detection_routes
from app.core.database import get_db
from app.main import app
from app.models.alert import AlertActivity, AppNotification, SafetyAlert
from app.models.ehs_event import EhsEvent
from app.models.video_analysis import VideoSafetyAnalysis
from app.services.alerts import service

API = "/api/v1"


@pytest.fixture
def env(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.connect() as conn:
        conn.exec_driver_sql("ATTACH DATABASE ':memory:' AS ehs_core")
        conn.exec_driver_sql("CREATE TABLE video_safety_analyses (analysis_id TEXT)")
        conn.commit()
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(detection_routes, "engine", engine)
    monkeypatch.setattr(detection_routes, "SessionLocal", Session)
    monkeypatch.setattr(detection_routes, "_ENSURED_ENGINES", set())
    monkeypatch.setattr(service, "_ENSURED", set())
    monkeypatch.setattr(alert_routes, "_LAST_SYNC", {"at": 1e18})  # no implicit sync inside tests

    def _get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    detection_routes._ensure_video_table()
    EhsEvent.__table__.create(bind=engine, checkfirst=True)
    service.ensure_alert_tables(engine)
    yield Session
    app.dependency_overrides.pop(get_db, None)


def _analysis(db, aid, uc="fall_detection", label="Worker Fall Detected (FALLEN)", detected=True, status="NEEDS_HUMAN_REVIEW",
              conf=None, ts=3.04, video_id="LIB-FD-TEST", plant="ALL", states=("STANDING", "FALLEN")):
    row = VideoSafetyAnalysis(
        analysis_id=aid, use_case=uc, video_id=video_id, plant_id=plant, filename="clip.mp4", status=status,
        progress_pct=100, frames_processed=188, event_detected=detected, event_label=label if detected else None,
        event_timestamp_sec=ts if detected else None, confidence=conf, human_review_status="PENDING_REVIEW",
        detection_events_json=json.dumps([{"frame": 1, "timestamp_sec": 0.0, "state": s} for s in states]),
        evidence_frame_path=f"/x/{aid}_evidence.jpg", annotated_video_path=f"/x/{aid}_annotated.mp4",
        model_used="Test model", summary="Test summary of the detection.", created_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    return row


def _event(db, eid, sev="CRITICAL", status="OPEN", plant="IN-KA-01", area="PACKAGING", cat="FIRE", due_days=-10, ts_days=5, etype="HAZARD_OBSERVATION"):
    db.add(EhsEvent(
        ehs_event_id=eid, event_ts=datetime.utcnow() - timedelta(days=ts_days), plant_id=plant, area=area, shift_id="A",
        event_type=etype, hazard_category=cat, risk_severity=sev, lost_time_injury=False, action_owner="EMP-0001",
        due_date=date.today() + timedelta(days=due_days), action_status=status, permit_id="NONE",
    ))
    db.commit()


# ------------------------------------------------------------------ creation & dedupe
def test_alert_only_from_real_detections_with_full_information(env):
    db = env()
    _analysis(db, "VID-A0000001")
    _analysis(db, "VID-A0000002", detected=False, uc="smoke_fire", video_id="LIB-SF")
    _analysis(db, "VID-A0000003", status="FAILED", detected=False, video_id="LIB-X")
    for aid in ("VID-A0000001", "VID-A0000002", "VID-A0000003"):
        service.alert_from_analysis(db, db.query(VideoSafetyAnalysis).get(aid))
    alerts = db.query(SafetyAlert).all()
    assert len(alerts) == 1, "no alert for clean or failed analyses"
    a = alerts[0]
    assert a.severity == "CRITICAL" and a.status == "NEW" and a.scenario == "fall_detection"
    assert a.source_ref == "VID-A0000001" and a.confidence is None  # the fall pipeline reports no score
    assert a.response_due_at and a.resolution_due_at and a.responsible_team
    assert a.why_dangerous and a.consequences and a.immediate_action and a.corrective_action
    evidence = json.loads(a.evidence_json)
    assert evidence["image_url"].endswith("VID-A0000001_evidence.jpg") and evidence["timestamp_sec"] == 3.04
    assert db.query(AppNotification).filter(AppNotification.alert_id == a.alert_id).count() == 1
    assert db.query(AlertActivity).filter(AlertActivity.alert_id == a.alert_id, AlertActivity.action == "CREATED").count() == 1


def test_same_detection_is_not_duplicated_on_rerun(env):
    db = env()
    _analysis(db, "VID-B0000001")
    _analysis(db, "VID-B0000002")  # same clip, same event, re-analysed
    first, created1 = service.alert_from_analysis(db, db.query(VideoSafetyAnalysis).get("VID-B0000001"))
    again, created2 = service.alert_from_analysis(db, db.query(VideoSafetyAnalysis).get("VID-B0000002"))
    assert created1 and not created2 and first.alert_id == again.alert_id
    assert db.query(SafetyAlert).count() == 1
    assert db.query(AlertActivity).filter(AlertActivity.action == "REDETECTED").count() == 1
    assert db.query(AppNotification).count() == 1
    # the re-run analysis can still find the alert it was folded into
    officer = TestClient(app)
    folded = officer.get(API + "/alerts", params={"source_ref": "VID-B0000002"}).json()["items"]
    assert [a["alert_id"] for a in folded] == [first.alert_id]


def test_severity_rules_use_real_model_output(env):
    db = env()
    _analysis(db, "VID-C0000001", uc="smoke_fire", label="Smoke Detected", conf=0.784, video_id="LIB-SF", states=("SMOKE",))
    _analysis(db, "VID-C0000002", uc="smoke_fire", label="Smoke Detected", conf=0.41, video_id="LIB-SF2", states=("SMOKE",))
    _analysis(db, "VID-C0000003", uc="exit_obstruction", label="Egress Obstruction (truck)", conf=0.68, video_id="LIB-EO", states=("OBSTRUCTED",))
    _analysis(db, "VID-C0000004", label="Pre-Fall Instability Detected (PREFALL)", video_id="LIB-FD2", states=("STANDING", "PREFALL"))
    sev = {}
    for aid in ("VID-C0000001", "VID-C0000002", "VID-C0000003", "VID-C0000004"):
        a, _ = service.alert_from_analysis(db, db.query(VideoSafetyAnalysis).get(aid))
        sev[aid] = a.severity
    assert sev == {"VID-C0000001": "CRITICAL", "VID-C0000002": "HIGH", "VID-C0000003": "HIGH", "VID-C0000004": "HIGH"}
    smoke = db.query(SafetyAlert).filter(SafetyAlert.source_ref == "VID-C0000001").one()
    assert smoke.confidence == pytest.approx(0.784)


# ------------------------------------------------------------------ event-derived alerts
def test_event_sync_only_critical_open_and_is_idempotent(env):
    db = env()
    _event(db, "EHS-1", sev="CRITICAL", status="OPEN")
    _event(db, "EHS-2", sev="CRITICAL", status="CLOSED")
    _event(db, "EHS-3", sev="HIGH", status="OPEN", area="TEST")
    _event(db, "EHS-4", sev="CRITICAL", status="IN_PROGRESS", area="SMT")
    r1 = service.sync_event_alerts(db)
    r2 = service.sync_event_alerts(db)
    assert r1["critical_event_alerts"] == 1 and r2["critical_event_alerts"] == 0
    a = db.query(SafetyAlert).filter(SafetyAlert.source_type == "ehs_event").one()
    assert a.source_ref == "EHS-1" and a.severity == "CRITICAL" and a.responsible_person == "EMP-0001"
    assert "register" in a.detection_source.lower() and a.confidence is None
    # one summary notification, not one per historical record
    assert db.query(AppNotification).count() == 1


def test_recurrence_alert_needs_threshold_within_window(env):
    db = env()
    for i in range(4):
        _event(db, f"EHS-R{i}", sev="HIGH", status="CLOSED", area="WAREHOUSE", cat="FORKLIFT", ts_days=3 + i)
    _event(db, "EHS-OLD", sev="HIGH", status="CLOSED", area="TEST", cat="FIRE", ts_days=400)
    _event(db, "EHS-ONE", sev="HIGH", status="CLOSED", area="SMT", cat="FIRE", ts_days=2)
    r = service.sync_event_alerts(db)
    assert r["recurrence_alerts"] == 1
    a = db.query(SafetyAlert).filter(SafetyAlert.source_type == "recurrence").one()
    assert a.severity == "HIGH" and "WAREHOUSE" in a.location and len(json.loads(a.evidence_json)["event_ids"]) == 4


# ------------------------------------------------------------------ workflow
def _mk(db, sev="CRITICAL", aid="VID-W0000001", uc="fall_detection"):
    _analysis(db, aid, uc=uc, video_id=f"LIB-{aid}")
    a, _ = service.alert_from_analysis(db, db.query(VideoSafetyAnalysis).get(aid))
    return a


def test_workflow_transitions_history_and_validation(env):
    db = env()
    a = _mk(db)
    with pytest.raises(service.WorkflowError):
        service.transition(db, a, "DISMISSED", "u", "no")  # reason too short
    with pytest.raises(service.WorkflowError):
        service.transition(db, a, "RESOLVED", "u", "")  # note required
    service.transition(db, a, "ACKNOWLEDGED", "officer@x", None)
    assert a.acknowledged_at is not None
    service.transition(db, a, "UNDER_INVESTIGATION", "officer@x", "Checking CCTV")
    service.transition(db, a, "ACTION_REQUIRED", "officer@x", "Wet floor repair")
    service.transition(db, a, "RESOLVED", "officer@x", "Floor repaired and signed off")
    assert a.resolved_at is not None and a.status == "RESOLVED"
    with pytest.raises(service.WorkflowError):
        service.transition(db, a, "ACKNOWLEDGED", "x", "n")  # resolved is terminal
    acts = db.query(AlertActivity).filter(AlertActivity.alert_id == a.alert_id).order_by(AlertActivity.ts).all()
    assert [x.to_status for x in acts if x.action == "STATUS_CHANGED"] == ["ACKNOWLEDGED", "UNDER_INVESTIGATION", "ACTION_REQUIRED", "RESOLVED"]
    b = _mk(db, aid="VID-W0000002")
    service.transition(db, b, "DISMISSED", "officer@x", "False positive: reflection on wet floor")
    assert b.status == "DISMISSED" and b.dismissal_reason.startswith("False positive")


def test_api_list_detail_transition_and_plant_filter(env):
    db = env()
    a = _mk(db)
    b_row = _analysis(db, "VID-W0000009", uc="exit_obstruction", label="Egress Obstruction (truck)", conf=0.68, video_id="LIB-EO9", plant="IN-TN-01", states=("OBSTRUCTED",))
    service.alert_from_analysis(db, b_row)
    officer = TestClient(app)
    listing = officer.get(API + "/alerts").json()
    assert listing["total"] == 2 and listing["items"][0]["severity"] == "CRITICAL"  # critical first
    detail = officer.get(API + f"/alerts/{a.alert_id}").json()
    assert detail["facts"] and detail["evidence"]["image_url"] and detail["guidance"]["why_dangerous"]
    assert "not a detection result" in detail["guidance"]["label"]
    assert detail["next_statuses"] and detail["activity"][0]["action"] == "CREATED"
    ok = officer.post(API + f"/alerts/{a.alert_id}/transition", json={"status": "ACKNOWLEDGED"})
    assert ok.status_code == 200 and ok.json()["status"] == "ACKNOWLEDGED"
    assert officer.post(API + f"/alerts/{a.alert_id}/transition", json={"status": "DISMISSED"}).status_code == 409
    assert officer.post(API + f"/alerts/{a.alert_id}/transition", json={"status": "BOGUS"}).status_code == 422
    ka = officer.get(API + "/alerts", params={"plant_id": "IN-KA-01"}).json()
    assert ka["total"] == 0  # the only fleet alert is plant ALL, the other is TN
    tn = officer.get(API + "/alerts", params={"plant_id": "IN-TN-01"}).json()
    ids = [i["alert_id"] for i in tn["items"]]
    assert ids == [db.query(SafetyAlert).filter(SafetyAlert.plant_id == "IN-TN-01").one().alert_id]
    summary = officer.get(API + "/alerts/summary").json()
    assert summary["active"] == 2 and summary["active_by_severity"]["CRITICAL"] == 1


# ------------------------------------------------------------------ reminders & escalation
def test_reminders_escalate_once_per_level_and_stop_after_resolution(env):
    db = env()
    a = _mk(db)  # CRITICAL: respond in 15 min, escalation every 30 min
    base = a.created_at
    assert service.run_reminder_cycle(db, now=base + timedelta(minutes=5)) == {"reminders": 0, "escalations": 0, "capa_digests": 0}
    r1 = service.run_reminder_cycle(db, now=base + timedelta(minutes=20))
    assert r1["reminders"] == 1 and db.query(SafetyAlert).get(a.alert_id).escalation_level == 1
    # repeated cycles at the same level must not create more notifications
    for m in (21, 25, 40):
        assert service.run_reminder_cycle(db, now=base + timedelta(minutes=m))["reminders"] == 0
    r2 = service.run_reminder_cycle(db, now=base + timedelta(minutes=50))
    assert r2["escalations"] == 1 and db.query(SafetyAlert).get(a.alert_id).escalation_level == 2
    r3 = service.run_reminder_cycle(db, now=base + timedelta(minutes=200))
    assert r3["escalations"] == 1 and db.query(SafetyAlert).get(a.alert_id).escalation_level == 3
    assert service.run_reminder_cycle(db, now=base + timedelta(minutes=600))["escalations"] == 0  # capped at the last level
    levels = sorted(n.escalation_level for n in db.query(AppNotification).filter(AppNotification.kind.in_(("REMINDER", "ESCALATION"))).all())
    assert levels == [1, 2, 3]
    assert db.query(AlertActivity).filter(AlertActivity.alert_id == a.alert_id, AlertActivity.action.in_(("REMINDER", "ESCALATED"))).count() == 3


def test_no_reminders_for_acknowledged_resolved_or_dismissed_alerts(env):
    db = env()
    ack = _mk(db, aid="VID-R0000001")
    res = _mk(db, aid="VID-R0000002")
    dis = _mk(db, aid="VID-R0000003")
    service.transition(db, ack, "ACKNOWLEDGED", "u", None)
    service.transition(db, res, "RESOLVED", "u", "fixed it")
    service.transition(db, dis, "DISMISSED", "u", "false positive here")
    later = ack.created_at + timedelta(hours=3)  # past the 15-minute response window, before the 24h resolution target
    assert service.run_reminder_cycle(db, now=later) == {"reminders": 0, "escalations": 0, "capa_digests": 0}
    # an acknowledged critical alert that is still unresolved after its 24h target does get reminded
    late = service.run_reminder_cycle(db, now=ack.created_at + timedelta(hours=26))
    assert late["reminders"] + late["escalations"] == 1  # only the acknowledged-but-unresolved alert
    assert db.query(AppNotification).filter(AppNotification.alert_id.in_((res.alert_id, dis.alert_id)), AppNotification.kind != "ALERT").count() == 0


def test_capa_overdue_levels_and_one_digest_per_plant_per_day(env):
    db = env()
    _event(db, "EHS-C1", sev="CRITICAL", status="IN_PROGRESS", plant="IN-KA-01", due_days=-70, area="A")
    _event(db, "EHS-C2", sev="HIGH", status="OPEN", plant="IN-KA-01", due_days=-10, area="B")
    _event(db, "EHS-C3", sev="LOW", status="OPEN", plant="IN-KA-01", due_days=-5, area="C")
    _event(db, "EHS-C4", sev="CRITICAL", status="CLOSED", plant="IN-KA-01", due_days=-90, area="D")
    _event(db, "EHS-C5", sev="HIGH", status="OPEN", plant="IN-TN-01", due_days=-2, area="E")
    s = service.capa_overdue(db)
    by_id = {i["event_id"]: i for i in s["items"]}
    assert set(by_id) == {"EHS-C1", "EHS-C2", "EHS-C3", "EHS-C5"}  # closed ones are not overdue
    assert by_id["EHS-C1"]["escalation_level"] == 3 and by_id["EHS-C1"]["escalated_to"] == "Safety director"
    assert by_id["EHS-C2"]["escalation_level"] == 1 and by_id["EHS-C5"]["escalation_level"] == 0
    c1 = service.run_reminder_cycle(db)
    c2 = service.run_reminder_cycle(db)
    assert c1["capa_digests"] == 1 and c2["capa_digests"] == 0  # TN item is below the first threshold
    digest = db.query(AppNotification).filter(AppNotification.kind == "CAPA_OVERDUE").one()
    assert digest.plant_id == "IN-KA-01" and digest.target_type == "capa" and digest.escalation_level == 3
    api = TestClient(app)
    assert {i["event_id"] for i in api.get(API + "/alerts/capa-overdue", params={"plant_id": "IN-TN-01"}).json()["items"]} == {"EHS-C5"}


# ------------------------------------------------------------------ notifications
def test_notification_centre_read_state(env):
    db = env()
    _mk(db, aid="VID-N0000001")
    row = _analysis(db, "VID-N0000002", uc="exit_obstruction", label="Egress Obstruction (truck)", conf=0.7, video_id="LIB-N2", plant="IN-TN-01", states=("OBSTRUCTED",))
    service.alert_from_analysis(db, row)
    director = TestClient(app)
    body = director.get(API + "/notifications").json()
    assert body["unread_count"] == 2 and {i["severity"] for i in body["items"]} == {"CRITICAL", "HIGH"}
    first = body["items"][0]["notification_id"]
    assert director.post(API + "/notifications/read", json={"ids": [first]}).json()["marked"] == 1
    assert director.post(API + "/notifications/read", json={"ids": [first]}).json()["marked"] == 0  # idempotent
    assert director.get(API + "/notifications").json()["unread_count"] == 1
    assert director.post(API + "/notifications/read-all").json()["marked"] == 1
    assert director.get(API + "/notifications").json()["unread_count"] == 0


# ------------------------------------------------------------------ human review linkage
def test_human_review_updates_the_linked_alert(env):
    db = env()
    a = _mk(db, aid="VID-H0000001")
    b = _mk(db, aid="VID-H0000002")
    officer = TestClient(app)
    r = officer.patch(API + "/detection/analyses/VID-H0000001/review", json={"human_review_status": "CONFIRMED", "comment": "Confirmed on CCTV"})
    assert r.status_code == 200
    db.expire_all()
    assert db.query(SafetyAlert).get(a.alert_id).status == "ACKNOWLEDGED"
    r = officer.patch(API + "/detection/analyses/VID-H0000002/review", json={"human_review_status": "DISMISSED", "comment": "Reflection, not a fall"})
    assert r.status_code == 200
    db.expire_all()
    dismissed = db.query(SafetyAlert).get(b.alert_id)
    assert dismissed.status == "DISMISSED" and dismissed.dismissal_reason == "Reflection, not a fall"
    assert db.query(AlertActivity).filter(AlertActivity.alert_id == b.alert_id, AlertActivity.actor == "system").count() == 1


# ------------------------------------------------------------------ background scheduler
def test_scheduler_cycle_syncs_events_and_sends_reminders(env, monkeypatch):
    import app.main as main_mod

    db = env()
    _event(db, "EHS-S1", sev="CRITICAL", status="OPEN")
    monkeypatch.setattr(main_mod, "SessionLocal", env)
    monkeypatch.setattr(main_mod, "engine", db.get_bind())
    main_mod._alert_cycle()
    db.expire_all()
    alert = db.query(SafetyAlert).filter(SafetyAlert.source_ref == "EHS-S1").one()
    assert alert.status == "NEW"
    # age the alert past its response window; the next cycle must remind exactly once
    alert.created_at = datetime.utcnow() - timedelta(hours=1)
    alert.response_due_at = datetime.utcnow() - timedelta(minutes=40)
    db.commit()
    main_mod._alert_cycle()
    main_mod._alert_cycle()
    db.expire_all()
    assert db.query(AppNotification).filter(AppNotification.alert_id == alert.alert_id, AppNotification.kind.in_(("REMINDER", "ESCALATION"))).count() == 1


def test_scheduler_shuts_down_cleanly(monkeypatch):
    """Start the real lifespan with a harmless cycle function (never the real DB) and stop it."""
    import asyncio

    import app.main as main_mod
    from app.core.config import settings

    calls = []
    real_sleep = asyncio.sleep

    async def quick(_seconds):
        await real_sleep(0.01)

    monkeypatch.setattr(main_mod, "_alert_cycle", lambda: calls.append(1))
    monkeypatch.setattr(main_mod, "_sleep", quick)
    monkeypatch.setattr(settings, "EHS_ALERT_SCHEDULER", True)
    with TestClient(app) as client:  # runs the lifespan: starts then cancels the scheduler task
        assert client.get("/").status_code == 200  # no database involved
        deadline = 50
        while not calls and deadline:
            import time

            time.sleep(0.02)
            deadline -= 1
    assert calls, "the scheduler loop ran at least one cycle before shutdown"


def test_burst_of_overdue_alerts_becomes_one_digest_not_spam(env):
    db = env()
    alerts = [_mk(db, aid=f"VID-D000000{i}") for i in range(5)]  # five alerts that all go overdue together
    later = alerts[0].created_at + timedelta(minutes=20)
    first = service.run_reminder_cycle(db, now=later)
    assert first["reminders"] == 5
    digests = db.query(AppNotification).filter(AppNotification.kind.in_(("REMINDER", "ESCALATION"))).all()
    assert len(digests) == 1 and "5 overdue" in digests[0].title and digests[0].alert_id is None
    assert service.run_reminder_cycle(db, now=later + timedelta(minutes=1)) == {"reminders": 0, "escalations": 0, "capa_digests": 0}
    # every alert still records its own reminder in its history
    for a in alerts:
        assert db.query(AlertActivity).filter(AlertActivity.alert_id == a.alert_id, AlertActivity.action == "REMINDER").count() == 1
