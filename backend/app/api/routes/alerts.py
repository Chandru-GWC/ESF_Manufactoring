"""Safety alerts, alert workflow, CAPA overdue tracking and the in-app notification centre."""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ACTOR, plant_filter
from app.models.alert import AlertActivity, AppNotification, NotificationRead, SafetyAlert
from app.services.alerts import service
from app.services.alerts.rules import ACTIVE_STATUSES, ALL_STATUSES, SEVERITIES, TRANSITIONS, load_rules

logger = logging.getLogger("ehs.alerts.api")
router = APIRouter(prefix="/alerts", tags=["Safety Alerts"])
notification_router = APIRouter(prefix="/notifications", tags=["Notifications"])

_SEV_RANK = {s: i for i, s in enumerate(SEVERITIES)}
_LAST_SYNC = {"at": 0.0}
_SYNC_EVERY_SECONDS = 120


def _ensure(db: Session) -> None:
    service.ensure_alert_tables(db.get_bind())


def _maybe_sync(db: Session) -> None:
    """Keep event-derived alerts current without a separate trigger (rate limited)."""
    if time.time() - _LAST_SYNC["at"] < _SYNC_EVERY_SECONDS:
        return
    _LAST_SYNC["at"] = time.time()
    if db.get_bind().dialect.name == "postgresql":
        # The sync issues many queries against a distant database (10+ s). Run it in the background so the
        # request that happened to trigger it (bell, alert list) is not delayed.
        import threading

        from app.core.database import SessionLocal

        def _background() -> None:
            bg = SessionLocal()
            try:
                service.sync_event_alerts(bg)
            except Exception:
                bg.rollback()
                logger.exception("Event alert sync failed")
            finally:
                bg.close()

        threading.Thread(target=_background, name="alert-sync", daemon=True).start()
        return
    try:
        service.sync_event_alerts(db)
    except Exception:  # the register may be unavailable; never break reads
        db.rollback()
        logger.exception("Event alert sync failed")


def _loads(raw: Optional[str], default: Any) -> Any:
    try:
        return json.loads(raw) if raw else default
    except ValueError:
        return default


def _alert_dict(a: SafetyAlert, now: Optional[datetime] = None) -> Dict[str, Any]:
    now = now or datetime.utcnow()
    active = a.status in ACTIVE_STATUSES
    response_overdue = bool(active and a.status == "NEW" and a.response_due_at and now > a.response_due_at)
    resolution_overdue = bool(active and a.status != "NEW" and a.resolution_due_at and now > a.resolution_due_at)
    return {
        "alert_id": a.alert_id,
        "title": a.title,
        "severity": a.severity,
        "status": a.status,
        "scenario": a.scenario,
        "category": a.category,
        "source_type": a.source_type,
        "source_ref": a.source_ref,
        "plant_id": a.plant_id,
        "location": a.location,
        "detected_at": a.detected_at.isoformat() if a.detected_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "detection_source": a.detection_source,
        "description": a.description,
        "confidence": a.confidence,
        "confidence_note": a.confidence_note,
        "responsible_team": a.responsible_team,
        "responsible_person": a.responsible_person,
        "response_due_at": a.response_due_at.isoformat() if a.response_due_at else None,
        "resolution_due_at": a.resolution_due_at.isoformat() if a.resolution_due_at else None,
        "response_overdue": response_overdue,
        "resolution_overdue": resolution_overdue,
        "overdue": response_overdue or resolution_overdue,
        "escalation_level": a.escalation_level or 0,
        "last_reminder_at": a.last_reminder_at.isoformat() if a.last_reminder_at else None,
        "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        "dismissed_at": a.dismissed_at.isoformat() if a.dismissed_at else None,
        "dismissal_reason": a.dismissal_reason,
        "is_active": active,
        "next_statuses": list(TRANSITIONS.get(a.status, ())),
    }


def _alert_detail(db: Session, a: SafetyAlert) -> Dict[str, Any]:
    data = _alert_dict(a)
    acts = db.query(AlertActivity).filter(AlertActivity.alert_id == a.alert_id).order_by(AlertActivity.ts.asc()).all()
    notes = db.query(AppNotification).filter(AppNotification.alert_id == a.alert_id).order_by(AppNotification.created_at.asc()).all()
    data.update(
        {
            # verified facts vs. rule-based guidance are kept apart so the UI never blurs them
            "facts": _loads(a.facts_json, []),
            "evidence": _loads(a.evidence_json, {}),
            "guidance": {
                "label": "Standard EHS guidance for this hazard type — not a detection result.",
                "why_dangerous": a.why_dangerous,
                "consequences": a.consequences,
                "immediate_action": a.immediate_action,
                "corrective_action": a.corrective_action,
            },
            "activity": [
                {"ts": x.ts.isoformat(), "actor": x.actor, "action": x.action, "from_status": x.from_status, "to_status": x.to_status, "note": x.note}
                for x in acts
            ],
            "notifications": [
                {"notification_id": n.notification_id, "kind": n.kind, "level": n.escalation_level, "recipient": n.recipient, "channel": n.channel, "created_at": n.created_at.isoformat(), "title": n.title}
                for n in notes
            ],
            "delivery_note": "Notifications are in-app only. Email, SMS and push are not configured.",
        }
    )
    return data


