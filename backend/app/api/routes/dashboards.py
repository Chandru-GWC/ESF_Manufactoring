"""Overview dashboards (events, attendance, machine) and their Excel / PDF downloads."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import plant_filter
from app.schemas.dashboard import DashboardKind, DashboardResponse
from app.services.dashboards import builders
from app.services.dashboards.export import build_pdf, build_xlsx

router = APIRouter(prefix="/dashboards", tags=["Overview dashboards"])

_MEDIA = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}
_COLUMNS = {
    "events": builders.EVENT_COLUMNS,
    "attendance": builders.ATTENDANCE_COLUMNS,
    "maintenance": builders.MAINTENANCE_COLUMNS,
}


@router.get("/{kind}", response_model=DashboardResponse)
def get_dashboard(
    kind: DashboardKind,
    plant_id: Optional[str] = Query(None, description="ALL, IN-KA-01 or IN-TN-01"),
    refresh: bool = Query(False, description="Skip the short in-memory cache"),
    db: Session = Depends(get_db),
):
    """Five KPIs, four charts (area, line, heatmap, donut) and the first five table rows of one table."""
    return builders.build_dashboard(db, kind, plant_filter(plant_id), use_cache=not refresh)


@router.get("/{kind}/export")
def export_dashboard(
    kind: DashboardKind,
    format: Literal["xlsx", "pdf"] = Query("xlsx"),
    plant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Download the dashboard's table (every row) as an Excel workbook, or a PDF report with the KPIs."""
    plant = plant_filter(plant_id)
    dash = builders.build_dashboard(db, kind, plant)
    columns = _COLUMNS[kind]
    rows = [[r[c] for c in columns] for r in builders.load_rows(db, kind, plant)]
    content = build_xlsx(dash, columns, rows) if format == "xlsx" else build_pdf(dash, columns, rows)
    scope = (plant or "all-plants").lower()
    filename = f"{dash.title.lower().replace(' ', '_')}_{scope}_{datetime.now():%Y-%m-%d}.{format}"
    return Response(
        content=content,
        media_type=_MEDIA[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Access-Control-Expose-Headers": "Content-Disposition"},
    )
