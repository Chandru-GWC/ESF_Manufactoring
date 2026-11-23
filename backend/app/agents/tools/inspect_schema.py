"""Tool 1: inspect_schema - columns, meanings and allowed values of one table."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.agents.tools.catalog import RELATIONSHIPS, SCHEMA, TABLES
from app.agents.tools.run_query import run_query
from app.agents.tools.sql_guard import QueryRejected

_SCHEMA_CACHE: Dict[str, Dict[str, Any]] = {}


def inspect_schema(db: Session, table: str, plant_id: Optional[str] = None) -> Dict[str, Any]:
    """Tool 1: columns, meanings and allowed values for one table (cached in memory)."""
    key = (table or "").strip().lower().removeprefix(f"{SCHEMA}.")
    cache_key = f"{key}:{plant_id or 'ALL'}"
    if cache_key in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[cache_key]

    doc = TABLES.get(key)
    if doc is None:
        raise QueryRejected(f"Unknown table '{table}'. Available tables: {', '.join(TABLES)}.")

    info: Dict[str, Any] = {
        "table": f"{SCHEMA}.{doc.name}",
        "description": doc.description,
        "primary_key": doc.primary_key,
        "columns": doc.columns,
        "relationships": RELATIONSHIPS,
    }
    count = run_query(db, f"SELECT COUNT(*) AS n FROM {doc.name}", plant_id)
    info["row_count"] = count["rows"][0][0] if count["rows"] else 0

    values: Dict[str, List[Any]] = {}
    for col in doc.categorical:
        distinct = run_query(db, f"SELECT DISTINCT {col} FROM {doc.name} ORDER BY 1", plant_id, max_rows=15)
        if not distinct["truncated"]:  # only low-cardinality columns are listed
            values[col] = [r[0] for r in distinct["rows"]]
    info["allowed_values"] = values

    _SCHEMA_CACHE[cache_key] = info
    return info