def _scoped_query(db: Session, plant_id: Optional[str]):
    q = db.query(SafetyAlert)
    plant = plant_filter(plant_id)
    if plant:
        q = q.filter(SafetyAlert.plant_id == plant)
    return q


def _get_alert_or_404(db: Session, alert_id: str) -> SafetyAlert:
    a = db.query(SafetyAlert).filter(SafetyAlert.alert_id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return a


# ----------------------------------------------------------------------------- alerts
@router.get("")
def list_alerts(
    status: Optional[str] = Query(None, description="Comma-separated statuses"),
    severity: Optional[str] = Query(None, description="Comma-separated severities"),
    plant_id: Optional[str] = None,
    scenario: Optional[str] = None,
    source_ref: Optional[str] = None,
    q: Optional[str] = Query(None, description="Search title, location, id"),
    active_only: bool = False,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    _ensure(db)
    _maybe_sync(db)
    query = _scoped_query(db, plant_id)
    if status:
        wanted = [s.strip().upper() for s in status.split(",") if s.strip()]
        if any(s not in ALL_STATUSES for s in wanted):
            raise HTTPException(status_code=422, detail="Unknown status filter.")
        query = query.filter(SafetyAlert.status.in_(wanted))
    if active_only:
        query = query.filter(SafetyAlert.status.in_(ACTIVE_STATUSES))
    if severity:
        sev = [s.strip().upper() for s in severity.split(",") if s.strip()]
        if any(s not in SEVERITIES for s in sev):
            raise HTTPException(status_code=422, detail="Unknown severity filter.")
        query = query.filter(SafetyAlert.severity.in_(sev))
    if scenario:
        query = query.filter(SafetyAlert.scenario == scenario)
    if source_ref:
        # an analysis that re-detected an already-alerted event is folded into the original alert
        folded = [
            r[0]
            for r in db.query(AlertActivity.alert_id)
            .filter(AlertActivity.action == "REDETECTED", AlertActivity.note.like(f"%analysis {source_ref}%"))
            .all()
        ]
        query = query.filter(or_(SafetyAlert.source_ref == source_ref, SafetyAlert.alert_id.in_(folded or [""])))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(SafetyAlert.title.ilike(like), SafetyAlert.location.ilike(like), SafetyAlert.alert_id.ilike(like), SafetyAlert.source_ref.ilike(like)))
    rows = query.all()
    now = datetime.utcnow()
    rows.sort(key=lambda a: (a.status not in ACTIVE_STATUSES, _SEV_RANK.get(a.severity, 9), -(a.detected_at.timestamp() if a.detected_at else 0)))
    return {"total": len(rows), "items": [_alert_dict(a, now) for a in rows[offset : offset + limit]]}


@router.get("/summary")
def alert_summary(
    plant_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _ensure(db)
    _maybe_sync(db)
    now = datetime.utcnow()
    rows = _scoped_query(db, plant_id).all()
    active = [a for a in rows if a.status in ACTIVE_STATUSES]
    by_plant: Dict[str, Dict[str, int]] = {}
    for a in active:
        p = by_plant.setdefault(a.plant_id, {s: 0 for s in SEVERITIES})
        p[a.severity] += 1
    return {
        "total": len(rows),
        "active": len(active),
        "active_by_severity": {s: sum(1 for a in active if a.severity == s) for s in SEVERITIES},
        "by_status": {s: sum(1 for a in rows if a.status == s) for s in ALL_STATUSES},
        "overdue": sum(1 for a in active if _alert_dict(a, now)["overdue"]),
        "unacknowledged_critical": sum(1 for a in active if a.severity == "CRITICAL" and a.status == "NEW"),
        "by_plant": by_plant,
        "high_risk_areas": _top_locations(active),
    }


def _top_locations(active: List[SafetyAlert]) -> List[Dict[str, Any]]:
    agg: Dict[str, Dict[str, Any]] = {}
    for a in active:
        key = a.location or a.plant_id
        d = agg.setdefault(key, {"location": key, "plant_id": a.plant_id, "count": 0, "critical": 0})
        d["count"] += 1
        d["critical"] += 1 if a.severity == "CRITICAL" else 0
    return sorted(agg.values(), key=lambda d: (-d["critical"], -d["count"]))[:5]


@router.get("/activity")
def recent_activity(
    limit: int = Query(10, ge=1, le=50),
    plant_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _ensure(db)
    allowed = {a.alert_id: a for a in _scoped_query(db, plant_id).all()}
    if not allowed:
        return []
    acts = db.query(AlertActivity).filter(AlertActivity.alert_id.in_(list(allowed))).order_by(AlertActivity.ts.desc()).limit(limit).all()
    return [
        {"ts": x.ts.isoformat(), "actor": x.actor, "action": x.action, "to_status": x.to_status, "note": x.note, "alert_id": x.alert_id, "alert_title": allowed[x.alert_id].title, "severity": allowed[x.alert_id].severity}
        for x in acts
    ]


@router.get("/rules")
def alert_rules():
    rules = load_rules()
    return {**rules, "statuses": list(ALL_STATUSES), "transitions": {k: list(v) for k, v in TRANSITIONS.items()}, "delivery": "in_app only (no email/SMS/push provider configured)"}


@router.get("/capa-overdue")
def capa_overdue(
    plant_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return service.capa_overdue(db, plant=plant_filter(plant_id), limit=limit)


@router.post("/sync")
def sync_alerts(db: Session = Depends(get_db)):
    """Create alerts for critical open events and recurring hazards (idempotent)."""
    _ensure(db)
    _LAST_SYNC["at"] = time.time()
    return service.sync_event_alerts(db)


@router.post("/reminders/run")
def run_reminders(db: Session = Depends(get_db)):
    """Evaluate response windows and overdue CAPAs now (also runs automatically in the background)."""
    _ensure(db)
    return service.run_reminder_cycle(db)


class TransitionRequest(BaseModel):
    status: Literal["ACKNOWLEDGED", "UNDER_INVESTIGATION", "ACTION_REQUIRED", "RESOLVED", "DISMISSED"]
    note: Optional[str] = Field(None, max_length=2000, description="Required for RESOLVED and DISMISSED (reason)")


@router.get("/{alert_id}")
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    _ensure(db)
    return _alert_detail(db, _get_alert_or_404(db, alert_id))


@router.post("/{alert_id}/transition")
def transition_alert(
    alert_id: str,
    payload: TransitionRequest,
    db: Session = Depends(get_db),
):
    _ensure(db)
    alert = _get_alert_or_404(db, alert_id)
    try:
        service.transition(db, alert, payload.status, ACTOR, payload.note)
    except service.WorkflowError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _alert_detail(db, alert)


# ----------------------------------------------------------------------------- notifications
class ReadRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1, max_length=200)


def _visible_notifications(db: Session):
    return db.query(AppNotification)


@notification_router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=200),
    unread_only: bool = False,
    db: Session = Depends(get_db),
):
    _ensure(db)
    _maybe_sync(db)
    rows = _visible_notifications(db).order_by(AppNotification.created_at.desc()).limit(500).all()
    read = {r[0] for r in db.query(NotificationRead.notification_id).filter(NotificationRead.user_id == ACTOR).all()}
    items = [
        {
            "notification_id": n.notification_id,
            "kind": n.kind,
            "severity": n.severity,
            "title": n.title,
            "message": n.message,
            "alert_id": n.alert_id,
            "target_type": n.target_type,
            "target_ref": n.target_ref,
            "plant_id": n.plant_id,
            "escalation_level": n.escalation_level,
            "recipient": n.recipient,
            "channel": n.channel,
            "created_at": n.created_at.isoformat(),
            "read": n.notification_id in read,
        }
        for n in rows
    ]
    unread = sum(1 for i in items if not i["read"])
    if unread_only:
        items = [i for i in items if not i["read"]]
    return {"unread_count": unread, "unread_critical_or_high": sum(1 for i in items if not i["read"] and i["severity"] in ("CRITICAL", "HIGH")), "items": items[:limit]}


@notification_router.post("/read")
def read_notifications(payload: ReadRequest, db: Session = Depends(get_db)):
    _ensure(db)
    visible = {r[0] for r in _visible_notifications(db).filter(AppNotification.notification_id.in_(payload.ids)).with_entities(AppNotification.notification_id).all()}
    return {"marked": service.mark_read(db, ACTOR, list(visible))}


@notification_router.post("/read-all")
def read_all_notifications(db: Session = Depends(get_db)):
    _ensure(db)
    ids = [r[0] for r in _visible_notifications(db).with_entities(AppNotification.notification_id).all()]
    return {"marked": service.mark_read(db, ACTOR, ids) if ids else 0}
