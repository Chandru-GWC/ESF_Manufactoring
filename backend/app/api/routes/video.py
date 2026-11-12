import asyncio
import json
import os
import re
import shutil
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine, get_db
from app.models.video_analysis import VideoSafetyAnalysis
from app.schemas.video import (
    VideoAnalysisResponse,
    VideoDetectionEvent,
    VideoLibraryAnalyzeRequest,
    VideoLibraryResponse,
    VideoModelAvailability,
    VideoReviewUpdateRequest,
    VideoUseCaseType,
)
from app.services.video.config import (
    ALLOWED_VIDEO_EXTENSIONS,
    ANNOTATED_VIDEO_DIR,
    EVIDENCE_DIR,
    MAX_VIDEO_UPLOAD_BYTES,
    TEMP_VIDEO_DIR,
)
from app.services.video.exit_obstruction_service import analyze_exit_obstruction_video
from app.services.video.fall_detection_service import analyze_fall_video
from app.services.video.library_service import (
    get_all_model_statuses,
    get_model_status_map,
    list_video_library,
    resolve_video_by_id,
)
from app.services.video.smoke_fire_service import analyze_smoke_fire_video

router = APIRouter(prefix="/video", tags=["Video Safety Monitoring"])

_EVIDENCE_FILENAME_RE = re.compile(r"^[A-Za-z0-9_.-]+\.jpg$")
_ANNOTATED_FILENAME_RE = re.compile(r"^[A-Za-z0-9_.-]+\.mp4$")
_ACTIVE_TASKS: set[asyncio.Task[Any]] = set()
_ENSURED_ENGINES: set[int] = set()

_MIGRATION_COLUMNS: list[tuple[str, str]] = [
    ("video_id", "VARCHAR(64)"),
    ("progress_pct", "INTEGER NOT NULL DEFAULT 0"),
    ("frames_processed", "INTEGER NOT NULL DEFAULT 0"),
    ("total_frames", "INTEGER"),
    ("current_stage", "VARCHAR(120)"),
    ("detection_events_json", "TEXT"),
    ("annotated_video_path", "VARCHAR(500)"),
    ("human_review_comment", "TEXT"),
    ("completed_at", "TIMESTAMP"),
]


def _ensure_video_table() -> None:
    engine_id = id(engine)
    if engine_id in _ENSURED_ENGINES:
        return

    VideoSafetyAnalysis.__table__.create(bind=engine, checkfirst=True)
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            for col_name, col_ddl in _MIGRATION_COLUMNS:
                conn.execute(
                    text(
                        f"ALTER TABLE ehs_core.video_safety_analyses "
                        f"ADD COLUMN IF NOT EXISTS {col_name} {col_ddl}"
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_video_safety_video_id "
                    "ON ehs_core.video_safety_analyses (video_id)"
                )
            )
    else:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("video_safety_analyses")}
        with engine.begin() as conn:
            for col_name, col_ddl in _MIGRATION_COLUMNS:
                if col_name not in existing:
                    conn.execute(
                        text(
                            f"ALTER TABLE video_safety_analyses "
                            f"ADD COLUMN {col_name} {col_ddl}"
                        )
                    )

    _ENSURED_ENGINES.add(engine_id)


def _parse_detection_events(raw_json: Optional[str]) -> List[VideoDetectionEvent]:
    if not raw_json:
        return []
    try:
        items = json.loads(raw_json)
    except (ValueError, TypeError):
        return []
    if not isinstance(items, list):
        return []

    parsed: List[VideoDetectionEvent] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            parsed.append(VideoDetectionEvent(**item))
        except Exception:
            continue
    return parsed


