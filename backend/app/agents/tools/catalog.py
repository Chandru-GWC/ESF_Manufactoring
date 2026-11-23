"""Approved tables, their columns and meanings (source: backend/docs/EHS_DATA_DICTIONARY.md)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

SCHEMA = "ehs_core"


@dataclass(frozen=True)
class TableDoc:
    name: str
    description: str
    primary_key: str
    columns: Dict[str, str]
    #: columns with few distinct values - their allowed values are read live by inspect_schema
    categorical: List[str] = field(default_factory=list)


TABLES: Dict[str, TableDoc] = {
    "fact_ehs_event": TableDoc(
        name="fact_ehs_event",
        description=(
            "Safety event log: one row per hazard observation, near-miss, first-aid case, permit exception or "
            "audit finding in a plant area, plus the corrective action (CAPA) raised for it."
        ),
        primary_key="ehs_event_id",
        columns={
            "ehs_event_id": "text, primary key, e.g. EHS-00001 (cite it in answers)",
            "event_ts": "timestamp, when the event happened",
            "plant_id": "text, plant code",
            "area": "text, area inside the plant",
            "shift_id": "text, shift A/B/C",
            "event_type": "text, kind of event",
            "hazard_category": "text, type of hazard",
            "risk_severity": "text, LOW / MEDIUM / HIGH / CRITICAL",
            "lost_time_injury": "boolean, true when the event caused lost work time",
            "action_owner": "text, employee id (EMP-xxxx) who owns the corrective action",
            "due_date": "date, deadline of the corrective action; overdue = due_date < today AND action_status <> 'CLOSED'",
            "action_status": "text, OPEN / IN_PROGRESS / CLOSED",
            "permit_id": "text, permit-to-work reference (PTW-xxxx)",
        },
        categorical=["plant_id", "area", "shift_id", "event_type", "hazard_category", "risk_severity", "lost_time_injury", "action_status"],
    ),
    "fact_workforce_attendance": TableDoc(
        name="fact_workforce_attendance",
        description="Shift log: one row per employee per shift per day, with hours, overtime, skill fit and training status.",
        primary_key="attendance_id",
        columns={
            "attendance_id": "text, primary key, e.g. ATT-00000001",
            "work_date": "date, day of the shift",
            "employee_id": "text, employee id (EMP-xxxx)",
            "plant_id": "text, plant code",
            "shift_id": "text, shift A/B/C",
            "scheduled_hours": "number, planned hours (always 8)",
            "actual_hours": "number, hours actually worked",
            "attendance_status": "text, PRESENT / ABSENT / LEAVE / LATE",
            "overtime_hours": "number, hours beyond the schedule",
            "skill_match": "text, MATCHED / GAP (worker skills vs station)",
            "training_compliance": "text, CURRENT / EXPIRED (mandatory safety training)",
        },
        categorical=["plant_id", "shift_id", "attendance_status", "skill_match", "training_compliance"],
    ),
    "fact_maintenance_work_order": TableDoc(
        name="fact_maintenance_work_order",
        description="Maintenance log: one row per repair or service job on a machine (planned, in progress or completed).",
        primary_key="work_order_id",
        columns={
            "work_order_id": "text, primary key, e.g. MWO-00001",
            "machine_id": "text, machine tag, e.g. M-SMT-01",
            "plant_id": "text, plant code",
            "created_ts": "timestamp, when the job was raised",
            "maintenance_type": "text, PREVENTIVE / CORRECTIVE / PREDICTIVE",
            "failure_mode": "text, what is wrong, e.g. BEARING_WEAR",
            "priority": "text, P1 (most urgent) / P2 / P3",
            "planned_start": "timestamp, scheduled start",
            "actual_start": "timestamp, real start (may be empty)",
            "downtime_avoided_estimate_min": "number, estimated minutes of downtime avoided",
            "status": "text, PLANNED / IN_PROGRESS / COMPLETED",
            "technician_id": "text, employee id (EMP-xxxx) doing the work",
        },
        categorical=["plant_id", "maintenance_type", "failure_mode", "priority", "status", "machine_id"],
    ),
}

RELATIONSHIPS = (
    "The three tables have NO foreign keys between them. They share plant_id (and shift_id for events and attendance); "
    "action_owner, employee_id and technician_id are all employee ids (EMP-xxxx). Compare them by plant, shift or time "
    "period - never claim that a maintenance job belongs to a specific event."
)

STATIC_ALLOWED_VALUES = {
    "fact_ehs_event": {
        "plant_id": ["IN-KA-01", "IN-TN-01"],
        "area": ["FINAL_ASSEMBLY", "LOGISTICS", "PACKAGING", "SMT", "TEST", "UTILITIES", "WAREHOUSE"],
        "shift_id": ["A", "B", "C"],
        "event_type": ["FIRST_AID", "HAZARD_OBSERVATION", "NEAR_MISS", "PERMIT_EXCEPTION", "SAFETY_AUDIT"],
        "hazard_category": ["CHEMICAL_SPILL", "ELECTRICAL", "ERGONOMIC", "FIRE_SAFETY", "FORKLIFT", "FALL_HAZARD", "MACHINE_GUARDING", "PPE_NON_COMPLIANCE"],
        "risk_severity": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        "lost_time_injury": [False, True],
        "action_status": ["OPEN", "IN_PROGRESS", "CLOSED"],
    },
    "fact_workforce_attendance": {
        "plant_id": ["IN-KA-01", "IN-TN-01"],
        "shift_id": ["A", "B", "C"],
        "attendance_status": ["PRESENT", "ABSENT", "LEAVE", "LATE"],
        "skill_match": ["MATCHED", "GAP"],
        "training_compliance": ["CURRENT", "EXPIRED"],
    },
    "fact_maintenance_work_order": {
        "plant_id": ["IN-KA-01", "IN-TN-01"],
        "maintenance_type": ["PREVENTIVE", "CORRECTIVE", "PREDICTIVE"],
        "failure_mode": ["BEARING_WEAR", "CALIBRATION_ERROR", "ELECTRICAL_FAULT", "HYDRAULIC_LEAK", "OVERHEATING", "SENSOR_DRIFT"],
        "priority": ["P1", "P2", "P3"],
        "status": ["PLANNED", "IN_PROGRESS", "COMPLETED"],
    },
}


def schema_overview() -> str:
    """Compact table + column listing and allowed values for the agent instructions."""
    lines = []
    for doc in TABLES.values():
        val_str = ""
        if doc.name in STATIC_ALLOWED_VALUES:
            val_items = [f"{col}: [{', '.join(str(v) for v in vals)}]" for col, vals in STATIC_ALLOWED_VALUES[doc.name].items()]
            val_str = f"\n    allowed_values: {'; '.join(val_items)}"
        lines.append(f"- {SCHEMA}.{doc.name} ({doc.description})\n    columns: {', '.join(doc.columns)}{val_str}")
    return "\n".join(lines)
