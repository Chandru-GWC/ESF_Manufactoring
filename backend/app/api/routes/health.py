from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.ehs_event import EhsEvent
from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance

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