def _to_response(row: VideoSafetyAnalysis) -> VideoAnalysisResponse:
    evidence_url = None
    if row.evidence_frame_path:
        basename = os.path.basename(row.evidence_frame_path)
        if os.path.exists(os.path.join(EVIDENCE_DIR, basename)):
            evidence_url = f"/api/v1/video/evidence/{basename}"

    annotated_url = None
    if row.annotated_video_path:
        annotated_name = os.path.basename(row.annotated_video_path)
        if os.path.exists(os.path.join(ANNOTATED_VIDEO_DIR, annotated_name)):
            annotated_url = f"/api/v1/video/annotated/{annotated_name}"

    return VideoAnalysisResponse(
        analysis_id=row.analysis_id,
        use_case=row.use_case,  # type: ignore[arg-type]
        video_id=row.video_id,
        plant_id=row.plant_id,
        filename=row.filename,
        duration_sec=row.duration_sec,
        status=row.status,
        progress_pct=row.progress_pct if row.progress_pct is not None else 0,
        frames_processed=row.frames_processed if row.frames_processed is not None else 0,
        total_frames=row.total_frames,
        current_stage=row.current_stage,
        event_detected=row.event_detected,
        event_label=row.event_label,
        event_timestamp_sec=row.event_timestamp_sec,
        detection_events=_parse_detection_events(row.detection_events_json),
        confidence=row.confidence,
        confidence_note=row.confidence_note,
        evidence_frame_url=evidence_url,
        annotated_video_url=annotated_url,
        human_review_status=row.human_review_status or "PENDING_REVIEW",
        human_review_comment=row.human_review_comment,
        model_used=row.model_used,
        summary=row.summary,
        error_message=row.error_message,
        created_at=row.created_at,
        completed_at=row.completed_at,
    )


def _get_status_for_use_case(use_case: VideoUseCaseType) -> VideoModelAvailability:
    status_map = get_model_status_map()
    if use_case in status_map:
        return status_map[use_case]
    raise HTTPException(status_code=404, detail=f"Unsupported video use case '{use_case}'.")


def _update_progress_sync(analysis_id: str, progress: Dict[str, Any]) -> None:
    db = SessionLocal()
    try:
        row = (
            db.query(VideoSafetyAnalysis)
            .filter(VideoSafetyAnalysis.analysis_id == analysis_id)
            .first()
        )
        if not row or row.status != "PROCESSING":
            return
        if isinstance(progress.get("frames_processed"), int):
            row.frames_processed = progress["frames_processed"]
        if isinstance(progress.get("total_frames"), int):
            row.total_frames = progress["total_frames"]
        if isinstance(progress.get("progress_pct"), int):
            row.progress_pct = max(0, min(99, progress["progress_pct"]))
        if isinstance(progress.get("stage"), str) and progress["stage"]:
            row.current_stage = progress["stage"][:120]
        if progress.get("duration_sec") is not None and row.duration_sec is None:
            row.duration_sec = float(progress["duration_sec"])
        db.commit()
    finally:
        db.close()


