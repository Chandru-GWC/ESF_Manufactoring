"""
Builds the three Overview dashboards (events, attendance, maintenance).

Each dashboard has 5 KPIs, 4 charts (area, line, heatmap, donut) and a 5-row table. The data is read with ONE
query per table and aggregated here in Python, so it works the same on PostgreSQL and SQLite and costs a single
round trip to the (distant) database instead of one per chart.
"""
from __future__ import annotations

import threading
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from app.models.ehs_event import EhsEvent
from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance
from app.schemas.ai_agent import ChartAxis, ChartCell, ChartPoint, ChartSeries, ChartSlice, ChartSpec, KpiItem
from app.schemas.dashboard import DashboardKind, DashboardResponse, DashboardTable

SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
CACHE_SECONDS = 45

_cache: Dict[Tuple[str, str], Tuple[float, DashboardResponse]] = {}
_cache_lock = threading.Lock()


# --------------------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------------------
def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _day(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _month_key(d: date) -> Tuple[int, int]:
    return (d.year, d.month)


def _month_label(key: Tuple[int, int]) -> str:
    return datetime(key[0], key[1], 1).strftime("%b %Y")


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _week_label(d: date) -> str:
    return d.strftime("%d %b")


def _pct(part: float, whole: float) -> float:
    return round(100.0 * part / whole, 1) if whole else 0.0


def _kpi(label: str, value: Any, unit: Optional[str] = None, caption: Optional[str] = None, tone: str = "neutral") -> KpiItem:
    if isinstance(value, float):
        value = round(value, 1)
        if value == int(value):
            value = int(value)
    return KpiItem(label=label, value=value, unit=unit, caption=caption, tone=tone)  # type: ignore[arg-type]


def _axes(x: str, y: str) -> Dict[str, ChartAxis]:
    return {"x_axis": ChartAxis(label=x), "y_axis": ChartAxis(label=y)}


def _label(text: Any) -> str:
    return str(text or "Unknown").replace("_", " ").title()


def _plant_label(plant: Optional[str]) -> str:
    return plant if plant else "All plants"


def _iso(value: Any) -> Any:
    """JSON-friendly cell value for the table on the page."""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    if value is None or isinstance(value, (int, float, str, bool)):
        return value
    return float(value) if hasattr(value, "__float__") else str(value)


# --------------------------------------------------------------------------------------------------
# data access (also used by the export)
# --------------------------------------------------------------------------------------------------
EVENT_COLUMNS = ["ehs_event_id", "event_ts", "plant_id", "area", "shift_id", "event_type", "hazard_category",
                 "risk_severity", "lost_time_injury", "action_owner", "due_date", "action_status", "permit_id"]
ATTENDANCE_COLUMNS = ["attendance_id", "work_date", "employee_id", "plant_id", "shift_id", "scheduled_hours", "actual_hours",
                      "attendance_status", "overtime_hours", "skill_match", "training_compliance"]
MAINTENANCE_COLUMNS = ["work_order_id", "machine_id", "plant_id", "created_ts", "maintenance_type", "failure_mode", "priority",
                       "planned_start", "actual_start", "downtime_avoided_estimate_min", "status", "technician_id"]

_MODELS = {"events": (EhsEvent, EVENT_COLUMNS), "attendance": (WorkforceAttendance, ATTENDANCE_COLUMNS), "maintenance": (MaintenanceWorkOrder, MAINTENANCE_COLUMNS)}
SOURCE_TABLES = {
    "events": "ehs_core.fact_ehs_event",
    "attendance": "ehs_core.fact_workforce_attendance",
    "maintenance": "ehs_core.fact_maintenance_work_order",
}


def load_rows(db: Session, kind: str, plant: Optional[str]) -> List[Dict[str, Any]]:
    """All rows of the table as dicts, newest first. One query."""
    model, columns = _MODELS[kind]
    query = db.query(*[getattr(model, c) for c in columns])
    if plant:
        query = query.filter(model.plant_id == plant)
    order_column = {"events": "event_ts", "attendance": "work_date", "maintenance": "created_ts"}[kind]
    query = query.order_by(getattr(model, order_column).desc())
    return [dict(zip(columns, row)) for row in query.all()]


# --------------------------------------------------------------------------------------------------
# EVENTS
# --------------------------------------------------------------------------------------------------
def _events(rows: List[Dict[str, Any]], plant: Optional[str]) -> DashboardResponse:
    today = date.today()
    total = len(rows)
    open_rows = [r for r in rows if r["action_status"] != "CLOSED"]
    overdue = [r for r in open_rows if (_day(r["due_date"]) or today) < today]
    crit_high = [r for r in rows if r["risk_severity"] in ("CRITICAL", "HIGH")]
    closed = total - len(open_rows)
    closure = _pct(closed, total)

    kpis = [
        _kpi("Total events", total, caption="hazards, near-misses, first aid, audits"),
        _kpi("Open corrective actions", len(open_rows), caption=f"{_pct(len(open_rows), total)}% of all events", tone="warning" if open_rows else "good"),
        _kpi("Overdue actions", len(overdue), caption="open and past their due date", tone="critical" if overdue else "good"),
        _kpi("Critical + High events", len(crit_high), caption=f"{_pct(len(crit_high), total)}% of all events", tone="warning" if crit_high else "good"),
        _kpi("Action closure rate", closure, unit="%", caption=f"{closed} of {total} actions closed", tone="good" if closure >= 80 else "warning" if closure >= 50 else "critical"),
    ]

    by_month: Dict[Tuple[int, int], List[int]] = defaultdict(lambda: [0, 0])
    by_week: Dict[date, Counter] = defaultdict(Counter)
    heat: Counter = Counter()
    areas: set = set()
    categories: set = set()
    types: Counter = Counter()
    for r in rows:
        d = _day(r["event_ts"])
        if d:
            m = by_month[_month_key(d)]
            m[0] += 1
            m[1] += 1 if r["risk_severity"] in ("CRITICAL", "HIGH") else 0
            if r["risk_severity"] in ("CRITICAL", "HIGH"):
                by_week[_week_start(d)][r["risk_severity"]] += 1
            else:
                by_week[_week_start(d)]
        heat[(r["hazard_category"], r["area"])] += 1
        areas.add(r["area"])
        categories.add(r["hazard_category"])
        types[r["event_type"]] += 1

    months = sorted(by_month)
    weeks = sorted(by_week)
    cat_order = [c for c, _ in sorted(Counter(r["hazard_category"] for r in rows).items(), key=lambda kv: -kv[1])]
    area_order = sorted(areas)

    charts = [
        ChartSpec(
            type="area", title="Events per month", subtitle="All events and the critical + high ones", unit="events", **_axes("Month", "Events"),
            series=[
                ChartSeries(name="All events", data=[ChartPoint(x=_month_label(k), y=by_month[k][0]) for k in months]),
                ChartSeries(name="Critical + High", data=[ChartPoint(x=_month_label(k), y=by_month[k][1]) for k in months]),
            ] if months else [],
        ),
        ChartSpec(
            type="line", title="Critical and High events per week", subtitle="Weekly trend of the serious events", unit="events", **_axes("Week starting", "Events"),
            series=[
                ChartSeries(name=_label(sev), data=[ChartPoint(x=_week_label(w), y=by_week[w][sev]) for w in weeks])
                for sev in ("CRITICAL", "HIGH")
            ] if weeks else [],
        ),
        ChartSpec(
            type="heatmap", title="Events by hazard category and area", subtitle="Darker = more events", unit="events", **_axes("Area", "Hazard category"),
            cells=[ChartCell(x=_label(a), y=_label(c), value=heat[(c, a)]) for c in cat_order for a in area_order],
        ),
        ChartSpec(
            type="donut", title="Events by type", subtitle="What kind of events are logged", unit="events",
            slices=[ChartSlice(label=_label(t), value=n) for t, n in types.most_common()],
        ),
    ]

    sample = rows[:5]
    table = DashboardTable(
        title="Latest events",
        columns=["Event ID", "Time", "Plant", "Area", "Type", "Hazard", "Severity", "Action status", "Due date"],
        rows=[[r["ehs_event_id"], _iso(r["event_ts"]), r["plant_id"], _label(r["area"]), _label(r["event_type"]), _label(r["hazard_category"]),
               r["risk_severity"], _label(r["action_status"]), _iso(r["due_date"])] for r in sample],
        total_rows=total,
    )
    return _response("events", "Events dashboard", "Safety events, hazards and corrective actions", plant, kpis, charts, table)


# --------------------------------------------------------------------------------------------------
# ATTENDANCE
# --------------------------------------------------------------------------------------------------
def _attendance_groups(db: Session, plant: Optional[str]):
    """Attendance has ~16k rows, so it is summed in the database (3 small queries) instead of being downloaded."""
    from sqlalchemy import case, func

    m = WorkforceAttendance
    plant_filter = [m.plant_id == plant] if plant else []
    groups = (
        db.query(m.work_date, m.shift_id, m.attendance_status, func.count(), func.coalesce(func.sum(m.actual_hours), 0), func.coalesce(func.sum(m.overtime_hours), 0))
        .filter(*plant_filter).group_by(m.work_date, m.shift_id, m.attendance_status).all()
    )
    emp_total, emp_expired = db.query(
        func.count(func.distinct(m.employee_id)),
        func.count(func.distinct(case((m.training_compliance == "EXPIRED", m.employee_id)))),
    ).filter(*plant_filter).one()
    latest = (
        db.query(*[getattr(m, c) for c in ATTENDANCE_COLUMNS]).filter(*plant_filter).order_by(m.work_date.desc(), m.attendance_id.desc()).limit(5).all()
    )
    return groups, int(emp_total or 0), int(emp_expired or 0), [dict(zip(ATTENDANCE_COLUMNS, r)) for r in latest]


def _attendance(db: Session, plant: Optional[str]) -> DashboardResponse:
    groups, n_emp, n_expired, latest = _attendance_groups(db, plant)
    total = sum(int(g[3]) for g in groups)
    hours = sum(_num(g[4]) for g in groups)
    overtime = sum(_num(g[5]) for g in groups)
    turned_up = sum(int(g[3]) for g in groups if g[2] in ("PRESENT", "LATE"))
    attendance_rate = _pct(turned_up, total)

    kpis = [
        _kpi("Employees", n_emp, caption=f"{total:,} shift records"),
        _kpi("Hours worked", round(hours), unit="h", caption=f"{round(hours / n_emp) if n_emp else 0} h per employee"),
        _kpi("Overtime hours", round(overtime), unit="h", caption=f"{_pct(overtime, hours)}% of hours worked", tone="warning" if overtime else "good"),
        _kpi("Attendance rate", attendance_rate, unit="%", caption=f"{total - turned_up} absent or on leave", tone="good" if attendance_rate >= 95 else "warning"),
        _kpi("Employees with expired training", n_expired, caption=f"{_pct(n_expired, n_emp)}% of the workforce", tone="critical" if n_expired else "good"),
    ]

    week_hours: Dict[date, List[float]] = defaultdict(lambda: [0.0, 0.0])
    week_miss: Dict[date, Counter] = defaultdict(Counter)
    heat: Counter = Counter()
    status: Counter = Counter()
    shifts: set = set()
    for work_date, shift, st, n, act, ot in groups:
        n = int(n)
        d = _day(work_date)
        if d:
            w = _week_start(d)
            week_hours[w][0] += _num(act)
            week_hours[w][1] += _num(ot)
            if st in ("ABSENT", "LATE", "LEAVE"):
                week_miss[w][st] += n
                heat[(WEEKDAYS[d.weekday()], shift)] += n
            else:
                week_miss[w]
        shifts.add(shift)
        status[st] += n
    weeks = sorted(week_hours)
    shift_order = sorted(shifts)

    charts = [
        ChartSpec(
            type="area", title="Hours worked per week", subtitle="Actual hours and the overtime part", unit="hours", **_axes("Week starting", "Hours"),
            series=[
                ChartSeries(name="Actual hours", data=[ChartPoint(x=_week_label(w), y=round(week_hours[w][0])) for w in weeks]),
                ChartSeries(name="Overtime hours", data=[ChartPoint(x=_week_label(w), y=round(week_hours[w][1])) for w in weeks]),
            ] if weeks else [],
        ),
        ChartSpec(
            type="line", title="Absent, late and leave records per week", subtitle="Weekly trend of missed or late shifts", unit="records", **_axes("Week starting", "Records"),
            series=[
                ChartSeries(name=_label(s), data=[ChartPoint(x=_week_label(w), y=week_miss[w][s]) for w in weeks])
                for s in ("ABSENT", "LATE", "LEAVE")
            ] if weeks else [],
        ),
        ChartSpec(
            type="heatmap", title="Absent, late and leave by weekday and shift", subtitle="Darker = more missed shifts", unit="records", **_axes("Shift", "Weekday"),
            cells=[ChartCell(x=f"Shift {s}", y=d, value=heat[(d, s)]) for d in WEEKDAYS for s in shift_order],
        ),
        ChartSpec(
            type="donut", title="Attendance status", subtitle="Share of all shift records", unit="records",
            slices=[ChartSlice(label=_label(k), value=n) for k, n in status.most_common()],
        ),
    ]

    table = DashboardTable(
        title="Latest shift records",
        columns=["Attendance ID", "Date", "Employee", "Plant", "Shift", "Scheduled h", "Actual h", "Status", "Overtime h", "Skill match", "Training"],
        rows=[[r["attendance_id"], _iso(r["work_date"]), r["employee_id"], r["plant_id"], r["shift_id"], _iso(r["scheduled_hours"]), _iso(_num(r["actual_hours"])),
               _label(r["attendance_status"]), _iso(_num(r["overtime_hours"])), _label(r["skill_match"]), _label(r["training_compliance"])] for r in latest],
        total_rows=total,
    )
    return _response("attendance", "Attendance dashboard", "Shift attendance, hours and training status", plant, kpis, charts, table)


# --------------------------------------------------------------------------------------------------
# MAINTENANCE ("Machine")
# --------------------------------------------------------------------------------------------------
def _maintenance(rows: List[Dict[str, Any]], plant: Optional[str]) -> DashboardResponse:
    total = len(rows)
    open_orders = [r for r in rows if r["status"] != "COMPLETED"]
    open_p1 = [r for r in open_orders if r["priority"] == "P1"]
    completed = total - len(open_orders)
    completion = _pct(completed, total)
    downtime_h = sum(_num(r["downtime_avoided_estimate_min"]) for r in rows) / 60.0
    machines_open = {r["machine_id"] for r in open_orders}

    kpis = [
        _kpi("Work orders", total, caption=f"across {len({r['machine_id'] for r in rows})} machines"),
        _kpi("Open P1 orders", len(open_p1), caption="highest priority, not completed", tone="critical" if open_p1 else "good"),
        _kpi("Completion rate", completion, unit="%", caption=f"{completed} of {total} completed", tone="good" if completion >= 80 else "warning" if completion >= 50 else "critical"),
        _kpi("Downtime avoided", round(downtime_h), unit="h", caption="estimated by the work orders", tone="good"),
        _kpi("Machines with open orders", len(machines_open), caption=f"{len(open_orders)} open work orders", tone="warning" if machines_open else "good"),
    ]

    by_month: Dict[Tuple[int, int], Counter] = defaultdict(Counter)
    week_down: Dict[date, float] = defaultdict(float)
    heat: Counter = Counter()
    status: Counter = Counter()
    modes: Counter = Counter()
    types: set = set()
    for r in rows:
        d = _day(r["created_ts"])
        if d:
            by_month[_month_key(d)][r["maintenance_type"]] += 1
            week_down[_week_start(d)] += _num(r["downtime_avoided_estimate_min"]) / 60.0
        heat[(r["failure_mode"], r["priority"])] += 1
        modes[r["failure_mode"]] += 1
        types.add(r["maintenance_type"])
        status[r["status"]] += 1
    months = sorted(by_month)
    weeks = sorted(week_down)
    mode_order = [m for m, _ in modes.most_common(8)]

    charts = [
        ChartSpec(
            type="area", title="Work orders created per month", subtitle="By type of maintenance", unit="work orders", **_axes("Month", "Work orders"),
            series=[ChartSeries(name=_label(t), data=[ChartPoint(x=_month_label(k), y=by_month[k][t]) for k in months]) for t in sorted(types)] if months else [],
        ),
        ChartSpec(
            type="line", title="Downtime avoided per week", subtitle="Estimated hours of downtime the work orders avoided", unit="hours", **_axes("Week starting", "Hours"),
            series=[ChartSeries(name="Downtime avoided", data=[ChartPoint(x=_week_label(w), y=round(week_down[w], 1)) for w in weeks])] if weeks else [],
        ),
        ChartSpec(
            type="heatmap", title="Failure mode by priority", subtitle="Eight most common failure modes, darker = more work orders", unit="work orders", **_axes("Priority", "Failure mode"),
            cells=[ChartCell(x=p, y=_label(m), value=heat[(m, p)]) for m in mode_order for p in ("P1", "P2", "P3")],
        ),
        ChartSpec(
            type="donut", title="Work order status", subtitle="Where all work orders stand", unit="work orders",
            slices=[ChartSlice(label=_label(k), value=n) for k, n in status.most_common()],
        ),
    ]

    table = DashboardTable(
        title="Latest work orders",
        columns=["Work order", "Machine", "Plant", "Created", "Type", "Failure mode", "Priority", "Status", "Technician"],
        rows=[[r["work_order_id"], r["machine_id"], r["plant_id"], _iso(r["created_ts"]), _label(r["maintenance_type"]), _label(r["failure_mode"]),
               r["priority"], _label(r["status"]), r["technician_id"]] for r in rows[:5]],
        total_rows=total,
    )
    return _response("maintenance", "Machine dashboard", "Maintenance work orders, failures and downtime", plant, kpis, charts, table)


# --------------------------------------------------------------------------------------------------
_BUILDERS: Dict[str, Callable[[List[Dict[str, Any]], Optional[str]], DashboardResponse]] = {
    "events": _events,
    "maintenance": _maintenance,
}


def _response(kind: str, title: str, subtitle: str, plant: Optional[str], kpis: Sequence[KpiItem], charts: Sequence[ChartSpec], table: DashboardTable) -> DashboardResponse:
    assert len(kpis) == 5 and len(charts) == 4
    return DashboardResponse(
        kind=kind,  # type: ignore[arg-type]
        title=title,
        subtitle=subtitle,
        plant_scope=_plant_label(plant),
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        source_table=SOURCE_TABLES[kind],
        kpis=list(kpis),
        charts=list(charts),
        table=table,
    )


def build_dashboard(db: Session, kind: DashboardKind, plant: Optional[str] = None, use_cache: bool = True) -> DashboardResponse:
    key = (kind, plant or "ALL")
    now = time.monotonic()
    if use_cache:
        with _cache_lock:
            hit = _cache.get(key)
        if hit and now - hit[0] < CACHE_SECONDS:
            return hit[1]
    result = _attendance(db, plant) if kind == "attendance" else _BUILDERS[kind](load_rows(db, kind, plant), plant)
    with _cache_lock:
        _cache[key] = (now, result)
    return result


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()
