from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Dict, List, Optional, Tuple
import time
from app.core.database import get_db
from app.core.deps import ACTOR, plant_filter
from app.models.workforce_maintenance import WorkforceAttendance, MaintenanceWorkOrder
from app.models.ehs_event import EhsEvent
from app.schemas.analytics import (
    WorkforceAttendanceResponse,
    WorkforceSummary,
    MaintenanceWorkOrderResponse,
    MaintenanceSummary,
    OperationsOverviewSummary
)

router = APIRouter(prefix="/analytics", tags=["Operational Analytics & Live Datasets"])

# In-memory TTL caches to eliminate round-trip latency to remote PostgreSQL
_OVERVIEW_CACHE: Dict[str, Tuple[float, OperationsOverviewSummary]] = {}
_WORKFORCE_CACHE: Dict[str, Tuple[float, WorkforceSummary]] = {}
_MAINTENANCE_CACHE: Dict[str, Tuple[float, MaintenanceSummary]] = {}
_CACHE_TTL = 45.0  # seconds


@router.get("/overview", response_model=OperationsOverviewSummary)
def get_global_operations_overview(
    plant_id: Optional[str] = Query(None, description="Optional plant scope filter"),
    db: Session = Depends(get_db)
):
    plant_id = plant_filter(plant_id)
    cache_key = plant_id or "ALL"

    now = time.time()
    if cache_key in _OVERVIEW_CACHE:
        cached_time, cached_val = _OVERVIEW_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_val

    # Single unified SQL queries instead of 13 separate network round-trips
    p_filter = "AND plant_id = :p" if plant_id else ""
    p_where = "WHERE plant_id = :p" if plant_id else ""
    params = {"p": plant_id} if plant_id else {}

    ehs_sql = f"""
        SELECT
            COUNT(*),
            COALESCE(SUM(CASE WHEN event_type = 'HAZARD_OBSERVATION' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN event_type IN ('FIRST_AID', 'LOST_TIME_INJURY') THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN event_type = 'NEAR_MISS' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN event_type = 'PERMIT_EXCEPTION' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN action_status IN ('OPEN', 'IN_PROGRESS') THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN action_status = 'CLOSED' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN risk_severity = 'CRITICAL' THEN 1 ELSE 0 END), 0)
        FROM ehs_core.fact_ehs_event
        WHERE 1=1 {p_filter}
    """
    ehs_res = db.execute(text(ehs_sql), params).one()

    wf_sql = f"""
        SELECT
            COUNT(*),
            COALESCE(SUM(actual_hours), 0.0),
            COALESCE(SUM(CASE WHEN training_compliance = 'CURRENT' THEN 1 ELSE 0 END), 0)
        FROM ehs_core.fact_workforce_attendance
        WHERE 1=1 {p_filter}
    """
    wf_res = db.execute(text(wf_sql), params).one()

    mwo_sql = f"""
        SELECT
            COUNT(*),
            COALESCE(SUM(CASE WHEN priority = 'P1' THEN 1 ELSE 0 END), 0)
        FROM ehs_core.fact_maintenance_work_order
        WHERE 1=1 {p_filter}
    """
    mwo_res = db.execute(text(mwo_sql), params).one()

    total_events = int(ehs_res[0] or 0)
    hazards = int(ehs_res[1] or 0)
    incidents = int(ehs_res[2] or 0)
    near_miss = int(ehs_res[3] or 0)
    permits = int(ehs_res[4] or 0)
    open_actions = int(ehs_res[5] or 0)
    closed_actions = int(ehs_res[6] or 0)
    critical_events = int(ehs_res[7] or 0)

    total_wf = int(wf_res[0] or 0)
    hours_val = float(wf_res[1] or 0.0)
    curr_training = int(wf_res[2] or 0)
    training_rate = round((curr_training / total_wf * 100), 2) if total_wf > 0 else 0.0

    total_mwo = int(mwo_res[0] or 0)
    p1_mwo = int(mwo_res[1] or 0)

    summary = OperationsOverviewSummary(
        total_ehs_events=total_events,
        total_workforce_records=total_wf,
        total_maintenance_work_orders=total_mwo,
        total_actual_work_hours=hours_val,
        hazards_count=hazards,
        incidents_count=incidents,
        near_miss_count=near_miss,
        permit_exceptions_count=permits,
        open_actions_count=open_actions,
        closed_actions_count=closed_actions,
        critical_events_count=critical_events,
        training_compliance_rate=training_rate,
        maintenance_p1_count=p1_mwo,
        plants=["IN-KA-01", "IN-TN-01"],
        shifts=["A", "B", "C"]
    )
    _OVERVIEW_CACHE[cache_key] = (now, summary)
    return summary

