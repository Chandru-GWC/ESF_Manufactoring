"""Persisted safety alerts, their activity history and in-app notifications (schema ehs_core)."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Index, Integer, String, Text

from app.core.database import Base


class SafetyAlert(Base):
    """
    A safety alert generated from a real detection result, a validated EHS event record or a
    configured business rule. `dedupe_key` guarantees one alert per underlying event.
    """

    __tablename__ = "safety_alerts"
    __table_args__ = (
        Index("ix_alert_status_sev", "status", "severity"),
        Index("ix_alert_plant", "plant_id", "detected_at"),
        Index("ix_alert_source", "source_type", "source_ref"),
        {"schema": "ehs_core"},
    )

    alert_id = Column(String(40), primary_key=True)
    dedupe_key = Column(String(160), nullable=False, unique=True)
    source_type = Column(String(30), nullable=False)  # video_analysis | ehs_event | recurrence
    source_ref = Column(String(120), nullable=False)
    scenario = Column(String(60), nullable=False)
    category = Column(String(80), nullable=False)
    severity = Column(String(10), nullable=False)  # CRITICAL | HIGH | MEDIUM | LOW
    title = Column(String(240), nullable=False)
    plant_id = Column(String(50), nullable=False, default="ALL")
    location = Column(String(160), nullable=True)
    detected_at = Column(DateTime, nullable=False)
    detection_source = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)  # detected facts, plain text
    facts_json = Column(Text, nullable=True)  # list[str] of verified facts
    evidence_json = Column(Text, nullable=True)  # image_url, video_url, source video, timestamp
    confidence = Column(Float, nullable=True)  # only when the model genuinely reports one
    confidence_note = Column(String(240), nullable=True)
    why_dangerous = Column(Text, nullable=True)  # rule-based guidance (not a detected fact)
    consequences = Column(Text, nullable=True)
    immediate_action = Column(Text, nullable=True)
    corrective_action = Column(Text, nullable=True)
    responsible_team = Column(String(160), nullable=True)
    responsible_person = Column(String(120), nullable=True)
    status = Column(String(24), nullable=False, default="NEW")
    response_due_at = Column(DateTime, nullable=True)
    resolution_due_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
    dismissal_reason = Column(Text, nullable=True)
    escalation_level = Column(Integer, nullable=False, default=0)
    last_reminder_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AlertActivity(Base):
    """Append-only history of everything that happened to an alert."""

    __tablename__ = "safety_alert_activity"
    __table_args__ = (Index("ix_alert_activity_alert", "alert_id", "ts"), {"schema": "ehs_core"})

    activity_id = Column(String(40), primary_key=True)
    alert_id = Column(String(40), nullable=False)
    ts = Column(DateTime, nullable=False, default=datetime.utcnow)
    actor = Column(String(160), nullable=False)
    action = Column(String(40), nullable=False)  # CREATED | STATUS_CHANGED | REMINDER | ESCALATED | REVIEW
    from_status = Column(String(24), nullable=True)
    to_status = Column(String(24), nullable=True)
    note = Column(Text, nullable=True)


class AppNotification(Base):
    """In-app notification. Delivery channel is always `in_app` (no email/SMS provider is configured)."""

    __tablename__ = "app_notifications"
    __table_args__ = (Index("ix_notif_created", "created_at"), {"schema": "ehs_core"})

    notification_id = Column(String(40), primary_key=True)
    dedupe_key = Column(String(200), nullable=False, unique=True)
    kind = Column(String(20), nullable=False)  # ALERT | REMINDER | ESCALATION | CAPA_OVERDUE
    severity = Column(String(10), nullable=False)
    title = Column(String(240), nullable=False)
    message = Column(Text, nullable=False)
    alert_id = Column(String(40), nullable=True)
    target_type = Column(String(20), nullable=False)  # alert | capa | event
    target_ref = Column(String(120), nullable=True)
    plant_id = Column(String(50), nullable=False, default="ALL")
    escalation_level = Column(Integer, nullable=False, default=0)
    recipient = Column(String(160), nullable=True)  # responsible team / role for this level
    channel = Column(String(20), nullable=False, default="in_app")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class NotificationRead(Base):
    """Per-user read marker so each safety officer has their own unread count."""

    __tablename__ = "app_notification_reads"
    __table_args__ = {"schema": "ehs_core"}

    notification_id = Column(String(40), primary_key=True)
    user_id = Column(String(60), primary_key=True)
    read_at = Column(DateTime, nullable=False, default=datetime.utcnow)
