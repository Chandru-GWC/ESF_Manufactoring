"""Tool 2: run_query - run ONE read-only SELECT over the approved tables."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.agents.tools.sql_guard import QueryRejected, scope_sql, validate_sql

MAX_ROWS = 50
STATEMENT_TIMEOUT_MS = 8000


def _jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value) if value % 1 else int(value)
    if value is None or isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def _execute(db: Session, sql: str, max_rows: int) -> Dict[str, Any]:
    bind = db.get_bind()
    with bind.connect() as conn:
        if bind.dialect.name == "postgresql":
            conn.execute(text("SET TRANSACTION READ ONLY"))
            conn.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))
        try:
            result = conn.execute(text(sql))
            columns = list(result.keys())
            fetched = result.fetchmany(max_rows + 1)
        finally:
            conn.rollback()
    truncated = len(fetched) > max_rows
    rows = [[_jsonable(v) for v in row] for row in fetched[:max_rows]]
    return {"columns": columns, "rows": rows, "row_count": len(rows), "truncated": truncated}


def run_query(db: Session, sql: str, plant_id: Optional[str] = None, max_rows: int = MAX_ROWS) -> Dict[str, Any]:
    """Tool 2: run one read-only SELECT. Raises QueryRejected for unsafe SQL; DB errors are re-raised as QueryRejected."""
    cleaned = validate_sql(sql)
    final_sql = scope_sql(cleaned, plant_id)
    try:
        out = _execute(db, final_sql, max_rows)
    except QueryRejected:
        raise
    except Exception as exc:  # syntax error, unknown column, timeout ...
        message = str(getattr(exc, "orig", exc)).strip().splitlines()[0][:300]
        raise QueryRejected(f"The database could not run the query: {message}") from exc
    out["sql"] = cleaned
    return out
