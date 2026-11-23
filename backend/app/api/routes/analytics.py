from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
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

@router.get("/overview", response_model=OperationsOverviewSummary)
def get_global_operations_overview(
    plant_id: Optional[str] = Query(None, description="Optional plant scope filter"),
    db: Session = Depends(get_db)
):
    plant_id = plant_filter(plant_id)
    """
    Computes unified operational safety summary directly from Neon PostgreSQL tables.
    Zero fabricated numbers.
    """
    ehs_q = db.query(EhsEvent)
    wf_q = db.query(WorkforceAttendance)
    mwo_q = db.query(MaintenanceWorkOrder)

    if plant_id:
        ehs_q = ehs_q.filter(EhsEvent.plant_id == plant_id)
        wf_q = wf_q.filter(WorkforceAttendance.plant_id == plant_id)
        mwo_q = mwo_q.filter(MaintenanceWorkOrder.plant_id == plant_id)

    total_events = ehs_q.count()
    hazards = ehs_q.filter(EhsEvent.event_type == 'HAZARD_OBSERVATION').count()
    incidents = ehs_q.filter(EhsEvent.event_type.in_(['FIRST_AID', 'LOST_TIME_INJURY'])).count()
    near_miss = ehs_q.filter(EhsEvent.event_type == 'NEAR_MISS').count()
    permits = ehs_q.filter(EhsEvent.event_type == 'PERMIT_EXCEPTION').count()
    open_actions = ehs_q.filter(EhsEvent.action_status.in_(['OPEN', 'IN_PROGRESS'])).count()
    closed_actions = ehs_q.filter(EhsEvent.action_status == 'CLOSED').count()
    critical_events = ehs_q.filter(EhsEvent.risk_severity == 'CRITICAL').count()

    # Workforce hours & training
    total_wf = wf_q.count()
    total_hours = db.query(func.sum(WorkforceAttendance.actual_hours))
    if plant_id:
        total_hours = total_hours.filter(WorkforceAttendance.plant_id == plant_id)
    hours_val = float(total_hours.scalar() or 0.0)

    curr_training = wf_q.filter(WorkforceAttendance.training_compliance == 'CURRENT').count()
    training_rate = round((curr_training / total_wf * 100), 2) if total_wf > 0 else 0.0

    # Maintenance
    total_mwo = mwo_q.count()
    p1_mwo = mwo_q.filter(MaintenanceWorkOrder.priority == 'P1').count()

    return OperationsOverviewSummary(
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
    q = db.query(WorkforceAttendance)
    if plant_id:
        q = q.filter(WorkforceAttendance.plant_id == plant_id)

    total = q.count()
    hours = db.query(func.sum(WorkforceAttendance.actual_hours))
    ot = db.query(func.sum(WorkforceAttendance.overtime_hours))
    if plant_id:
        hours = hours.filter(WorkforceAttendance.plant_id == plant_id)
        ot = ot.filter(WorkforceAttendance.plant_id == plant_id)

    def group_count(col):
        res = db.query(col, func.count(WorkforceAttendance.attendance_id))
        if plant_id:
            res = res.filter(WorkforceAttendance.plant_id == plant_id)
        return {k: v for k, v in res.group_by(col).all()}

    return WorkforceSummary(
        total_records=total,
        total_actual_hours=float(hours.scalar() or 0.0),
        total_overtime_hours=float(ot.scalar() or 0.0),
        by_status=group_count(WorkforceAttendance.attendance_status),
        by_skill_match=group_count(WorkforceAttendance.skill_match),
        by_training_compliance=group_count(WorkforceAttendance.training_compliance),
        by_plant=group_count(WorkforceAttendance.plant_id),
        by_shift=group_count(WorkforceAttendance.shift_id)
    )

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
    q = db.query(MaintenanceWorkOrder)
    if plant_id:
        q = q.filter(MaintenanceWorkOrder.plant_id == plant_id)

    total = q.count()
    dt_saved = db.query(func.sum(MaintenanceWorkOrder.downtime_avoided_estimate_min))
    if plant_id:
        dt_saved = dt_saved.filter(MaintenanceWorkOrder.plant_id == plant_id)

    def group_count(col):
        res = db.query(col, func.count(MaintenanceWorkOrder.work_order_id))
        if plant_id:
            res = res.filter(MaintenanceWorkOrder.plant_id == plant_id)
        return {k: v for k, v in res.group_by(col).all()}

    return MaintenanceSummary(
        total_work_orders=total,
        total_downtime_avoided_min=int(dt_saved.scalar() or 0),
        by_type=group_count(MaintenanceWorkOrder.maintenance_type),
        by_priority=group_count(MaintenanceWorkOrder.priority),
        by_status=group_count(MaintenanceWorkOrder.status),
        by_failure_mode=group_count(MaintenanceWorkOrder.failure_mode),
        by_plant=group_count(MaintenanceWorkOrder.plant_id)
    )