async def _run_video_analysis_job(
    analysis_id: str,
    use_case: VideoUseCaseType,
    safe_temp_path: str,
    evidence_abs_path: str,
    evidence_filename: str,
    annotated_abs_path: str,
    annotated_filename: str,
    fallback_model_name: Optional[str],
) -> None:
    async def on_progress(progress: Dict[str, Any]) -> None:
        _update_progress_sync(analysis_id, progress)

    try:
        if use_case == "fall_detection":
            result = await analyze_fall_video(
                safe_temp_path,
                evidence_abs_path,
                annotated_out_path=annotated_abs_path,
                on_progress=on_progress,
            )
        elif use_case == "smoke_fire":
            result = await analyze_smoke_fire_video(
                safe_temp_path,
                evidence_abs_path,
                annotated_out_path=annotated_abs_path,
                on_progress=on_progress,
            )
        elif use_case == "exit_obstruction":
            result = await analyze_exit_obstruction_video(
                safe_temp_path,
                evidence_abs_path,
                annotated_out_path=annotated_abs_path,
                on_progress=on_progress,
            )
        else:
            raise RuntimeError(f"Model not configured for video scenario '{use_case}'.")

        event_detected = bool(result.get("event_detected", False))
        evidence_saved = bool(result.get("evidence_saved", False)) and os.path.exists(evidence_abs_path)
        annotated_saved = bool(result.get("annotated_video_saved", False)) and os.path.exists(annotated_abs_path)
        events_list = result.get("detection_events")
        events_json = json.dumps(events_list if isinstance(events_list, list) else [])

        db = SessionLocal()
        try:
            row = (
                db.query(VideoSafetyAnalysis)
                .filter(VideoSafetyAnalysis.analysis_id == analysis_id)
                .first()
            )
            if row:
                row.duration_sec = result.get("duration_sec")
                row.status = "NEEDS_HUMAN_REVIEW" if event_detected else "COMPLETED"
                row.progress_pct = 100
                if isinstance(result.get("frames_processed"), int):
                    row.frames_processed = result["frames_processed"]
                if isinstance(result.get("total_frames"), int):
                    row.total_frames = result["total_frames"]
                row.current_stage = "Completed"
                row.event_detected = event_detected
                row.event_label = result.get("event_label")
                row.event_timestamp_sec = result.get("event_timestamp_sec")
                row.detection_events_json = events_json
                row.confidence = result.get("confidence")
                row.confidence_note = result.get("confidence_note")
                row.evidence_frame_path = evidence_filename if evidence_saved else None
                row.annotated_video_path = annotated_filename if annotated_saved else None
                row.human_review_status = row.human_review_status or "PENDING_REVIEW"
                row.model_used = result.get("model_used") or fallback_model_name
                row.summary = result.get("summary") or "Video analysis completed."
                row.error_message = None
                row.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()

    except Exception as exc:
        for artifact in (evidence_abs_path, annotated_abs_path):
            if os.path.exists(artifact):
                try:
                    os.remove(artifact)
                except OSError:
                    pass
        db = SessionLocal()
        try:
            row = (
                db.query(VideoSafetyAnalysis)
                .filter(VideoSafetyAnalysis.analysis_id == analysis_id)
                .first()
            )
            if row:
                row.status = "FAILED"
                row.current_stage = "Failed"
                row.summary = "Video analysis failed during inference."
                row.error_message = str(exc)
                row.completed_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()
    finally:
        if os.path.exists(safe_temp_path):
            try:
                os.remove(safe_temp_path)
            except OSError:
                pass


