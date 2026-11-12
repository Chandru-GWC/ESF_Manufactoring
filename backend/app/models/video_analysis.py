from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Index, Integer, String, Text
from app.core.database import Base


class VideoSafetyAnalysis(Base):
    """
    Persisted video safety detection results across all supported Video Safety AI
    scenarios and server-side video library entries. Zero fabricated detections or scores.
    """

    __tablename__ = "video_safety_analyses"
    __table_args__ = (
        Index("ix_video_safety_use_case_created", "use_case", "created_at"),
        Index("ix_video_safety_plant_created", "plant_id", "created_at"),
        Index("ix_video_safety_video_id", "video_id"),
        {"schema": "ehs_core"},
    )

    analysis_id = Column(String(40), primary_key=True, index=True)
    use_case = Column(String(40), nullable=False, index=True)
    video_id = Column(String(64), nullable=True, index=True)
    plant_id = Column(String(50), nullable=False, default="ALL")
    filename = Column(String(255), nullable=False)
    duration_sec = Column(Float, nullable=True)
    status = Column(String(40), nullable=False)
    progress_pct = Column(Integer, nullable=False, default=0)
    frames_processed = Column(Integer, nullable=False, default=0)
    total_frames = Column(Integer, nullable=True)
    current_stage = Column(String(120), nullable=True)
    event_detected = Column(Boolean, nullable=False, default=False)
    event_label = Column(String(120), nullable=True)
    event_timestamp_sec = Column(Float, nullable=True)
    detection_events_json = Column(Text, nullable=True)
    confidence = Column(Float, nullable=True)
    confidence_note = Column(String(255), nullable=True)
    evidence_frame_path = Column(String(500), nullable=True)
    annotated_video_path = Column(String(500), nullable=True)
    human_review_status = Column(String(40), nullable=False, default="PENDING_REVIEW")
    human_review_comment = Column(Text, nullable=True)
    model_used = Column(String(160), nullable=True)
    summary = Column(Text, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
