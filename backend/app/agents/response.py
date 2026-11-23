"""
Checks the optional parts of the agent's answer (kpis, charts, table) before they reach the browser.

The agent is a language model, so its JSON can be wrong: a missing field, text where a number belongs, a pie chart
without slices. Every item is validated here; an item that cannot be fixed is dropped and a short note is returned,
so one bad chart never breaks the whole answer.
"""
from __future__ import annotations

import math
from typing import Any, List, Optional, Tuple

from pydantic import ValidationError

from app.schemas.ai_agent import ChartAxis, ChartCell, ChartPoint, ChartSeries, ChartSlice, ChartSpec, KpiItem, TableSpec

MAX_KPIS = 6
MAX_CHARTS = 4
MAX_SERIES = 8
MAX_POINTS = 60
MAX_SLICES = 12  # 8 are asked for; a little extra room before anything is cut
MAX_CELLS = 200
MAX_TABLE_ROWS = 50
MAX_TABLE_COLUMNS = 12

SERIES_TYPES = {"line", "area", "bar", "horizontal_bar", "stacked_bar", "grouped_bar", "scatter"}
SLICE_TYPES = {"pie", "donut"}


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _text(value: Any, limit: int = 160) -> str:
    return str(value if value is not None else "").strip()[:limit]


def clean_kpis(raw: Any) -> Tuple[List[KpiItem], List[str]]:
    items: List[KpiItem] = []
    notes: List[str] = []
    if not isinstance(raw, list):
        return items, notes
    for entry in raw[:MAX_KPIS]:
        if not isinstance(entry, dict) or not _text(entry.get("label")) or entry.get("value") in (None, ""):
            notes.append("A KPI without a label or value was dropped.")
            continue
        value = entry["value"]
        if not isinstance(value, (int, float, str)) or isinstance(value, bool):
            value = _text(value)
        tone = entry.get("tone") if entry.get("tone") in ("neutral", "good", "warning", "critical") else "neutral"
        items.append(
            KpiItem(
                label=_text(entry["label"], 60),
                value=value if not isinstance(value, str) else value[:40],
                unit=_text(entry.get("unit"), 20) or None,
                caption=_text(entry.get("caption"), 120) or None,
                tone=tone,
            )
        )
    return items, notes


def _clean_series(raw: Any, scatter: bool) -> List[ChartSeries]:
    out: List[ChartSeries] = []
    for s in (raw if isinstance(raw, list) else [])[:MAX_SERIES]:
        if not isinstance(s, dict):
            continue
        points: List[ChartPoint] = []
        for p in (s.get("data") if isinstance(s.get("data"), list) else [])[:MAX_POINTS]:
            if not isinstance(p, dict):
                continue
            y = _number(p.get("y"))
            x = p.get("x")
            if scatter:
                xn = _number(x)
                if xn is None or y is None:
                    continue
                points.append(ChartPoint(x=xn, y=y, label=_text(p.get("label"), 40) or None))
            else:
                if y is None or x in (None, ""):
                    continue
                points.append(ChartPoint(x=x if isinstance(x, (int, float)) and not isinstance(x, bool) else _text(x, 60), y=y))
        if points:
            out.append(ChartSeries(name=_text(s.get("name"), 60) or "Series", data=points))
    return out


def _clean_chart(raw: dict) -> ChartSpec:
    ctype = _text(raw.get("type")).lower().replace(" ", "_").replace("-", "_")
    title = _text(raw.get("title"), 120)
    if not title:
        raise ValueError("it has no title")
    base: dict = {
        "type": ctype,
        "title": title,
        "subtitle": _text(raw.get("subtitle"), 200) or None,
        "unit": _text(raw.get("unit"), 30) or None,
    }
    for axis in ("x_axis", "y_axis"):
        a = raw.get(axis)
        if isinstance(a, dict) and _text(a.get("label")):
            base[axis] = ChartAxis(label=_text(a.get("label"), 60))

    if ctype in SERIES_TYPES:
        series = _clean_series(raw.get("series"), scatter=ctype == "scatter")
        if not series:
            raise ValueError("it has no valid series data")
        if ctype in ("stacked_bar", "grouped_bar") and len(series) < 2:
            raise ValueError(f"a {ctype} chart needs at least 2 series")
        base["series"] = series
    elif ctype in SLICE_TYPES:
        slices = []
        for s in (raw.get("slices") if isinstance(raw.get("slices"), list) else [])[:MAX_SLICES]:
            value = _number(s.get("value")) if isinstance(s, dict) else None
            if value is not None and value > 0 and _text(s.get("label")):
                slices.append(ChartSlice(label=_text(s.get("label"), 60), value=value))
        if len(slices) < 2:
            raise ValueError("it needs at least 2 slices with positive values")
        base["slices"] = slices
    elif ctype == "heatmap":
        cells = []
        for c in (raw.get("cells") if isinstance(raw.get("cells"), list) else [])[:MAX_CELLS]:
            value = _number(c.get("value")) if isinstance(c, dict) else None
            if value is not None and _text(c.get("x")) and _text(c.get("y")):
                cells.append(ChartCell(x=_text(c.get("x"), 40), y=_text(c.get("y"), 40), value=value))
        if not cells:
            raise ValueError("it has no valid cells")
        base["cells"] = cells
    else:
        raise ValueError(f"'{raw.get('type')}' is not one of the supported chart types")
    return ChartSpec(**base)


def clean_charts(raw: Any) -> Tuple[List[ChartSpec], List[str]]:
    charts: List[ChartSpec] = []
    notes: List[str] = []
    if not isinstance(raw, list):
        return charts, notes
    for index, entry in enumerate(raw[:MAX_CHARTS], start=1):
        if not isinstance(entry, dict):
            notes.append(f"Chart {index} was dropped: it is not an object.")
            continue
        try:
            charts.append(_clean_chart(entry))
        except (ValueError, ValidationError) as exc:
            notes.append(f"Chart {index} ('{_text(entry.get('title'), 50) or entry.get('type')}') was dropped: {str(exc).splitlines()[0]}.")
    if len(raw) > MAX_CHARTS:
        notes.append(f"Only the first {MAX_CHARTS} charts are shown.")
    return charts, notes


def _cell(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value if not isinstance(value, float) or math.isfinite(value) else None
    return _text(value, 200)


def clean_table(raw: Any) -> Tuple[Optional[TableSpec], List[str]]:
    notes: List[str] = []
    if not isinstance(raw, dict):
        return None, notes
    columns = [_text(c, 60) for c in (raw.get("columns") if isinstance(raw.get("columns"), list) else [])][:MAX_TABLE_COLUMNS]
    rows_raw = raw.get("rows") if isinstance(raw.get("rows"), list) else []
    if not columns or not rows_raw:
        return None, ["The table was dropped: it has no columns or no rows."] if raw else []
    rows = []
    for r in rows_raw[:MAX_TABLE_ROWS]:
        if isinstance(r, dict):  # tolerate {column: value} rows
            r = [r.get(c) for c in columns]
        if not isinstance(r, list):
            continue
        r = list(r[: len(columns)]) + [None] * (len(columns) - len(r))
        rows.append([_cell(v) for v in r])
    if len(rows_raw) > MAX_TABLE_ROWS:
        notes.append(f"The table shows the first {MAX_TABLE_ROWS} of {len(rows_raw)} rows.")
    if not rows:
        return None, ["The table was dropped: no valid rows."]
    return TableSpec(title=_text(raw.get("title"), 120) or None, columns=columns, rows=rows), notes
