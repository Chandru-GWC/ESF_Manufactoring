"""
Tool 3: get_chart_format - the 10 charts the agent can draw and the exact JSON format of each.

The agent calls get_chart_format(chart_type) to learn the format, then puts a chart object in that format
(filled with values copied from its query results) into the `charts` list of its final answer.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Dict, List

from app.agents.tools.sql_guard import QueryRejected


@dataclass(frozen=True)
class ChartDoc:
    name: str
    use_when: str
    data_shape: str  # series | slices | cells
    rules: List[str]
    example: Dict[str, Any]


def _series_chart(kind: str, title: str, x_label: str, y_label: str, series: List[Dict[str, Any]], unit: str = "", subtitle: str = "") -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "type": kind,
        "title": title,
        "x_axis": {"label": x_label},
        "y_axis": {"label": y_label},
        "series": series,
    }
    if subtitle:
        out["subtitle"] = subtitle
    if unit:
        out["unit"] = unit
    return out


_AREAS = ["SMT", "TEST", "PACKAGING", "WAREHOUSE"]

CHARTS: Dict[str, ChartDoc] = {
    "line": ChartDoc(
        name="Line chart",
        use_when="A trend of one or more values over time or over an ordered sequence (days, weeks, months, shifts).",
        data_shape="series",
        rules=[
            "x values must already be in the right order (oldest first).",
            "Each series has the same x values. Use at most 4 series and 24 points per series.",
        ],
        example=_series_chart(
            "line", "Events per month", "Month", "Events",
            [{"name": "Events", "data": [{"x": "2026-08", "y": 120}, {"x": "2026-09", "y": 134}, {"x": "2026-10", "y": 146}]}],
            unit="events",
        ),
    ),
    "area": ChartDoc(
        name="Area chart",
        use_when="A trend where the size of the total matters (volume over time, cumulative amounts).",
        data_shape="series",
        rules=[
            "Same format as the line chart; the area under each line is filled.",
            "Use at most 3 series and 24 points per series.",
        ],
        example=_series_chart(
            "area", "Open corrective actions per month", "Month", "Open actions",
            [{"name": "Open actions", "data": [{"x": "2026-08", "y": 70}, {"x": "2026-09", "y": 88}, {"x": "2026-10", "y": 99}]}],
            unit="actions",
        ),
    ),
    "bar": ChartDoc(
        name="Bar chart",
        use_when="Compare one value across a few categories (areas, plants, shifts, hazard categories).",
        data_shape="series",
        rules=["One series. At most 15 categories. Sort from largest to smallest unless the categories have a natural order."],
        example=_series_chart(
            "bar", "Events by area", "Area", "Events",
            [{"name": "Events", "data": [{"x": a, "y": v} for a, v in zip(_AREAS, [67, 68, 67, 71])]}],
            unit="events",
        ),
    ),
    "horizontal_bar": ChartDoc(
        name="Horizontal bar chart",
        use_when="A ranking or top-N list, or categories with long names (equipment, employees, failure modes).",
        data_shape="series",
        rules=[
            "One series. Same format as the bar chart; the categories are drawn down the left side.",
            "Sort from largest to smallest and keep at most 10 items.",
        ],
        example=_series_chart(
            "horizontal_bar", "Top failure modes", "Failure mode", "Work orders",
            [{"name": "Work orders", "data": [{"x": "BELT_MISALIGNMENT", "y": 41}, {"x": "BEARING_WEAR", "y": 37}, {"x": "MOTOR_OVERHEAT", "y": 29}]}],
            unit="work orders",
        ),
    ),
    "stacked_bar": ChartDoc(
        name="Stacked bar chart",
        use_when="A total per category split into parts (events per area split by severity).",
        data_shape="series",
        rules=[
            "At least 2 series (the parts). Every series lists the same categories in the same order.",
            "At most 6 series and 12 categories.",
        ],
        example=_series_chart(
            "stacked_bar", "Events by area and severity", "Area", "Events",
            [
                {"name": "CRITICAL", "data": [{"x": "SMT", "y": 14}, {"x": "TEST", "y": 18}]},
                {"name": "HIGH", "data": [{"x": "SMT", "y": 12}, {"x": "TEST", "y": 15}]},
            ],
            unit="events",
        ),
    ),
    "grouped_bar": ChartDoc(
        name="Grouped bar chart",
        use_when="Compare 2-4 values side by side for each category (open vs closed per area, plant A vs plant B).",
        data_shape="series",
        rules=["2 to 4 series. Every series lists the same categories in the same order. At most 10 categories."],
        example=_series_chart(
            "grouped_bar", "Open vs closed actions by area", "Area", "Actions",
            [
                {"name": "Open", "data": [{"x": "SMT", "y": 41}, {"x": "TEST", "y": 45}]},
                {"name": "Closed", "data": [{"x": "SMT", "y": 26}, {"x": "TEST", "y": 23}]},
            ],
            unit="actions",
        ),
    ),
    "pie": ChartDoc(
        name="Pie chart",
        use_when="The share of each part in a whole (hazard categories as a share of all events). Few parts only.",
        data_shape="slices",
        rules=[
            "2 to 8 slices with positive values that make up one whole. No axes are needed (x_axis/y_axis are ignored).",
            "Never leave a category out: if there are more than 8, merge the smallest into one slice named 'Other'.",
        ],
        example={
            "type": "pie",
            "title": "Share of events by hazard category",
            "unit": "events",
            "slices": [{"label": "FORKLIFT", "value": 68}, {"label": "CHEMICAL", "value": 63}, {"label": "FIRE", "value": 56}],
        },
    ),
    "donut": ChartDoc(
        name="Donut chart",
        use_when="Like a pie chart, when the total in the centre matters (status split of all corrective actions).",
        data_shape="slices",
        rules=[
            "2 to 8 slices with positive values. The total is shown in the centre automatically, so ALL categories must be included.",
            "If there are more than 8 categories, merge the smallest into one slice named 'Other' so the total stays correct.",
        ],
        example={
            "type": "donut",
            "title": "Corrective action status",
            "unit": "actions",
            "slices": [{"label": "OPEN", "value": 130}, {"label": "IN_PROGRESS", "value": 127}, {"label": "CLOSED", "value": 143}],
        },
    ),
    "heatmap": ChartDoc(
        name="Heatmap",
        use_when="Intensity across two categories (events by area and shift, severity by area, hours by weekday and shift).",
        data_shape="cells",
        rules=[
            "cells: one object per combination {x, y, value}; x = the columns, y = the rows.",
            "Include every combination (use 0 when empty). At most 12 x values and 12 y values.",
        ],
        example={
            "type": "heatmap",
            "title": "Events by area and shift",
            "x_axis": {"label": "Shift"},
            "y_axis": {"label": "Area"},
            "unit": "events",
            "cells": [
                {"x": "A", "y": "SMT", "value": 22}, {"x": "B", "y": "SMT", "value": 18}, {"x": "C", "y": "SMT", "value": 27},
                {"x": "A", "y": "TEST", "value": 25}, {"x": "B", "y": "TEST", "value": 20}, {"x": "C", "y": "TEST", "value": 23},
            ],
        },
    ),
    "scatter": ChartDoc(
        name="Scatter plot",
        use_when="The relationship between two numbers (overtime hours vs actual hours, downtime avoided vs work order age).",
        data_shape="series",
        rules=[
            "x and y must both be numbers. Each point may have an optional short `label`.",
            "At most 3 series and 80 points in total.",
        ],
        example=_series_chart(
            "scatter", "Overtime vs actual hours", "Actual hours", "Overtime hours",
            [{"name": "Employees", "data": [{"x": 8, "y": 0}, {"x": 9, "y": 1, "label": "EMP-0012"}, {"x": 10, "y": 2}]}],
        ),
    ),
}

CHART_TYPES: List[str] = list(CHARTS)

_COMMON_RULES = [
    "Copy every number from your query results; never invent or estimate values.",
    "Include ALL the data of the query. If there are too many items, show the largest and add one 'Other' item for the rest, so totals stay correct.",
    "title is required and says what the chart shows. subtitle is optional.",
    "x_axis.label and y_axis.label name the dimension and the measured value; unit is optional (for example 'events').",
]


def get_chart_format(chart_type: str) -> Dict[str, Any]:
    """Tool 3: the JSON format of one chart type, with rules and a complete example."""
    key = (chart_type or "").strip().lower().replace(" ", "_").replace("-", "_")
    doc = CHARTS.get(key)
    if doc is None:
        raise QueryRejected(f"Unknown chart type '{chart_type}'. Available chart types: {', '.join(CHART_TYPES)}.")
    fields = {
        "series": "series: [{name, data: [{x, y}]}]",
        "slices": "slices: [{label, value}]",
        "cells": "cells: [{x, y, value}]",
    }[doc.data_shape]
    return {
        "chart_type": key,
        "name": doc.name,
        "use_when": doc.use_when,
        "required_fields": ["type", "title", fields],
        "rules": [*doc.rules, *_COMMON_RULES],
        "example": copy.deepcopy(doc.example),
    }


def chart_catalog() -> str:
    """One line per chart type for the agent instructions."""
    return "\n".join(f"- {key}: {doc.use_when}" for key, doc in CHARTS.items())
