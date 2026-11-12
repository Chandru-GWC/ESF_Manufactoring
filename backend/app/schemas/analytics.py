from pydantic import BaseModel, ConfigDict
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict

# 1. EHS Event Schemas
class EhsEventResponse(BaseModel):
    ehs_event_id: str
    event_ts: datetime
    plant_id: str
    area: str
    shift_id: str
    event_type: str
    hazard_category: str
    risk_severity: str
    lost_time_injury: bool
    action_owner: str
    due_date: date
    action_status: str
    permit_id: str

    model_config = ConfigDict(from_attributes=True)

# 2. Workforce Attendance Schemas
class WorkforceAttendanceResponse(BaseModel):
    attendance_id: str
    work_date: date
    employee_id: str
    plant_id: str
    shift_id: str
    scheduled_hours: int
    actual_hours: Decimal
    attendance_status: str
    overtime_hours: Decimal
    skill_match: str
    training_compliance: str

    model_config = ConfigDict(from_attributes=True)

class WorkforceSummary(BaseModel):
    total_records: int
    total_actual_hours: float
    total_overtime_hours: float
    by_status: Dict[str, int]
    by_skill_match: Dict[str, int]
    by_training_compliance: Dict[str, int]
    by_plant: Dict[str, int]
    by_shift: Dict[str, int]

# 3. Maintenance Work Order Schemas
class MaintenanceWorkOrderResponse(BaseModel):
    work_order_id: str
    machine_id: str
    plant_id: str
    created_ts: datetime
    maintenance_type: str
    failure_mode: str
    priority: str
    planned_start: datetime
    actual_start: Optional[datetime]
    downtime_avoided_estimate_min: int
    status: str
    technician_id: str

    model_config = ConfigDict(from_attributes=True)

class MaintenanceSummary(BaseModel):
    total_work_orders: int
    total_downtime_avoided_min: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]
    by_status: Dict[str, int]
    by_failure_mode: Dict[str, int]
    by_plant: Dict[str, int]

# 4. Global Operations Overview
class OperationsOverviewSummary(BaseModel):
    total_ehs_events: int
    total_workforce_records: int
    total_maintenance_work_orders: int
    total_actual_work_hours: float
    hazards_count: int
    incidents_count: int
    near_miss_count: int
    permit_exceptions_count: int
    open_actions_count: int
    closed_actions_count: int
    critical_events_count: int
    training_compliance_rate: float
    maintenance_p1_count: int
    plants: List[str]
    shifts: List[str]

