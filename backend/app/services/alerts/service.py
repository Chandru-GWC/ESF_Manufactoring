"""
Safety alert engine: creation (with de-duplication), workflow transitions, reminder/escalation
cycle, CAPA-overdue tracking and notifications.

Alerts are only created from real inputs: a completed video analysis that actually detected an
event, an EHS event record that is still critical and open, or a configured recurrence rule.
Nothing is generated merely because a video file exists.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.alert import AlertActivity, AppNotification, NotificationRead, SafetyAlert
from app.models.ehs_event import EhsEvent
from app.models.video_analysis import VideoSafetyAnalysis
from app.services.alerts.rules import (
    ACTIVE_STATUSES,
    TERMINAL_STATUSES,
    TRANSITIONS,
    guidance_for,
    load_rules,
)

logger = logging.getLogger("ehs.alerts")
SYSTEM_ACTOR = "System (alert engine)"
DIGEST_THRESHOLD = 3  # more than this many reminders in one cycle are collapsed into digests
SEVERITY_ORDER = ("CRITICAL", "HIGH", "MEDIUM", "LOW")

_ENSURED: set = set()


def ensure_alert_tables(engine) -> None:
    """Create the alert tables if missing (safe to call repeatedly)."""
    if id(engine) in _ENSURED:
        return
    tables = [m.__table__ for m in (SafetyAlert, AlertActivity, AppNotification, NotificationRead)]
    if engine.dialect.name == "postgresql":
        # One round trip instead of one existence check per table (the database is far away).
        from sqlalchemy import text

        with engine.connect() as conn:
            found = {
                r[0]
                for r in conn.execute(
                    text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'ehs_core' AND table_name = ANY(:names)"),
                    {"names": [t.name for t in tables]},
                )
            }
        if all(t.name in found for t in tables):
            _ENSURED.add(id(engine))
            return
    for table in tables:
        table.create(bind=engine, checkfirst=True)
    _ENSURED.add(id(engine))


def _id(prefix: str, n: int = 8) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:n].upper()}"


def _label(text: str) -> str:
    return (text or "").replace("_", " ").title()


def _activity(db: Session, alert_id: str, actor: str, action: str, frm: Optional[str], to: Optional[str], note: Optional[str]) -> None:
    db.add(
        AlertActivity(
            activity_id=_id("ACT", 12),
            alert_id=alert_id,
            ts=datetime.utcnow(),
            actor=actor[:160],
            action=action,
            from_status=frm,
            to_status=to,
            note=note,
        )
    )


def _notify(
    db: Session,
    *,
    dedupe: str,
    kind: str,
    severity: str,
    title: str,
    message: str,
    target_type: str,
    target_ref: Optional[str],
    plant_id: str,
    alert_id: Optional[str] = None,
    level: int = 0,
    recipient: Optional[str] = None,
) -> Optional[AppNotification]:
    """Insert a notification unless one with the same dedupe key already exists (no spam)."""
    if db.query(AppNotification.notification_id).filter(AppNotification.dedupe_key == dedupe).first():
        return None
    note = AppNotification(
        notification_id=_id("NTF", 12),
        dedupe_key=dedupe[:200],
        kind=kind,
        severity=severity,
        title=title[:240],
        message=message,
        alert_id=alert_id,
        target_type=target_type,
        target_ref=target_ref,
        plant_id=plant_id or "ALL",
        escalation_level=level,
        recipient=recipient,
        channel="in_app",
        created_at=datetime.utcnow(),
    )
    try:
        with db.begin_nested():
            db.add(note)
        return note
    except IntegrityError:  # a concurrent worker inserted it first
        return None


# ----------------------------------------------------------------------------- creation
def create_alert(db: Session, spec: Dict[str, Any], *, notify: bool = True) -> Tuple[SafetyAlert, bool]:
    """Create an alert unless `spec['dedupe_key']` already exists. Returns (alert, created)."""
    rules = load_rules()
    existing = db.query(SafetyAlert).filter(SafetyAlert.dedupe_key == spec["dedupe_key"]).first()
    if existing:
        return existing, False

    severity = spec["severity"]
    now = datetime.utcnow()
    alert = SafetyAlert(
        alert_id=f"ALT-{now:%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
        status="NEW",
        created_at=now,
        updated_at=now,
        response_due_at=now + timedelta(minutes=rules["response_minutes"][severity]),
        resolution_due_at=now + timedelta(hours=rules["resolution_hours"][severity]),
        escalation_level=0,
        **spec,
    )
    try:
        with db.begin_nested():
            db.add(alert)
    except IntegrityError:
        return db.query(SafetyAlert).filter(SafetyAlert.dedupe_key == spec["dedupe_key"]).one(), False
    _activity(db, alert.alert_id, SYSTEM_ACTOR, "CREATED", None, "NEW", f"Alert raised from {spec['detection_source']}.")
    if notify and severity != "LOW":
        _notify(
            db,
            dedupe=f"alert:{alert.alert_id}",
            kind="ALERT",
            severity=severity,
            title=f"{severity.title()} alert: {alert.title}",
            message=f"{alert.location or alert.plant_id}. Acknowledge within {rules['response_minutes'][severity]} minutes.",
            target_type="alert",
            target_ref=alert.alert_id,
            plant_id=alert.plant_id,
            alert_id=alert.alert_id,
            recipient=alert.responsible_team,
        )
    db.commit()
    return alert, True


def _json(value: Any) -> Optional[str]:
    return json.dumps(value) if value not in (None, [], {}) else None


_SCENARIO_TITLES = {
    "fall_detection": "Worker fall detected",
    "smoke_fire": "Smoke or fire detected",
    "exit_obstruction": "Emergency exit obstructed",
    "forklift_pedestrian": "Forklift–pedestrian near miss",
    "machinery_proximity": "Worker too close to moving machinery",
    "unsafe_climbing": "Unsafe climbing / work at height",
}
_CONFIDENCE_PIPELINES = ("forklift_pedestrian", "machinery_proximity", "unsafe_climbing")
_PIPELINE_NAMES = {
    "forklift_pedestrian": "OWLv2 + YOLOv8n forklift–pedestrian proximity pipeline",
    "machinery_proximity": "OWLv2 + YOLOv8n + MediaPipe machinery-zone pipeline",
    "unsafe_climbing": "OWLv2 + YOLOv8n + MediaPipe work-at-height posture pipeline",
    "fall_detection": "OpenFall + MediaPipe pose pipeline",
    "smoke_fire": "YOLOv8 smoke & fire pipeline",
    "exit_obstruction": "YOLOv8n egress-obstruction pipeline",
}


def alert_from_analysis(db: Session, row: VideoSafetyAnalysis) -> Tuple[Optional[SafetyAlert], bool]:
    """Raise (or de-duplicate into) an alert for a video analysis that genuinely detected an event."""
    if not row.event_detected or row.status == "FAILED":
        return None, False
    rules = load_rules()
    uc = row.use_case
    try:
        events = json.loads(row.detection_events_json or "[]")
    except ValueError:
        events = []
    states = {str(e.get("state", "")).upper() for e in events if isinstance(e, dict)}

    if uc == "fall_detection":
        severity = "CRITICAL" if "FALLEN" in states or "FALLEN" in (row.event_label or "").upper() else "HIGH"
    elif uc == "smoke_fire":
        severity = "CRITICAL" if (row.confidence or 0) >= rules["fire_critical_confidence"] else "HIGH"
    elif uc == "forklift_pedestrian":
        severity = "CRITICAL"  # a confirmed near miss between a pedestrian and a moving forklift
    elif uc == "machinery_proximity":
        hands = [e for e in events if isinstance(e, dict) and e.get("state") == "HANDS_IN_MACHINE_AREA"]
        moving = any((e.get("metrics") or {}).get("machine_moving") for e in events if isinstance(e, dict))
        if hands and moving:
            severity = "CRITICAL"  # hands over a machine whose movement was detected
        elif hands or moving:
            severity = "HIGH"
        else:
            severity = "MEDIUM"  # zone entry but machine movement not confirmed
    elif uc == "unsafe_climbing":
        # observed unsafe posture (overreach / torso lean) is HIGH; working at height alone is MEDIUM
        severity = "HIGH" if "UNSAFE_POSTURE" in states else "MEDIUM"
    else:  # exit obstruction
        severity = "HIGH"

    g = guidance_for(uc)
    ts = row.event_timestamp_sec
    video_key = row.video_id or row.filename
    dedupe = f"video:{video_key}:{uc}:{row.event_label}:{round(ts, 1) if ts is not None else 'na'}"

    evidence: Dict[str, Any] = {"source_video": row.filename, "video_id": row.video_id, "timestamp_sec": ts, "analysis_id": row.analysis_id}
    if row.evidence_frame_path:
        evidence["image_url"] = f"/api/v1/detection/evidence/{os.path.basename(row.evidence_frame_path)}"
    if row.annotated_video_path:
        evidence["video_url"] = f"/api/v1/detection/annotated/{os.path.basename(row.annotated_video_path)}"

    facts = [
        f"Detection: {row.event_label or _SCENARIO_TITLES.get(uc, uc)}"
        + (f" at {ts:.2f}s into the clip" if ts is not None else ""),
        f"Source clip: {row.filename}",
        f"Analysis {row.analysis_id}: {row.frames_processed} frames processed",
    ]
    if row.summary:
        facts.append(row.summary)
    if row.confidence is not None:
        facts.append(f"Model confidence: {row.confidence * 100:.1f}%")
    if uc in _CONFIDENCE_PIPELINES:
        m = next((e.get("metrics") for e in events if isinstance(e, dict) and e.get("timestamp_sec") == ts and e.get("metrics")), None) or {}
        if "estimated_distance_m" in m:
            facts.append(f"Estimated pedestrian-to-forklift distance: {m['estimated_distance_m']} m (image-plane estimate, 1.7 m person assumed); forklift moving: {m.get('forklift_moving')}.")
        if "machine_moving" in m:
            facts.append(f"Machine movement detected in the zone: {m['machine_moving']}; hands over machine: {m.get('hands_in_machine')}.")
        if "elevation_ratio" in m:
            facts.append(
                f"Worker elevated on ladder (feet {m['elevation_ratio']:.0%} of ladder height above its base)"
                + (f"; torso lean {m['lean_deg']}°, lateral reach {m['overreach_ratio']}× torso length" if 'lean_deg' in m else "")
                + ". Ladder stability was not measured."
            )

    spec = dict(
        dedupe_key=dedupe[:160],
        source_type="video_analysis",
        source_ref=row.analysis_id,
        scenario=uc,
        category="Video safety monitoring",
        severity=severity,
        title=_SCENARIO_TITLES.get(uc, _label(uc)) + (f" – {row.event_label}" if row.event_label and uc == "exit_obstruction" else ""),
        plant_id=(row.plant_id or "ALL").upper(),
        location=f"Video clip: {row.filename}",
        detected_at=row.completed_at or row.created_at or datetime.utcnow(),
        detection_source=f"{_PIPELINE_NAMES.get(uc, uc)} ({row.model_used or 'model not recorded'})",
        description=row.summary or (row.event_label or _SCENARIO_TITLES.get(uc, uc)),
        facts_json=_json(facts),
        evidence_json=_json(evidence),
        confidence=row.confidence,
        confidence_note=row.confidence_note,
        why_dangerous=g["why"],
        consequences=g["consequences"],
        immediate_action=g["immediate"],
        corrective_action=g["corrective"],
        responsible_team=g["team"],
    )
    alert, created = create_alert(db, spec)
    if not created:
        _activity(db, alert.alert_id, SYSTEM_ACTOR, "REDETECTED", None, None, f"Same event detected again in analysis {row.analysis_id}; no duplicate alert created.")
        db.commit()
    return alert, created


def _event_facts(e: EhsEvent, today: date) -> List[str]:
    overdue = (today - e.due_date).days
    facts = [
        f"{_label(e.event_type)} recorded {e.event_ts:%d %b %Y %H:%M} at {e.area} ({e.plant_id}), shift {e.shift_id}.",
        f"Hazard category: {_label(e.hazard_category)}; risk severity: {e.risk_severity}.",
        f"Corrective action status: {_label(e.action_status)}; owner {e.action_owner}; due {e.due_date:%d %b %Y}"
        + (f" ({overdue} days overdue)." if overdue > 0 else "."),
    ]
    if e.lost_time_injury:
        facts.append("A lost-time injury is recorded for this event.")
    if e.permit_id and e.permit_id.upper() not in ("NONE", "N/A", ""):
        facts.append(f"Linked permit: {e.permit_id}.")
    return facts


def sync_event_alerts(db: Session) -> Dict[str, int]:
    """Create alerts for EHS events that are CRITICAL and still OPEN, plus recurring-hazard alerts."""
    rules = load_rules()
    today = datetime.utcnow().date()
    cap = int(rules["max_new_alerts_per_sync"])
    have = {r[0] for r in db.query(SafetyAlert.dedupe_key).filter(SafetyAlert.source_type.in_(("ehs_event", "recurrence"))).all()}

    created_events = 0
    crit = db.query(EhsEvent).filter(EhsEvent.risk_severity == "CRITICAL", EhsEvent.action_status == "OPEN").order_by(EhsEvent.event_ts.desc()).all()
    for e in crit:
        key = f"event:{e.ehs_event_id}"
        if key in have or created_events >= cap:
            continue
        g = guidance_for(e.hazard_category.upper())
        spec = dict(
            dedupe_key=key,
            source_type="ehs_event",
            source_ref=e.ehs_event_id,
            scenario=e.event_type.lower(),
            category=_label(e.hazard_category),
            severity="CRITICAL",
            title=f"{_label(e.event_type)} – {_label(e.hazard_category)} hazard in {e.area}",
            plant_id=e.plant_id,
            location=f"{e.area} ({e.plant_id})",
            detected_at=e.event_ts,
            detection_source="EHS event register (verified record)",
            description=" ".join(_event_facts(e, today)[:1]),
            facts_json=_json(_event_facts(e, today)),
            evidence_json=_json({"record_id": e.ehs_event_id, "note": "Register record; no image or video is attached to this event."}),
            confidence=None,
            confidence_note="Not applicable: this alert comes from a recorded event, not an AI detection.",
            why_dangerous=g["why"],
            consequences=g["consequences"],
            immediate_action=g["immediate"],
            corrective_action=g["corrective"],
            responsible_team=g["team"],
            responsible_person=e.action_owner,
        )
        create_alert(db, spec, notify=False)
        created_events += 1

    # recurring high/critical hazards at the same place
    since = datetime.utcnow() - timedelta(days=int(rules["recurrence_window_days"]))
    groups: Dict[Tuple[str, str, str], List[EhsEvent]] = {}
    for e in db.query(EhsEvent).filter(EhsEvent.risk_severity.in_(("CRITICAL", "HIGH")), EhsEvent.event_ts >= since).all():
        groups.setdefault((e.plant_id, e.area, e.hazard_category), []).append(e)
    created_recur = 0
    for (plant, area, cat), evs in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        if len(evs) < int(rules["recurrence_threshold"]):
            continue
        key = f"recur:{plant}:{area}:{cat}"
        if key in have or created_recur >= cap:
            continue
        g = guidance_for("RECURRENCE")
        evs.sort(key=lambda x: x.event_ts, reverse=True)
        facts = [
            f"{len(evs)} high or critical {_label(cat)} events at {area} ({plant}) in the last {rules['recurrence_window_days']} days.",
            "Most recent: " + ", ".join(f"{x.ehs_event_id} ({x.event_ts:%d %b})" for x in evs[:5]) + ".",
        ]
        spec = dict(
            dedupe_key=key,
            source_type="recurrence",
            source_ref=f"{plant}|{area}|{cat}",
            scenario="recurring_hazard",
            category=_label(cat),
            severity="HIGH",
            title=f"Recurring {_label(cat)} hazard at {area}",
            plant_id=plant,
            location=f"{area} ({plant})",
            detected_at=evs[0].event_ts,
            detection_source="Recurrence rule over the EHS event register",
            description=facts[0],
            facts_json=_json(facts),
            evidence_json=_json({"event_ids": [x.ehs_event_id for x in evs[:10]]}),
            confidence=None,
            confidence_note="Not applicable: rule-based from recorded events.",
            why_dangerous=g["why"],
            consequences=g["consequences"],
            immediate_action=g["immediate"],
            corrective_action=g["corrective"],
            responsible_team=g["team"],
        )
        create_alert(db, spec, notify=False)
        created_recur += 1

    total = created_events + created_recur
    if total:  # one summary notification instead of one per historical record
        _notify(
            db,
            dedupe=f"sync-summary:{today.isoformat()}:{total}",
            kind="ALERT",
            severity="HIGH",
            title=f"{total} safety alerts raised from the event register",
            message=f"{created_events} critical open events and {created_recur} recurring-hazard locations need review.",
            target_type="alert",
            target_ref=None,
            plant_id="ALL",
        )
        db.commit()
    return {"critical_event_alerts": created_events, "recurrence_alerts": created_recur}


# ----------------------------------------------------------------------------- workflow
class WorkflowError(ValueError):
    pass


def transition(db: Session, alert: SafetyAlert, to_status: str, actor: str, note: Optional[str] = None) -> SafetyAlert:
    frm = alert.status
    note_clean = (note or "").strip() or None
    if to_status not in TRANSITIONS.get(frm, ()):
        raise WorkflowError(f"An alert in status {frm} cannot move to {to_status}.")
    if to_status == "DISMISSED" and (not note_clean or len(note_clean) < 5):
        raise WorkflowError("A reason of at least 5 characters is required to dismiss an alert.")
    if to_status == "RESOLVED" and (not note_clean or len(note_clean) < 3):
        raise WorkflowError("A resolution note is required to resolve an alert.")
    now = datetime.utcnow()
    alert.status = to_status
    alert.updated_at = now
    if to_status == "ACKNOWLEDGED" or (frm == "NEW" and alert.acknowledged_at is None):
        alert.acknowledged_at = now
    if to_status == "RESOLVED":
        alert.resolved_at = now
    if to_status == "DISMISSED":
        alert.dismissed_at = now
        alert.dismissal_reason = note_clean
    _activity(db, alert.alert_id, actor, "STATUS_CHANGED", frm, to_status, note_clean)
    db.commit()
    return alert


# ----------------------------------------------------------------------------- reminders
def _level(overdue_minutes: float, interval_minutes: int, max_level: int) -> int:
    return int(min(max_level, 1 + overdue_minutes // max(1, interval_minutes)))


def run_reminder_cycle(db: Session, now: Optional[datetime] = None) -> Dict[str, int]:
    """
    Evaluate active alerts and overdue CAPAs. One notification per (alert, reason, escalation level)
    and one CAPA digest per plant per day, so repeated cycles never spam. Resolved and dismissed
    alerts are never reminded.
    """
    rules = load_rules()
    now = now or datetime.utcnow()
    roles = rules["escalation_roles"]
    max_level = len(roles)
    counts = {"reminders": 0, "escalations": 0, "capa_digests": 0}

    pending: List[Tuple[SafetyAlert, str, datetime, int, str, str]] = []
    for a in db.query(SafetyAlert).filter(SafetyAlert.status.in_(ACTIVE_STATUSES)).all():
        interval = int(rules["escalation_interval_minutes"][a.severity])
        reason = due = None
        if a.status == "NEW" and a.response_due_at and now > a.response_due_at:
            reason, due = "not acknowledged in time", a.response_due_at
        elif a.status != "NEW" and a.resolution_due_at and now > a.resolution_due_at and a.severity in ("CRITICAL", "HIGH"):
            reason, due = "unresolved past its target date", a.resolution_due_at
        if not reason:
            continue
        level = _level((now - due).total_seconds() / 60, interval, max_level)
        tag = f"{reason[:3]}:{level}"
        note_text = f"Level {level} ({roles[level - 1]}): {reason}."
        # state-based de-duplication: one reminder per (alert, reason, level), recorded in the alert's own history
        already = (
            db.query(AlertActivity.activity_id)
            .filter(AlertActivity.alert_id == a.alert_id, AlertActivity.action.in_(("REMINDER", "ESCALATED")), AlertActivity.note == note_text)
            .first()
        )
        if already:
            continue
        pending.append((a, reason, due, level, roles[level - 1], tag))

    for a, reason, due, level, recipient, tag in pending:
        a.escalation_level = max(a.escalation_level or 0, level)
        a.last_reminder_at = now
        _activity(db, a.alert_id, SYSTEM_ACTOR, "ESCALATED" if level > 1 else "REMINDER", None, None, f"Level {level} ({recipient}): {reason}.")
        counts["escalations" if level > 1 else "reminders"] += 1

    if len(pending) <= DIGEST_THRESHOLD:
        for a, reason, due, level, recipient, tag in pending:
            _notify(
                db,
                dedupe=f"rem:{a.alert_id}:{tag}",
                kind="ESCALATION" if level > 1 else "REMINDER",
                severity=a.severity,
                title=f"{'Escalation' if level > 1 else 'Reminder'} L{level}: {a.title}",
                message=f"{a.severity.title()} alert {a.alert_id} is {reason} (due {due:%d %b %H:%M} UTC). Escalated to: {recipient}.",
                target_type="alert",
                target_ref=a.alert_id,
                plant_id=a.plant_id,
                alert_id=a.alert_id,
                level=level,
                recipient=recipient,
            )
    else:  # a burst (e.g. a backlog going overdue together) becomes one digest per plant and level
        groups: Dict[Tuple[str, int], List[Tuple[SafetyAlert, str]]] = {}
        for a, reason, due, level, recipient, tag in pending:
            groups.setdefault((a.plant_id, level), []).append((a, reason))
        for (plant, level), items in groups.items():
            worst = min(items, key=lambda it: SEVERITY_ORDER.index(it[0].severity))[0].severity
            top = ", ".join(f"{x.alert_id}" for x, _ in items[:3])
            _notify(
                db,
                dedupe=f"rem-digest:{plant}:{level}:{items[0][0].alert_id}",
                kind="ESCALATION" if level > 1 else "REMINDER",
                severity=worst,
                title=f"{len(items)} overdue safety alerts escalated to {roles[level - 1]} ({plant})",
                message=f"{len(items)} alerts are past their response or resolution target (level {level}). Highest priority first: {top}.",
                target_type="alert",
                target_ref=items[0][0].alert_id,
                plant_id=plant,
                alert_id=None,
                level=level,
                recipient=roles[level - 1],
            )
    db.commit()

    # overdue corrective actions: one digest per plant per day
    summary = capa_overdue(db, now=now)
    by_plant: Dict[str, List[Dict[str, Any]]] = {}
    for item in summary["items"]:
        if item["risk_severity"] in ("CRITICAL", "HIGH"):
            by_plant.setdefault(item["plant_id"], []).append(item)
    for plant, items in by_plant.items():
        worst = max(i["escalation_level"] for i in items)
        if worst == 0:
            continue
        top = ", ".join(f"{i['event_id']} ({i['days_overdue']}d, {i['owner']})" for i in items[:3])
        n = _notify(
            db,
            dedupe=f"capa-overdue:{plant}:{now:%Y-%m-%d}",
            kind="CAPA_OVERDUE",
            severity="CRITICAL" if any(i["risk_severity"] == "CRITICAL" for i in items) else "HIGH",
            title=f"{len(items)} high-risk corrective actions overdue at {plant}",
            message=f"Most overdue: {top}. Escalation level {worst}: {roles[worst - 1]}.",
            target_type="capa",
            target_ref=plant,
            plant_id=plant,
            level=worst,
            recipient=roles[worst - 1],
        )
        if n is not None:
            counts["capa_digests"] += 1
    db.commit()
    return counts


def capa_overdue(db: Session, now: Optional[datetime] = None, plant: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    """Overdue corrective actions (not closed, past due date) with escalation level by days overdue."""
    rules = load_rules()
    today = (now or datetime.utcnow()).date()
    roles = rules["escalation_roles"]
    thresholds = rules["capa_escalation_days"]
    q = db.query(EhsEvent).filter(EhsEvent.action_status != "CLOSED", EhsEvent.due_date < today)
    if plant:
        q = q.filter(EhsEvent.plant_id == plant)
    rows = q.all()
    items = []
    for e in rows:
        days = (today - e.due_date).days
        level = sum(1 for t in thresholds if days > t)
        items.append(
            {
                "event_id": e.ehs_event_id,
                "plant_id": e.plant_id,
                "area": e.area,
                "hazard_category": e.hazard_category,
                "risk_severity": e.risk_severity,
                "action_status": e.action_status,
                "owner": e.action_owner,
                "due_date": e.due_date.isoformat(),
                "days_overdue": days,
                "escalation_level": level,
                "escalated_to": roles[level - 1] if level else None,
            }
        )
    items.sort(key=lambda i: (-i["escalation_level"], i["risk_severity"] != "CRITICAL", -i["days_overdue"]))
    return {
        "total_overdue": len(items),
        "critical_or_high": sum(1 for i in items if i["risk_severity"] in ("CRITICAL", "HIGH")),
        "by_escalation_level": {str(l): sum(1 for i in items if i["escalation_level"] == l) for l in range(0, len(roles) + 1)},
        "items": items[:limit] if limit else items,
    }


def mark_read(db: Session, user_id: str, notification_ids: List[str]) -> int:
    have = {r[0] for r in db.query(NotificationRead.notification_id).filter(NotificationRead.user_id == user_id, NotificationRead.notification_id.in_(notification_ids)).all()}
    n = 0
    for nid in notification_ids:
        if nid in have:
            continue
        db.add(NotificationRead(notification_id=nid, user_id=user_id, read_at=datetime.utcnow()))
        n += 1
    db.commit()
    return n


def sync_review(db: Session, analysis_id: str, decision: str, comment: Optional[str], actor: str) -> Optional[SafetyAlert]:
    """Reflect a human video-review decision on the alert raised for that analysis."""
    alert = db.query(SafetyAlert).filter(SafetyAlert.source_type == "video_analysis", SafetyAlert.source_ref == analysis_id).first()
    if not alert:
        return None
    note = (comment or "").strip()
    if alert.status in TERMINAL_STATUSES:
        _activity(db, alert.alert_id, actor, "REVIEW", alert.status, alert.status, f"Human review {decision.lower()} (alert already {alert.status.lower()}). {note}".strip())
        db.commit()
        return alert
    if decision == "DISMISSED":
        reason = note if len(note) >= 5 else "Dismissed as a false positive in human video review."
        transition(db, alert, "DISMISSED", actor, reason)
    elif alert.status == "NEW":
        transition(db, alert, "ACKNOWLEDGED", actor, f"Human review confirmed the detection. {note}".strip())
    else:
        _activity(db, alert.alert_id, actor, "REVIEW", alert.status, alert.status, f"Human review confirmed the detection. {note}".strip())
        db.commit()
    return alert
