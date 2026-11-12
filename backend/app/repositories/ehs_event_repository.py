from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict
from app.models.ehs_event import EhsEvent

class EhsEventRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, event_id: str) -> Optional[EhsEvent]:
        return self.db.query(EhsEvent).filter(EhsEvent.ehs_event_id == event_id).first()

    def list_events(
        self,
        plant_id: Optional[str] = None,
        area: Optional[str] = None,
        shift_id: Optional[str] = None,
        event_type: Optional[str] = None,
        risk_severity: Optional[str] = None,
        action_status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[EhsEvent]:
        query = self.db.query(EhsEvent)
        if plant_id:
            query = query.filter(EhsEvent.plant_id == plant_id)
        if area:
            query = query.filter(EhsEvent.area == area)
        if shift_id:
            query = query.filter(EhsEvent.shift_id == shift_id)
        if event_type:
            query = query.filter(EhsEvent.event_type == event_type)
        if risk_severity:
            query = query.filter(EhsEvent.risk_severity == risk_severity)
        if action_status:
            query = query.filter(EhsEvent.action_status == action_status)
        return query.order_by(EhsEvent.event_ts.desc()).offset(offset).limit(limit).all()

    def count_events(
        self,
        plant_id: Optional[str] = None,
        event_type: Optional[str] = None,
        risk_severity: Optional[str] = None
    ) -> int:
        query = self.db.query(func.count(EhsEvent.ehs_event_id))
        if plant_id:
            query = query.filter(EhsEvent.plant_id == plant_id)
        if event_type:
            query = query.filter(EhsEvent.event_type == event_type)
        if risk_severity:
            query = query.filter(EhsEvent.risk_severity == risk_severity)
        return query.scalar() or 0

    def get_aggregations(self, plant_id: Optional[str] = None) -> Dict:
        base_query = self.db.query(EhsEvent)
        if plant_id:
            base_query = base_query.filter(EhsEvent.plant_id == plant_id)

        total = base_query.count()

        def group_counts(col):
            q = self.db.query(col, func.count(EhsEvent.ehs_event_id))
            if plant_id:
                q = q.filter(EhsEvent.plant_id == plant_id)
            return {val: count for val, count in q.group_by(col).all()}

        date_q = self.db.query(func.min(EhsEvent.event_ts), func.max(EhsEvent.event_ts))
        if plant_id:
            date_q = date_q.filter(EhsEvent.plant_id == plant_id)
        min_date, max_date = date_q.one()

        return {
            "total_events": total,
            "by_event_type": group_counts(EhsEvent.event_type),
            "by_severity": group_counts(EhsEvent.risk_severity),
            "by_action_status": group_counts(EhsEvent.action_status),
            "by_plant": group_counts(EhsEvent.plant_id),
            "by_area": group_counts(EhsEvent.area),
            "by_shift": group_counts(EhsEvent.shift_id),
            "by_hazard_category": group_counts(EhsEvent.hazard_category),
            "date_range": {
                "start": min_date.isoformat() if min_date else None,
                "end": max_date.isoformat() if max_date else None,
            }
        }

    def bulk_insert(self, events: List[EhsEvent]) -> int:
        self.db.bulk_save_objects(events)
        self.db.commit()
        return len(events)