def _enqueue_analysis_job(
    *,
    db: Session,
    use_case: VideoUseCaseType,
    video_id: Optional[str],
    plant_id: str,
    filename: str,
    duration_sec: Optional[float],
    safe_temp_path: str,
    analysis_id: str,
    evidence_abs_path: str,
    evidence_filename: str,
    annotated_abs_path: str,
    annotated_filename: str,
    model_name: Optional[str],
    initial_summary: str,
) -> VideoAnalysisResponse:
    record = VideoSafetyAnalysis(
        analysis_id=analysis_id,
        use_case=use_case,
        video_id=video_id,
        plant_id=(plant_id or "ALL").upper(),
        filename=filename[:255],
        duration_sec=duration_sec,
        status="PROCESSING",
        progress_pct=0,
        frames_processed=0,
        total_frames=None,
        current_stage="Queued for CV worker execution",
        event_detected=False,
        human_review_status="PENDING_REVIEW",
        model_used=model_name,
        summary=initial_summary,
        error_message=None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    task = asyncio.create_task(
        _run_video_analysis_job(
            analysis_id=analysis_id,
            use_case=use_case,
            safe_temp_path=safe_temp_path,
            evidence_abs_path=evidence_abs_path,
            evidence_filename=evidence_filename,
            annotated_abs_path=annotated_abs_path,
            annotated_filename=annotated_filename,
            fallback_model_name=model_name,
        )
    )
    _ACTIVE_TASKS.add(task)
    task.add_done_callback(_ACTIVE_TASKS.discard)
    return _to_response(record)


@router.get("/models/status", response_model=List[VideoModelAvailability])
def list_video_model_status():
    """Return real backend availability across all 6 safety video scenarios."""
    return get_all_model_statuses()


@router.get("/library", response_model=VideoLibraryResponse)
def get_video_library():
    """Discover predefined video files grouped by safety scenario from server-side video_library/."""
    return list_video_library()


@router.get("/library/{video_id}/stream")
def stream_library_video(video_id: str):
    """Stream an approved server-side video library entry securely by opaque video_id."""
    entry = resolve_video_by_id(video_id)
    if not entry or not entry.available or not os.path.isfile(entry.abs_path):
        raise HTTPException(status_code=404, detail=f"Library video '{video_id}' not found.")
    return FileResponse(entry.abs_path, media_type=entry.mime_type, filename=entry.filename)


@router.post("/library/{video_id}/analyze", response_model=VideoAnalysisResponse)
async def analyze_library_video(
    video_id: str,
    payload: Optional[VideoLibraryAnalyzeRequest] = Body(default=None),
    db: Session = Depends(get_db),
):
    """Run real CV analysis on an approved server-side library video identified by video_id."""
    _ensure_video_table()
    entry = resolve_video_by_id(video_id)
    if not entry or not entry.available or not os.path.isfile(entry.abs_path):
        raise HTTPException(status_code=404, detail=f"Library video '{video_id}' not found.")

    model_status = _get_status_for_use_case(entry.use_case)
    if not model_status.configured:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_NOT_CONFIGURED",
                "message": model_status.message,
            },
        )

    analysis_id = f"VID-{uuid.uuid4().hex[:8].upper()}"
    safe_temp_path = os.path.join(TEMP_VIDEO_DIR, f"{analysis_id}{entry.extension}")
    evidence_filename = f"{analysis_id}_evidence.jpg"
    evidence_abs_path = os.path.join(EVIDENCE_DIR, evidence_filename)
    annotated_filename = f"{analysis_id}_annotated.mp4"
    annotated_abs_path = os.path.join(ANNOTATED_VIDEO_DIR, annotated_filename)

    copied = False
    try:
        shutil.copyfile(entry.abs_path, safe_temp_path)
        copied = True
        plant_id = payload.plant_id if payload else "ALL"
        return _enqueue_analysis_job(
            db=db,
            use_case=entry.use_case,
            video_id=entry.video_id,
            plant_id=plant_id,
            filename=entry.filename,
            duration_sec=entry.duration_sec,
            safe_temp_path=safe_temp_path,
            analysis_id=analysis_id,
            evidence_abs_path=evidence_abs_path,
            evidence_filename=evidence_filename,
            annotated_abs_path=annotated_abs_path,
            annotated_filename=annotated_filename,
            model_name=model_status.model_name,
            initial_summary=f"Analyzing library clip '{entry.filename}' ({entry.video_id}) with {model_status.model_name}...",
        )
    except Exception:
        if copied and os.path.exists(safe_temp_path):
            try:
                os.remove(safe_temp_path)
            except OSError:
                pass
        raise


