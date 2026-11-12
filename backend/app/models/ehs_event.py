from sqlalchemy import Column, String, DateTime, Date, Boolean, Index
from app.core.database import Base

class EhsEvent(Base):
    """
    EHS Event Master table mapping directly to verified fact_ehs_event.csv columns.
    Zero synthetic fields. All attributes faithfully derived from actual source records.
    """
    __tablename__ = "fact_ehs_event"
    __table_args__ = (
        Index("ix_ehs_event_plant_shift", "plant_id", "shift_id"),
        Index("ix_ehs_event_type_severity", "event_type", "risk_severity"),
        Index("ix_ehs_event_ts", "event_ts"),
        Index("ix_ehs_event_owner", "action_owner"),
        {"schema": "ehs_core"}
    )
    
    ehs_event_id = Column(String(50), primary_key=True, index=True)
    event_ts = Column(DateTime, nullable=False)
    plant_id = Column(String(50), nullable=False)
    area = Column(String(100), nullable=False)
    shift_id = Column(String(10), nullable=False)
    event_type = Column(String(100), nullable=False)
    hazard_category = Column(String(100), nullable=False)
    risk_severity = Column(String(50), nullable=False)
    lost_time_injury = Column(Boolean, nullable=False)
    action_owner = Column(String(50), nullable=False)
    due_date = Column(Date, nullable=False)
    action_status = Column(String(50), nullable=False)
    permit_id = Column(String(50), nullable=False)