@router.get("/workforce", response_model=List[WorkforceAttendanceResponse])
def get_workforce_records(
    plant_id: Optional[str] = None,
    shift_id: Optional[str] = None,
    work_date: Optional[str] = None,
    attendance_status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    plant_id = plant_filter(plant_id)
    query = db.query(WorkforceAttendance)
    if plant_id:
        query = query.filter(WorkforceAttendance.plant_id == plant_id)
    if shift_id:
        query = query.filter(WorkforceAttendance.shift_id == shift_id)
    if work_date:
        query = query.filter(WorkforceAttendance.work_date == work_date)
    if attendance_status:
        query = query.filter(WorkforceAttendance.attendance_status == attendance_status)
    return query.order_by(WorkforceAttendance.work_date.desc()).offset(offset).limit(limit).all()

@router.get("/workforce/summary", response_model=WorkforceSummary)
def get_workforce_summary(
    plant_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    plant_id = plant_filter(plant_id)
    cache_key = plant_id or "ALL"
    now = time.time()
    if cache_key in _WORKFORCE_CACHE:
        cached_time, cached_val = _WORKFORCE_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_val

    totals_q = db.query(
        func.count(WorkforceAttendance.attendance_id),
        func.sum(WorkforceAttendance.actual_hours),
        func.sum(WorkforceAttendance.overtime_hours)
    )
    if plant_id:
        totals_q = totals_q.filter(WorkforceAttendance.plant_id == plant_id)
    total_cnt, total_hours, total_ot = totals_q.one()

    def group_count(col):
        res = db.query(col, func.count(WorkforceAttendance.attendance_id))
        if plant_id:
            res = res.filter(WorkforceAttendance.plant_id == plant_id)
        return {k: v for k, v in res.group_by(col).all()}

    summary = WorkforceSummary(
        total_records=total_cnt or 0,
        total_actual_hours=float(total_hours or 0.0),
        total_overtime_hours=float(total_ot or 0.0),
        by_status=group_count(WorkforceAttendance.attendance_status),
        by_skill_match=group_count(WorkforceAttendance.skill_match),
        by_training_compliance=group_count(WorkforceAttendance.training_compliance),
        by_plant=group_count(WorkforceAttendance.plant_id),
        by_shift=group_count(WorkforceAttendance.shift_id)
    )
    _WORKFORCE_CACHE[cache_key] = (now, summary)
    return summary

@router.get("/maintenance", response_model=List[MaintenanceWorkOrderResponse])
def get_maintenance_work_orders(
    plant_id: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    plant_id = plant_filter(plant_id)
    query = db.query(MaintenanceWorkOrder)
    if plant_id:
        query = query.filter(MaintenanceWorkOrder.plant_id == plant_id)
    if priority:
        query = query.filter(MaintenanceWorkOrder.priority == priority)
    if status:
        query = query.filter(MaintenanceWorkOrder.status == status)
    return query.order_by(MaintenanceWorkOrder.created_ts.desc()).offset(offset).limit(limit).all()

@router.get("/maintenance/summary", response_model=MaintenanceSummary)
def get_maintenance_summary(
    plant_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    plant_id = plant_filter(plant_id)
    cache_key = plant_id or "ALL"
    now = time.time()
    if cache_key in _MAINTENANCE_CACHE:
        cached_time, cached_val = _MAINTENANCE_CACHE[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_val

    from collections import Counter
    cols = db.query(
        MaintenanceWorkOrder.maintenance_type,
        MaintenanceWorkOrder.priority,
        MaintenanceWorkOrder.status,
        MaintenanceWorkOrder.failure_mode,
        MaintenanceWorkOrder.plant_id,
        MaintenanceWorkOrder.downtime_avoided_estimate_min
    )
    if plant_id:
        cols = cols.filter(MaintenanceWorkOrder.plant_id == plant_id)
    rows = cols.all()

    by_type = Counter()
    by_priority = Counter()
    by_status = Counter()
    by_failure_mode = Counter()
    by_plant = Counter()
    total_dt = 0

    for r in rows:
        if r.maintenance_type:
            by_type[r.maintenance_type] += 1
        if r.priority:
            by_priority[r.priority] += 1
        if r.status:
            by_status[r.status] += 1
        if r.failure_mode:
            by_failure_mode[r.failure_mode] += 1
        if r.plant_id:
            by_plant[r.plant_id] += 1
        if r.downtime_avoided_estimate_min:
            total_dt += int(r.downtime_avoided_estimate_min)

    summary = MaintenanceSummary(
        total_work_orders=len(rows),
        total_downtime_avoided_min=total_dt,
        by_type=dict(by_type),
        by_priority=dict(by_priority),
        by_status=dict(by_status),
        by_failure_mode=dict(by_failure_mode),
        by_plant=dict(by_plant)
    )
    _MAINTENANCE_CACHE[cache_key] = (now, summary)
    return summary

