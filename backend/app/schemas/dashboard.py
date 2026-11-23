"""Response contract of GET /api/v1/dashboards/{kind}: five KPIs, four charts and a five-row table."""
from __future__ import annotations

from typing import Any, List, Literal

from pydantic import BaseModel

from app.schemas.ai_agent import ChartSpec, KpiItem

DashboardKind = Literal["events", "attendance", "maintenance"]


class DashboardTable(BaseModel):
    title: str
    columns: List[str]
    rows: List[List[Any]]  # the first rows only (5); the export contains all rows
    total_rows: int


class DashboardResponse(BaseModel):
    kind: DashboardKind
    title: str
    subtitle: str
    plant_scope: str
    generated_at: str
    source_table: str
    kpis: List[KpiItem]  # always 5
    charts: List[ChartSpec]  # order: area, line, heatmap, donut
    table: DashboardTable
