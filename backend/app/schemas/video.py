from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel

VideoUseCaseType = Literal[
    "fall_detection",
    "smoke_fire",
    "exit_obstruction",
    "forklift_pedestrian",
    "machinery_proximity",
    "unsafe_climbing",
]


class VideoModelAvailability(BaseModel):
    use_case: VideoUseCaseType
    title: str
    configured: bool
    model_name: Optional[str] = None
    backend_runtime: str
    message: str
    confidence_supported: bool = True


class VideoDetectionEvent(BaseModel):
    frame: int
    timestamp_sec: float
    state: str
    label: Optional[str] = None
    confidence: Optional[float] = None
    summary: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None


class VideoAnalysisResponse(BaseModel):
    analysis_id: str
    use_case: VideoUseCaseType
    video_id: Optional[str] = None
    plant_id: str
    filename: str
    duration_sec: Optional[float] = None
    status: str
    progress_pct: int = 0
    frames_processed: int = 0
    total_frames: Optional[int] = None
    current_stage: Optional[str] = None
    event_detected: bool
    event_label: Optional[str] = None
    event_timestamp_sec: Optional[float] = None
    detection_events: List[VideoDetectionEvent] = []
    confidence: Optional[float] = None
    confidence_note: Optional[str] = None
    evidence_frame_url: Optional[str] = None
    annotated_video_url: Optional[str] = None
    human_review_status: str = "PENDING_REVIEW"
    human_review_comment: Optional[str] = None
    model_used: Optional[str] = None
    summary: str
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VideoReviewUpdateRequest(BaseModel):
    human_review_status: Literal["CONFIRMED", "DISMISSED"]
    comment: Optional[str] = None


class VideoLibraryItem(BaseModel):
    video_id: str
    use_case: VideoUseCaseType
    use_case_title: str
    title: str
    filename: str
    extension: str
    duration_sec: Optional[float] = None
    file_size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    available: bool
    stream_url: str


class VideoLibraryGroup(BaseModel):
    use_case: VideoUseCaseType
    title: str
    description: str
    model_status: VideoModelAvailability
    videos: List[VideoLibraryItem] = []


class VideoLibraryResponse(BaseModel):
    total_videos: int
    configured_models_count: int
    total_scenarios_count: int
    groups: List[VideoLibraryGroup]


class VideoLibraryAnalyzeRequest(BaseModel):
    plant_id: str = "ALL"
