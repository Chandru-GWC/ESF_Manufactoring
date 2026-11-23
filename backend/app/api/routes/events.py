from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import time
from app.core.database import get_db
from app.core.deps import plant_filter
from app.repositories.ehs_event_repository import EhsEventRepository
from app.schemas.ehs_event import (
    EhsEventResponse,
    EventAggregationSummary,
)

router = APIRouter(prefix="/events", tags=["EHS Events"])

_EVENT_SUMMARY_CACHE = {}
_CACHE_TTL = 45.0

@router.get("", response_model=List[EhsEventResponse])
def get_events(
    plant_id: Optional[str] = Query(None, description="Plant Code (e.g. IN-KA-01, IN-TN-01)"),
    area: Optional[str] = Query(None, description="Plant area (e.g. SMT, WAREHOUSE, FINAL_ASSEMBLY)"),
    shift_id: Optional[str] = Query(None, description="Shift Code (A, B, C)"),
    event_type: Optional[str] = Query(None, description="Event Type (FIRST_AID, HAZARD_OBSERVATION, etc.)"),
    risk_severity: Optional[str] = Query(None, description="Risk Severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    action_status: Optional[str] = Query(None, description="Action Status (OPEN, IN_PROGRESS, CLOSED)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated EHS event records with multi-dimensional filtering.
    """
    plant_id = plant_filter(plant_id)
    repo = EhsEventRepository(db)
    return repo.list_events(
        plant_id=plant_id,
        area=area,
        shift_id=shift_id,
        event_type=event_type,
        risk_severity=risk_severity,
        action_status=action_status,
        limit=limit,
        offset=offset
    )

@router.get("/summary", response_model=EventAggregationSummary)
def get_event_summary(
    plant_id: Optional[str] = Query(None, description="Optional facility filter"),
    db: Session = Depends(get_db)
):
    """
    Retrieve aggregated metrics and dimensional distributions derived from fact_ehs_event records.
    """
    plant_id = plant_filter(plant_id)
    cache_key = plant_id or "ALL"
    now = time.time()
    if cache_key in _EVENT_SUMMARY_CACHE:
        cached_time, cached_val = _EVENT_SUMMARY_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_val

    repo = EhsEventRepository(db)
    result = repo.get_aggregations(plant_id=plant_id)
    _EVENT_SUMMARY_CACHE[cache_key] = (now, result)
    return result

@router.get("/{event_id}", response_model=EhsEventResponse)
def get_event_by_id(
    event_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve single event record by unique identifier.
    """
    repo = EhsEventRepository(db)
    event = repo.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"EHS Event '{event_id}' not found.")
    return event
