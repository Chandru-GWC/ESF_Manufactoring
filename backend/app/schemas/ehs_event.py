from pydantic import BaseModel, ConfigDict
from datetime import datetime, date
from typing import Optional, List, Dict

class EhsEventBase(BaseModel):
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

class EhsEventResponse(EhsEventBase):
    pass

class EhsEventFilter(BaseModel):
    plant_id: Optional[str] = None
    area: Optional[str] = None
    shift_id: Optional[str] = None
    event_type: Optional[str] = None
    risk_severity: Optional[str] = None
    action_status: Optional[str] = None

class IngestionResult(BaseModel):
    status: str
    total_records: int
    inserted: int
    skipped_duplicates: int
    errors: List[str] = []

class EventAggregationSummary(BaseModel):
    total_events: int
    by_event_type: Dict[str, int]
    by_severity: Dict[str, int]
    by_action_status: Dict[str, int]
    by_plant: Dict[str, int]
    by_area: Dict[str, int]
    by_shift: Dict[str, int]
    by_hazard_category: Dict[str, int]
    date_range: Dict[str, Optional[str]]

