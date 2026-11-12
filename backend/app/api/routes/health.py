import os
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.ehs_event import EhsEvent
from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance
from app.services.video.config import WORKSPACE_ROOT

router = APIRouter(prefix="/health", tags=["Health & Inspection"])


def _dataset_status(count: int) -> str:
    return "AVAILABLE & INSPECTED" if count > 0 else "AWAITING_INGESTION"


@router.get("")
def health_check(db: Session = Depends(get_db)):
    try:
        ehs_count = int(db.query(func.count(EhsEvent.ehs_event_id)).scalar() or 0)
        wf_count = int(db.query(func.count(WorkforceAttendance.attendance_id)).scalar() or 0)
        mwo_count = int(db.query(func.count(MaintenanceWorkOrder.work_order_id)).scalar() or 0)
        db_connected = True
    except Exception:
        ehs_count = 0
        wf_count = 0
        mwo_count = 0
        db_connected = False

    return {
        "status": "healthy" if db_connected else "degraded",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "supported_datasets": {
            "fact_ehs_event.csv": _dataset_status(ehs_count),
            "fact_workforce_attendance.csv": _dataset_status(wf_count),
            "fact_maintenance_work_order.csv": _dataset_status(mwo_count),
        },
        "record_counts": {
            "fact_ehs_event": ehs_count,
            "fact_workforce_attendance": wf_count,
            "fact_maintenance_work_order": mwo_count,
        },
    }


@router.get("/landing-media")
def landing_media_status():
    """Report actual availability of local hero-factory.mp4 and hero-poster.jpg without 404 console probes."""
    media_dir = os.path.join(WORKSPACE_ROOT, "public", "media")
    video_path = os.path.join(media_dir, "hero-factory.mp4")
    poster_path = os.path.join(media_dir, "hero-poster.jpg")

    video_available = os.path.isfile(video_path) and os.path.getsize(video_path) > 0
    poster_available = os.path.isfile(poster_path) and os.path.getsize(poster_path) > 0

    return {
        "video_available": video_available,
        "video_url": "/media/hero-factory.mp4" if video_available else None,
        "poster_available": poster_available,
        "poster_url": "/media/hero-poster.jpg" if poster_available else None,
    }