@router.get("/analyses", response_model=List[VideoAnalysisResponse])
def list_video_analyses(
    plant_id: Optional[str] = None,
    limit: int = 25,
    db: Session = Depends(get_db),
):
    """Fetch persisted video safety analysis results from ehs_core.video_safety_analyses."""
    _ensure_video_table()
    query = db.query(VideoSafetyAnalysis)
    if plant_id and plant_id.upper() != "ALL":
        query = query.filter(VideoSafetyAnalysis.plant_id == plant_id.upper())
    rows = (
        query.order_by(VideoSafetyAnalysis.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return [_to_response(r) for r in rows]


@router.get("/analyses/{analysis_id}", response_model=VideoAnalysisResponse)
def get_video_analysis(
    analysis_id: str,
    db: Session = Depends(get_db),
):
    """Fetch a single video safety analysis job status and output details."""
    _ensure_video_table()
    row = (
        db.query(VideoSafetyAnalysis)
        .filter(VideoSafetyAnalysis.analysis_id == analysis_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Video analysis '{analysis_id}' not found.")
    return _to_response(row)


@router.post("/analyze/{use_case}", response_model=VideoAnalysisResponse)
async def analyze_uploaded_video(
    use_case: VideoUseCaseType,
    file: UploadFile = File(...),
    plant_id: str = Form("ALL"),
    db: Session = Depends(get_db),
):
    """Legacy/programmatic direct-upload inference endpoint preserved for API callers."""
    _ensure_video_table()

    model_status = _get_status_for_use_case(use_case)
    if not model_status.configured:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_NOT_CONFIGURED",
                "message": model_status.message,
            },
        )

    original_name = os.path.basename((file.filename or "").strip()) or "uploaded_video.mp4"
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext or 'unknown'}'. Allowed formats: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}.",
        )

    analysis_id = f"VID-{uuid.uuid4().hex[:8].upper()}"
    safe_temp_path = os.path.join(TEMP_VIDEO_DIR, f"{analysis_id}{ext}")
    evidence_filename = f"{analysis_id}_evidence.jpg"
    evidence_abs_path = os.path.join(EVIDENCE_DIR, evidence_filename)
    annotated_filename = f"{analysis_id}_annotated.mp4"
    annotated_abs_path = os.path.join(ANNOTATED_VIDEO_DIR, annotated_filename)

    total_bytes = 0
    upload_ok = False
    try:
        with open(safe_temp_path, "wb") as out_f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_VIDEO_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds maximum allowed size of {MAX_VIDEO_UPLOAD_BYTES // (1024 * 1024)} MB.",
                    )
                out_f.write(chunk)

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="Uploaded video file is empty.")

        res = _enqueue_analysis_job(
            db=db,
            use_case=use_case,
            video_id=None,
            plant_id=plant_id,
            filename=original_name,
            duration_sec=None,
            safe_temp_path=safe_temp_path,
            analysis_id=analysis_id,
            evidence_abs_path=evidence_abs_path,
            evidence_filename=evidence_filename,
            annotated_abs_path=annotated_abs_path,
            annotated_filename=annotated_filename,
            model_name=model_status.model_name,
            initial_summary="Video received. Running computer vision safety analysis...",
        )
        upload_ok = True
        return res
    finally:
        await file.close()
        if not upload_ok and os.path.exists(safe_temp_path):
            try:
                os.remove(safe_temp_path)
            except OSError:
                pass


@router.patch("/analyses/{analysis_id}/review", response_model=VideoAnalysisResponse)
def update_video_review(
    analysis_id: str,
    payload: VideoReviewUpdateRequest,
    db: Session = Depends(get_db),
):
    """Record explicit human safety review confirmation or dismissal for a video analysis."""
    _ensure_video_table()
    row = (
        db.query(VideoSafetyAnalysis)
        .filter(VideoSafetyAnalysis.analysis_id == analysis_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Video analysis '{analysis_id}' not found.")

    row.human_review_status = payload.human_review_status
    if payload.comment is not None:
        cleaned = payload.comment.strip()
        row.human_review_comment = cleaned or None
    row.status = "COMPLETED"
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.get("/evidence/{filename}")
def get_evidence_frame(filename: str):
    """Serve verified evidence frame image with strict filename validation."""
    if ".." in filename or not _EVIDENCE_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid evidence filename.")
    abs_path = os.path.abspath(os.path.join(EVIDENCE_DIR, filename))
    if not abs_path.startswith(os.path.abspath(EVIDENCE_DIR) + os.sep) or not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Evidence frame not found.")
    return FileResponse(abs_path, media_type="image/jpeg")


@router.get("/annotated/{filename}")
def get_annotated_video(filename: str):
    """Serve browser-playable H.264 annotated video output with strict filename validation."""
    if ".." in filename or not _ANNOTATED_FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid annotated video filename.")
    abs_path = os.path.abspath(os.path.join(ANNOTATED_VIDEO_DIR, filename))
    if not abs_path.startswith(os.path.abspath(ANNOTATED_VIDEO_DIR) + os.sep) or not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Annotated video not found.")
    return FileResponse(abs_path, media_type="video/mp4")
