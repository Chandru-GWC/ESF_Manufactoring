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
        from collections import Counter
        cols = self.db.query(
            EhsEvent.event_type,
            EhsEvent.risk_severity,
            EhsEvent.action_status,
            EhsEvent.plant_id,
            EhsEvent.area,
            EhsEvent.shift_id,
            EhsEvent.hazard_category,
            EhsEvent.event_ts,
        )
        if plant_id:
            cols = cols.filter(EhsEvent.plant_id == plant_id)
        rows = cols.all()

        by_event_type = Counter()
        by_severity = Counter()
        by_action_status = Counter()
        by_plant = Counter()
        by_area = Counter()
        by_shift = Counter()
        by_hazard_category = Counter()
        min_date = None
        max_date = None

        for r in rows:
            if r.event_type:
                by_event_type[r.event_type] += 1
            if r.risk_severity:
                by_severity[r.risk_severity] += 1
            if r.action_status:
                by_action_status[r.action_status] += 1
            if r.plant_id:
                by_plant[r.plant_id] += 1
            if r.area:
                by_area[r.area] += 1
            if r.shift_id:
                by_shift[r.shift_id] += 1
            if r.hazard_category:
                by_hazard_category[r.hazard_category] += 1
            if r.event_ts:
                if min_date is None or r.event_ts < min_date:
                    min_date = r.event_ts
                if max_date is None or r.event_ts > max_date:
                    max_date = r.event_ts

        return {
            "total_events": len(rows),
            "by_event_type": dict(by_event_type),
            "by_severity": dict(by_severity),
            "by_action_status": dict(by_action_status),
            "by_plant": dict(by_plant),
            "by_area": dict(by_area),
            "by_shift": dict(by_shift),
            "by_hazard_category": dict(by_hazard_category),
            "date_range": {
                "start": min_date.isoformat() if min_date else None,
                "end": max_date.isoformat() if max_date else None,
            }
        }

    def bulk_insert(self, events: List[EhsEvent]) -> int:
        self.db.bulk_save_objects(events)
        self.db.commit()
        return len(events)

