"""
Controlled Read-Only Neon PostgreSQL Data Retrieval Layer for EHS Specialist Agents.

Strict governance rules:
- Zero raw/arbitrary SQL strings from user prompts or LLM output.
- Operates exclusively across approved ehs_core tables:
  1. ehs_core.fact_ehs_event
  2. ehs_core.fact_workforce_attendance
  3. ehs_core.fact_maintenance_work_order
- Returns pre-validated aggregations, bounded record samples, and explicit dataset limitation notes.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import case, extract, func
from sqlalchemy.orm import Session

from app.core.normalization import SHIFT_TIMING_METADATA, get_shift_display_label, normalize_shift_id
from app.models.ehs_event import EhsEvent
from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance
from app.repositories.ehs_event_repository import EhsEventRepository
from app.schemas.ai_agent import EvidenceItem


def _normalize_plant_filter(plant_id: Optional[str]) -> Optional[str]:
    if not plant_id or plant_id.strip().upper() == "ALL":
        return None
    return plant_id.strip().upper()


class EhsNeonDataTools:
    """Deterministic, read-only query toolkit shared across specialist agents."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.event_repo = EhsEventRepository(db)

    def get_hazard_analysis_data(self, plant_id: Optional[str] = None) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        plant = _normalize_plant_filter(plant_id)
        summary = self.event_repo.get_aggregations(plant_id=plant)
        total_events = int(summary["total_events"])

        # Specifically scope HAZARD_OBSERVATION distribution vs all HIGH/CRITICAL events
        def _filtered(q):
            return q.filter(EhsEvent.plant_id == plant) if plant else q

        hazard_obs_total = _filtered(
            self.db.query(func.count(EhsEvent.ehs_event_id)).filter(EhsEvent.event_type == "HAZARD_OBSERVATION")
        ).scalar() or 0

        hazard_by_category = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(EhsEvent.hazard_category, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type == "HAZARD_OBSERVATION"
                )
            )
            .group_by(EhsEvent.hazard_category)
            .all()
        }

        high_critical_by_area = [
            {"plant_id": row[0], "area": row[1], "risk_severity": row[2], "count": int(row[3])}
            for row in _filtered(
                self.db.query(
                    EhsEvent.plant_id,
                    EhsEvent.area,
                    EhsEvent.risk_severity,
                    func.count(EhsEvent.ehs_event_id),
                ).filter(EhsEvent.risk_severity.in_(["HIGH", "CRITICAL"]))
            )
            .group_by(EhsEvent.plant_id, EhsEvent.area, EhsEvent.risk_severity)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .all()
        ]

        shift_breakdown = [
            {
                "shift_id": normalize_shift_id(row[0]),
                "shift_label": get_shift_display_label(row[0]),
                "hazard_observations": int(row[1]),
                "high_or_critical_total": int(row[2]),
            }
            for row in _filtered(
                self.db.query(
                    EhsEvent.shift_id,
                    func.sum(case((EhsEvent.event_type == "HAZARD_OBSERVATION", 1), else_=0)),
                    func.sum(case((EhsEvent.risk_severity.in_(["HIGH", "CRITICAL"]), 1), else_=0)),
                )
            )
            .group_by(EhsEvent.shift_id)
            .order_by(EhsEvent.shift_id)
            .all()
        ]

        area_category_hotspots = [
            {
                "plant_id": row[0],
                "area": row[1],
                "hazard_category": row[2],
                "count": int(row[3]),
            }
            for row in _filtered(
                self.db.query(
                    EhsEvent.plant_id,
                    EhsEvent.area,
                    EhsEvent.hazard_category,
                    func.count(EhsEvent.ehs_event_id),
                )
            )
            .group_by(EhsEvent.plant_id, EhsEvent.area, EhsEvent.hazard_category)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .limit(10)
            .all()
        ]

        sample_critical_open = (
            _filtered(
                self.db.query(EhsEvent).filter(
                    EhsEvent.risk_severity.in_(["CRITICAL", "HIGH"]),
                    EhsEvent.action_status != "CLOSED",
                )
            )
            .order_by(
                case((EhsEvent.risk_severity == "CRITICAL", 0), else_=1),
                EhsEvent.event_ts.desc(),
            )
            .limit(8)
            .all()
        )

        sample_rows = [
            {
                "ehs_event_id": r.ehs_event_id,
                "plant_id": r.plant_id,
                "area": r.area,
                "shift": get_shift_display_label(r.shift_id),
                "event_type": r.event_type,
                "hazard_category": r.hazard_category,
                "risk_severity": r.risk_severity,
                "action_status": r.action_status,
                "action_owner": r.action_owner,
                "due_date": r.due_date.isoformat(),
                "event_ts": r.event_ts.isoformat(),
            }
            for r in sample_critical_open
        ]

        payload = {
            "plant_scope": plant or "ALL",
            "date_range": summary["date_range"],
            "total_events": total_events,
            "hazard_observation_count": int(hazard_obs_total),
            "all_events_by_severity": summary["by_severity"],
            "all_events_by_hazard_category": summary["by_hazard_category"],
            "hazard_observations_by_category": hazard_by_category,
            "all_events_by_area": summary["by_area"],
            "all_events_by_plant": summary["by_plant"],
            "shift_distribution": shift_breakdown,
            "high_critical_by_plant_area": high_critical_by_area[:12],
            "top_recurring_area_categories": area_category_hotspots,
            "open_high_critical_samples": sample_rows,
        }

        evidence: List[EvidenceItem] = [
            EvidenceItem(
                id="HAZARD-TOTALS",
                label="EHS Events & Hazard Observations",
                dataset_source="ehs_core.fact_ehs_event",
                value=f"{hazard_obs_total} HAZARD_OBSERVATION / {total_events} total events",
                excerpt=(
                    f"CRITICAL: {summary['by_severity'].get('CRITICAL', 0)}, "
                    f"HIGH: {summary['by_severity'].get('HIGH', 0)}"
                ),
            )
        ]
        if area_category_hotspots:
            top = area_category_hotspots[0]
            evidence.append(
                EvidenceItem(
                    id="TOP-HOTSPOT",
                    label=f"Top Recurring Pattern ({top['plant_id']} / {top['area']})",
                    dataset_source="ehs_core.fact_ehs_event",
                    value=f"{top['count']} {top['hazard_category']} events",
                )
            )
        for row in sample_rows[:3]:
            evidence.append(
                EvidenceItem(
                    id=row["ehs_event_id"],
                    label=f"{row['hazard_category']} • {row['area']} ({row['plant_id']})",
                    dataset_source="ehs_core.fact_ehs_event",
                    value=f"{row['risk_severity']} / {row['action_status']}",
                    excerpt=f"Owner {row['action_owner']} • Due {row['due_date']}",
                )
            )

        return payload, evidence, total_events

    def get_incident_analysis_data(self, plant_id: Optional[str] = None) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        plant = _normalize_plant_filter(plant_id)
        incident_types = ["FIRST_AID", "NEAR_MISS", "AUDIT_FINDING"]

        def _filtered(q):
            return q.filter(EhsEvent.plant_id == plant) if plant else q

        total_events = _filtered(self.db.query(func.count(EhsEvent.ehs_event_id))).scalar() or 0
        lti_true_count = _filtered(
            self.db.query(func.count(EhsEvent.ehs_event_id)).filter(EhsEvent.lost_time_injury.is_(True))
        ).scalar() or 0

        by_type = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(EhsEvent.event_type, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type.in_(incident_types)
                )
            )
            .group_by(EhsEvent.event_type)
            .all()
        }
        incident_total = sum(by_type.values())

        by_severity = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(EhsEvent.risk_severity, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type.in_(incident_types)
                )
            )
            .group_by(EhsEvent.risk_severity)
            .all()
        }
        by_status = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(EhsEvent.action_status, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type.in_(incident_types)
                )
            )
            .group_by(EhsEvent.action_status)
            .all()
        }
        by_area = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(EhsEvent.area, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type.in_(incident_types)
                )
            )
            .group_by(EhsEvent.area)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .all()
        }
        by_category = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(EhsEvent.hazard_category, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type.in_(incident_types)
                )
            )
            .group_by(EhsEvent.hazard_category)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .all()
        }

        monthly_rows = (
            _filtered(
                self.db.query(
                    extract("year", EhsEvent.event_ts),
                    extract("month", EhsEvent.event_ts),
                    EhsEvent.event_type,
                    func.count(EhsEvent.ehs_event_id),
                ).filter(EhsEvent.event_type.in_(incident_types))
            )
            .group_by(
                extract("year", EhsEvent.event_ts),
                extract("month", EhsEvent.event_ts),
                EhsEvent.event_type,
            )
            .order_by(extract("year", EhsEvent.event_ts), extract("month", EhsEvent.event_ts))
            .all()
        )
        monthly_trends: Dict[str, Dict[str, int]] = {}
        for yr, mo, etype, cnt in monthly_rows:
            ym = f"{int(yr):04d}-{int(mo):02d}"
            monthly_trends.setdefault(ym, {})[etype] = int(cnt)

        samples = (
            _filtered(self.db.query(EhsEvent).filter(EhsEvent.event_type.in_(incident_types)))
            .order_by(
                case((EhsEvent.risk_severity == "CRITICAL", 0), (EhsEvent.risk_severity == "HIGH", 1), else_=2),
                EhsEvent.event_ts.desc(),
            )
            .limit(8)
            .all()
        )

        payload = {
            "plant_scope": plant or "ALL",
            "total_all_ehs_events": int(total_events),
            "incident_and_audit_total": int(incident_total),
            "lost_time_injury_true_count": int(lti_true_count),
            "by_event_type": by_type,
            "by_severity": by_severity,
            "by_action_status": by_status,
            "by_area": by_area,
            "by_hazard_category": by_category,
            "monthly_trends": monthly_trends,
            "sample_records": [
                {
                    "ehs_event_id": r.ehs_event_id,
                    "event_type": r.event_type,
                    "hazard_category": r.hazard_category,
                    "risk_severity": r.risk_severity,
                    "plant_id": r.plant_id,
                    "area": r.area,
                    "shift": get_shift_display_label(r.shift_id),
                    "action_status": r.action_status,
                    "event_ts": r.event_ts.isoformat(),
                }
                for r in samples
            ],
        }

        evidence = [
            EvidenceItem(
                id="INCIDENT-DIST",
                label="First Aid, Near Miss & Audit Findings",
                dataset_source="ehs_core.fact_ehs_event",
                value=f"{incident_total} records (LTI true: {lti_true_count})",
                excerpt=(
                    f"FIRST_AID={by_type.get('FIRST_AID', 0)}, "
                    f"NEAR_MISS={by_type.get('NEAR_MISS', 0)}, "
                    f"AUDIT_FINDING={by_type.get('AUDIT_FINDING', 0)}"
                ),
            )
        ]
        for s in payload["sample_records"][:3]:
            evidence.append(
                EvidenceItem(
                    id=s["ehs_event_id"],
                    label=f"{s['event_type']} • {s['area']} ({s['plant_id']})",
                    dataset_source="ehs_core.fact_ehs_event",
                    value=f"{s['risk_severity']} / {s['action_status']}",
                    excerpt=f"Hazard: {s['hazard_category']} • {s['event_ts'][:10]}",
                )
            )
        return payload, evidence, int(total_events)

    def get_workforce_safety_data(self, plant_id: Optional[str] = None) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        plant = _normalize_plant_filter(plant_id)

        def _filtered(q):
            return q.filter(WorkforceAttendance.plant_id == plant) if plant else q

        agg_row = _filtered(
            self.db.query(
                func.count(WorkforceAttendance.attendance_id),
                func.count(func.distinct(WorkforceAttendance.employee_id)),
                func.min(WorkforceAttendance.work_date),
                func.max(WorkforceAttendance.work_date),
                func.sum(WorkforceAttendance.scheduled_hours),
                func.sum(WorkforceAttendance.actual_hours),
                func.sum(WorkforceAttendance.overtime_hours),
                func.sum(case((WorkforceAttendance.overtime_hours > 0, 1), else_=0)),
                func.sum(case((WorkforceAttendance.training_compliance == "CURRENT", 1), else_=0)),
                func.sum(case((WorkforceAttendance.training_compliance == "EXPIRED", 1), else_=0)),
            )
        ).one()

        total_records = int(agg_row[0] or 0)
        distinct_employees = int(agg_row[1] or 0)
        min_date = agg_row[2].isoformat() if agg_row[2] else None
        max_date = agg_row[3].isoformat() if agg_row[3] else None
        sched_hours = float(agg_row[4] or 0)
        actual_hours = float(agg_row[5] or 0)
        overtime_hours = float(agg_row[6] or 0)
        overtime_logs = int(agg_row[7] or 0)
        current_training = int(agg_row[8] or 0)
        expired_training = int(agg_row[9] or 0)
        compliance_rate = round((current_training / total_records * 100), 2) if total_records else 0.0

        by_status = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(WorkforceAttendance.attendance_status, func.count(WorkforceAttendance.attendance_id))
            )
            .group_by(WorkforceAttendance.attendance_status)
            .all()
        }
        by_skill = {
            k: int(v)
            for k, v in _filtered(
                self.db.query(WorkforceAttendance.skill_match, func.count(WorkforceAttendance.attendance_id))
            )
            .group_by(WorkforceAttendance.skill_match)
            .all()
        }

        by_shift = []
        for row in (
            _filtered(
                self.db.query(
                    WorkforceAttendance.shift_id,
                    func.count(WorkforceAttendance.attendance_id),
                    func.sum(WorkforceAttendance.actual_hours),
                    func.sum(WorkforceAttendance.overtime_hours),
                    func.sum(case((WorkforceAttendance.training_compliance == "EXPIRED", 1), else_=0)),
                )
            )
            .group_by(WorkforceAttendance.shift_id)
            .order_by(WorkforceAttendance.shift_id)
            .all()
        ):
            code = normalize_shift_id(row[0])
            by_shift.append(
                {
                    "shift_id": code,
                    "shift_label": get_shift_display_label(code),
                    "shift_window": SHIFT_TIMING_METADATA.get(code, {}),
                    "attendance_logs": int(row[1] or 0),
                    "actual_hours": round(float(row[2] or 0), 1),
                    "overtime_hours": round(float(row[3] or 0), 1),
                    "expired_training_logs": int(row[4] or 0),
                }
            )

        by_plant = [
            {
                "plant_id": row[0],
                "attendance_logs": int(row[1] or 0),
                "actual_hours": round(float(row[2] or 0), 1),
                "overtime_hours": round(float(row[3] or 0), 1),
                "expired_training_logs": int(row[4] or 0),
            }
            for row in _filtered(
                self.db.query(
                    WorkforceAttendance.plant_id,
                    func.count(WorkforceAttendance.attendance_id),
                    func.sum(WorkforceAttendance.actual_hours),
                    func.sum(WorkforceAttendance.overtime_hours),
                    func.sum(case((WorkforceAttendance.training_compliance == "EXPIRED", 1), else_=0)),
                )
            )
            .group_by(WorkforceAttendance.plant_id)
            .order_by(WorkforceAttendance.plant_id)
            .all()
        ]

        expired_distinct_employees = _filtered(
            self.db.query(func.count(func.distinct(WorkforceAttendance.employee_id))).filter(
                WorkforceAttendance.training_compliance == "EXPIRED"
            )
        ).scalar() or 0

        top_expired_employees = [
            {
                "employee_id": row[0],
                "plant_id": row[1],
                "expired_log_count": int(row[2]),
                "latest_work_date": row[3].isoformat() if row[3] else None,
            }
            for row in _filtered(
                self.db.query(
                    WorkforceAttendance.employee_id,
                    WorkforceAttendance.plant_id,
                    func.count(WorkforceAttendance.attendance_id),
                    func.max(WorkforceAttendance.work_date),
                ).filter(WorkforceAttendance.training_compliance == "EXPIRED")
            )
            .group_by(WorkforceAttendance.employee_id, WorkforceAttendance.plant_id)
            .order_by(func.count(WorkforceAttendance.attendance_id).desc())
            .limit(8)
            .all()
        ]

        payload = {
            "plant_scope": plant or "ALL",
            "date_range": {"start": min_date, "end": max_date},
            "total_attendance_records": total_records,
            "distinct_employees": distinct_employees,
            "scheduled_hours_total": round(sched_hours, 1),
            "actual_hours_total": round(actual_hours, 1),
            "overtime_hours_total": round(overtime_hours, 1),
            "logs_with_overtime": overtime_logs,
            "training_compliance_rate_pct": compliance_rate,
            "training_current_logs": current_training,
            "training_expired_logs": expired_training,
            "distinct_employees_with_expired_training": int(expired_distinct_employees),
            "attendance_status_breakdown": by_status,
            "skill_match_breakdown": by_skill,
            "shift_breakdown": by_shift,
            "plant_breakdown": by_plant,
            "top_expired_training_employees": top_expired_employees,
        }

        evidence = [
            EvidenceItem(
                id="WF-TRAINING",
                label="Training Compliance Across All Logs",
                dataset_source="ehs_core.fact_workforce_attendance",
                value=f"{compliance_rate}% CURRENT ({current_training:,} / {total_records:,})",
                excerpt=f"{expired_training:,} EXPIRED logs across {expired_distinct_employees} employees",
            ),
            EvidenceItem(
                id="WF-HOURS",
                label="Actual Hours & Recorded Overtime",
                dataset_source="ehs_core.fact_workforce_attendance",
                value=f"{actual_hours:,.1f} actual hrs / {overtime_hours:,.1f} OT hrs",
                excerpt=f"{overtime_logs:,} shift logs recorded overtime > 0 hrs",
            ),
        ]
        for emp in top_expired_employees[:2]:
            evidence.append(
                EvidenceItem(
                    id=emp["employee_id"],
                    label=f"Expired Training Records ({emp['plant_id']})",
                    dataset_source="ehs_core.fact_workforce_attendance",
                    value=f"{emp['expired_log_count']} EXPIRED shift logs",
                    excerpt=f"Latest date: {emp['latest_work_date']}",
                )
            )
        return payload, evidence, total_records

    def get_maintenance_safety_data(self, plant_id: Optional[str] = None) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        plant = _normalize_plant_filter(plant_id)

        def _filtered(q):
            return q.filter(MaintenanceWorkOrder.plant_id == plant) if plant else q

        agg_row = _filtered(
            self.db.query(
                func.count(MaintenanceWorkOrder.work_order_id),
                func.min(MaintenanceWorkOrder.created_ts),
                func.max(MaintenanceWorkOrder.created_ts),
                func.sum(MaintenanceWorkOrder.downtime_avoided_estimate_min),
                func.sum(case((MaintenanceWorkOrder.priority == "P1", 1), else_=0)),
                func.sum(
                    case(
                        (
                            (MaintenanceWorkOrder.priority == "P1") & (MaintenanceWorkOrder.status != "COMPLETED"),
                            1,
                        ),
                        else_=0,
                    )
                ),
                func.sum(case((MaintenanceWorkOrder.actual_start.is_(None), 1), else_=0)),
            )
        ).one()

        total_orders = int(agg_row[0] or 0)
        downtime_min = int(agg_row[3] or 0)
        p1_total = int(agg_row[4] or 0)
        p1_open_or_active = int(agg_row[5] or 0)
        no_actual_start = int(agg_row[6] or 0)

        def _group_mwo(col):
            return {
                k: int(v)
                for k, v in _filtered(self.db.query(col, func.count(MaintenanceWorkOrder.work_order_id)))
                .group_by(col)
                .order_by(func.count(MaintenanceWorkOrder.work_order_id).desc())
                .all()
            }

        priority_status = [
            {"priority": r[0], "status": r[1], "count": int(r[2])}
            for r in _filtered(
                self.db.query(
                    MaintenanceWorkOrder.priority,
                    MaintenanceWorkOrder.status,
                    func.count(MaintenanceWorkOrder.work_order_id),
                )
            )
            .group_by(MaintenanceWorkOrder.priority, MaintenanceWorkOrder.status)
            .order_by(MaintenanceWorkOrder.priority, MaintenanceWorkOrder.status)
            .all()
        ]

        top_machines = [
            {
                "machine_id": r[0],
                "plant_id": r[1],
                "work_orders": int(r[2]),
                "p1_orders": int(r[3] or 0),
                "downtime_avoided_min": int(r[4] or 0),
            }
            for r in _filtered(
                self.db.query(
                    MaintenanceWorkOrder.machine_id,
                    MaintenanceWorkOrder.plant_id,
                    func.count(MaintenanceWorkOrder.work_order_id),
                    func.sum(case((MaintenanceWorkOrder.priority == "P1", 1), else_=0)),
                    func.sum(MaintenanceWorkOrder.downtime_avoided_estimate_min),
                )
            )
            .group_by(MaintenanceWorkOrder.machine_id, MaintenanceWorkOrder.plant_id)
            .order_by(func.sum(case((MaintenanceWorkOrder.priority == "P1", 1), else_=0)).desc(), func.count(MaintenanceWorkOrder.work_order_id).desc())
            .limit(8)
            .all()
        ]

        p1_samples = (
            _filtered(
                self.db.query(MaintenanceWorkOrder).filter(MaintenanceWorkOrder.priority == "P1")
            )
            .order_by(
                case((MaintenanceWorkOrder.status == "IN_PROGRESS", 0), (MaintenanceWorkOrder.status == "PLANNED", 1), else_=2),
                MaintenanceWorkOrder.created_ts.desc(),
            )
            .limit(8)
            .all()
        )

        payload = {
            "plant_scope": plant or "ALL",
            "date_range": {
                "start": agg_row[1].isoformat() if agg_row[1] else None,
                "end": agg_row[2].isoformat() if agg_row[2] else None,
            },
            "total_work_orders": total_orders,
            "p1_priority_total": p1_total,
            "p1_not_completed_count": p1_open_or_active,
            "downtime_avoided_estimate_min": downtime_min,
            "downtime_avoided_hours": round(downtime_min / 60.0, 1),
            "orders_missing_actual_start": no_actual_start,
            "by_priority": _group_mwo(MaintenanceWorkOrder.priority),
            "by_status": _group_mwo(MaintenanceWorkOrder.status),
            "by_maintenance_type": _group_mwo(MaintenanceWorkOrder.maintenance_type),
            "by_failure_mode": _group_mwo(MaintenanceWorkOrder.failure_mode),
            "by_plant": _group_mwo(MaintenanceWorkOrder.plant_id),
            "priority_status_matrix": priority_status,
            "top_p1_machines": top_machines,
            "sample_p1_work_orders": [
                {
                    "work_order_id": m.work_order_id,
                    "machine_id": m.machine_id,
                    "plant_id": m.plant_id,
                    "maintenance_type": m.maintenance_type,
                    "failure_mode": m.failure_mode,
                    "priority": m.priority,
                    "status": m.status,
                    "technician_id": m.technician_id,
                    "downtime_avoided_estimate_min": m.downtime_avoided_estimate_min,
                    "planned_start": m.planned_start.isoformat(),
                }
                for m in p1_samples
            ],
        }

        evidence = [
            EvidenceItem(
                id="MWO-SUMMARY",
                label="Maintenance Priority & Downtime Avoided",
                dataset_source="ehs_core.fact_maintenance_work_order",
                value=f"{total_orders} orders ({p1_total} P1 / {p1_open_or_active} P1 active/planned)",
                excerpt=f"Estimated downtime avoided: {downtime_min:,} min ({round(downtime_min / 60.0, 1)} hrs)",
            )
        ]
        for s in payload["sample_p1_work_orders"][:3]:
            evidence.append(
                EvidenceItem(
                    id=s["work_order_id"],
                    label=f"{s['machine_id']} • {s['failure_mode']} ({s['plant_id']})",
                    dataset_source="ehs_core.fact_maintenance_work_order",
                    value=f"{s['priority']} / {s['status']}",
                    excerpt=f"Tech {s['technician_id']} • {s['downtime_avoided_estimate_min']} min saved",
                )
            )
        return payload, evidence, total_orders

    def get_capa_monitoring_data(self, plant_id: Optional[str] = None) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        plant = _normalize_plant_filter(plant_id)
        today = date.today()

        def _filtered(q):
            return q.filter(EhsEvent.plant_id == plant) if plant else q

        agg_row = _filtered(
            self.db.query(
                func.count(EhsEvent.ehs_event_id),
                func.sum(case((EhsEvent.action_status == "OPEN", 1), else_=0)),
                func.sum(case((EhsEvent.action_status == "IN_PROGRESS", 1), else_=0)),
                func.sum(case((EhsEvent.action_status == "CLOSED", 1), else_=0)),
                func.sum(
                    case(
                        ((EhsEvent.action_status != "CLOSED") & (EhsEvent.due_date < today), 1),
                        else_=0,
                    )
                ),
                func.sum(
                    case(
                        (
                            (EhsEvent.action_status != "CLOSED")
                            & (EhsEvent.due_date < today)
                            & (EhsEvent.risk_severity.in_(["CRITICAL", "HIGH"])),
                            1,
                        ),
                        else_=0,
                    )
                ),
            )
        ).one()

        total_capas = int(agg_row[0] or 0)
        open_cnt = int(agg_row[1] or 0)
        in_prog_cnt = int(agg_row[2] or 0)
        closed_cnt = int(agg_row[3] or 0)
        overdue_cnt = int(agg_row[4] or 0)
        overdue_high_crit_cnt = int(agg_row[5] or 0)
        pending_cnt = open_cnt + in_prog_cnt

        overdue_by_plant = {
            r[0]: int(r[1])
            for r in _filtered(
                self.db.query(EhsEvent.plant_id, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.action_status != "CLOSED", EhsEvent.due_date < today
                )
            )
            .group_by(EhsEvent.plant_id)
            .all()
        }
        overdue_by_severity = {
            r[0]: int(r[1])
            for r in _filtered(
                self.db.query(EhsEvent.risk_severity, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.action_status != "CLOSED", EhsEvent.due_date < today
                )
            )
            .group_by(EhsEvent.risk_severity)
            .all()
        }
        top_owners_overdue = [
            {"action_owner": r[0], "overdue_count": int(r[1])}
            for r in _filtered(
                self.db.query(EhsEvent.action_owner, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.action_status != "CLOSED", EhsEvent.due_date < today
                )
            )
            .group_by(EhsEvent.action_owner)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .limit(8)
            .all()
        ]

        priority_overdue_rows = (
            _filtered(
                self.db.query(EhsEvent).filter(
                    EhsEvent.action_status != "CLOSED",
                    EhsEvent.due_date < today,
                )
            )
            .order_by(
                case((EhsEvent.risk_severity == "CRITICAL", 0), (EhsEvent.risk_severity == "HIGH", 1), else_=2),
                EhsEvent.due_date.asc(),
            )
            .limit(10)
            .all()
        )

        payload = {
            "plant_scope": plant or "ALL",
            "evaluation_date": today.isoformat(),
            "total_capa_records": total_capas,
            "open_count": open_cnt,
            "in_progress_count": in_prog_cnt,
            "pending_total_count": pending_cnt,
            "closed_count": closed_cnt,
            "closure_rate_pct": round((closed_cnt / total_capas * 100), 1) if total_capas else 0.0,
            "overdue_total_count": overdue_cnt,
            "overdue_high_or_critical_count": overdue_high_crit_cnt,
            "overdue_by_plant": overdue_by_plant,
            "overdue_by_severity": overdue_by_severity,
            "top_overdue_action_owners": top_owners_overdue,
            "sample_overdue_actions": [
                {
                    "ehs_event_id": r.ehs_event_id,
                    "plant_id": r.plant_id,
                    "area": r.area,
                    "event_type": r.event_type,
                    "hazard_category": r.hazard_category,
                    "risk_severity": r.risk_severity,
                    "action_status": r.action_status,
                    "action_owner": r.action_owner,
                    "due_date": r.due_date.isoformat(),
                    "days_overdue": (today - r.due_date).days,
                }
                for r in priority_overdue_rows
            ],
        }

        evidence = [
            EvidenceItem(
                id="CAPA-STATUS",
                label="CAPA Status & Overdue Breakdown",
                dataset_source="ehs_core.fact_ehs_event",
                value=f"{pending_cnt} pending ({open_cnt} OPEN, {in_prog_cnt} IN_PROGRESS) / {closed_cnt} CLOSED",
                excerpt=f"{overdue_cnt} overdue as of {today.isoformat()} ({overdue_high_crit_cnt} HIGH/CRITICAL)",
            )
        ]
        for row in payload["sample_overdue_actions"][:3]:
            evidence.append(
                EvidenceItem(
                    id=row["ehs_event_id"],
                    label=f"Overdue CAPA • {row['area']} ({row['plant_id']})",
                    dataset_source="ehs_core.fact_ehs_event",
                    value=f"{row['risk_severity']} / {row['days_overdue']}d overdue",
                    excerpt=f"Owner {row['action_owner']} • Due {row['due_date']} ({row['action_status']})",
                )
            )
        return payload, evidence, total_capas

    def get_permit_compliance_data(self, plant_id: Optional[str] = None) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        plant = _normalize_plant_filter(plant_id)

        def _filtered(q):
            return q.filter(EhsEvent.plant_id == plant) if plant else q

        agg_row = _filtered(
            self.db.query(
                func.count(EhsEvent.ehs_event_id),
                func.count(func.distinct(EhsEvent.permit_id)),
                func.sum(case((EhsEvent.event_type == "PERMIT_EXCEPTION", 1), else_=0)),
                func.sum(
                    case(
                        ((EhsEvent.event_type == "PERMIT_EXCEPTION") & (EhsEvent.action_status != "CLOSED"), 1),
                        else_=0,
                    )
                ),
                func.sum(
                    case(
                        ((EhsEvent.event_type == "PERMIT_EXCEPTION") & (EhsEvent.risk_severity.in_(["CRITICAL", "HIGH"])), 1),
                        else_=0,
                    )
                ),
            )
        ).one()

        total_events = int(agg_row[0] or 0)
        distinct_permits = int(agg_row[1] or 0)
        exception_total = int(agg_row[2] or 0)
        exception_open = int(agg_row[3] or 0)
        exception_high_crit = int(agg_row[4] or 0)

        exceptions_by_area = {
            r[0]: int(r[1])
            for r in _filtered(
                self.db.query(EhsEvent.area, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type == "PERMIT_EXCEPTION"
                )
            )
            .group_by(EhsEvent.area)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .all()
        }
        exceptions_by_plant = {
            r[0]: int(r[1])
            for r in _filtered(
                self.db.query(EhsEvent.plant_id, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type == "PERMIT_EXCEPTION"
                )
            )
            .group_by(EhsEvent.plant_id)
            .all()
        }
        exceptions_by_category = {
            r[0]: int(r[1])
            for r in _filtered(
                self.db.query(EhsEvent.hazard_category, func.count(EhsEvent.ehs_event_id)).filter(
                    EhsEvent.event_type == "PERMIT_EXCEPTION"
                )
            )
            .group_by(EhsEvent.hazard_category)
            .order_by(func.count(EhsEvent.ehs_event_id).desc())
            .all()
        }

        sample_exceptions = (
            _filtered(self.db.query(EhsEvent).filter(EhsEvent.event_type == "PERMIT_EXCEPTION"))
            .order_by(
                case((EhsEvent.action_status != "CLOSED", 0), else_=1),
                case((EhsEvent.risk_severity == "CRITICAL", 0), (EhsEvent.risk_severity == "HIGH", 1), else_=2),
                EhsEvent.event_ts.desc(),
            )
            .limit(8)
            .all()
        )

        payload = {
            "plant_scope": plant or "ALL",
            "total_events_with_permit_ref": total_events,
            "distinct_permit_ids": distinct_permits,
            "permit_exception_total": exception_total,
            "permit_exception_open_or_in_progress": exception_open,
            "permit_exception_high_or_critical": exception_high_crit,
            "exceptions_by_plant": exceptions_by_plant,
            "exceptions_by_area": exceptions_by_area,
            "exceptions_by_hazard_category": exceptions_by_category,
            "sample_permit_exceptions": [
                {
                    "ehs_event_id": r.ehs_event_id,
                    "permit_id": r.permit_id,
                    "plant_id": r.plant_id,
                    "area": r.area,
                    "shift": get_shift_display_label(r.shift_id),
                    "hazard_category": r.hazard_category,
                    "risk_severity": r.risk_severity,
                    "action_status": r.action_status,
                    "action_owner": r.action_owner,
                    "due_date": r.due_date.isoformat(),
                }
                for r in sample_exceptions
            ],
        }

        evidence = [
            EvidenceItem(
                id="PERMIT-EXCEPTIONS",
                label="Permit Exception Events & Referenced Permits",
                dataset_source="ehs_core.fact_ehs_event",
                value=f"{exception_total} PERMIT_EXCEPTION ({exception_open} open/in-progress)",
                excerpt=f"{distinct_permits} unique permit_id values referenced; {exception_high_crit} HIGH/CRITICAL exceptions",
            )
        ]
        for row in payload["sample_permit_exceptions"][:3]:
            evidence.append(
                EvidenceItem(
                    id=row["permit_id"],
                    label=f"Permit Exception {row['ehs_event_id']} • {row['area']}",
                    dataset_source="ehs_core.fact_ehs_event",
                    value=f"{row['risk_severity']} / {row['action_status']}",
                    excerpt=f"Plant {row['plant_id']} • Category {row['hazard_category']}",
                )
            )
        return payload, evidence, total_events

