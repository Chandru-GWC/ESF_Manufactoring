"""Safety rules for agent-written SQL: validation and plant scoping."""
from __future__ import annotations

import re
from typing import Optional

from app.agents.tools.catalog import SCHEMA, TABLES


class QueryRejected(ValueError):
    """The SQL violates a safety rule. The message is shown to the agent so it can fix the query."""


_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|execute|merge|vacuum|analyze|"
    r"explain|listen|notify|lock|set|reset|show|begin|commit|rollback|savepoint|attach|detach|pragma|into|"
    r"pg_sleep|pg_read_file|lo_import|lo_export|dblink|set_config|current_setting|generate_series)\b",
    re.IGNORECASE,
)
_SYSTEM = re.compile(r"\b(pg_\w+|information_schema|sqlite_\w+)\b", re.IGNORECASE)
_OTHER_TABLES = re.compile(
    r"\b(users|safety_alerts|safety_alert_activity|app_notifications|app_notification_reads|video_safety_analyses|"
    r"data_connectors|connector_\w+)\b",
    re.IGNORECASE,
)
_FROM_TARGET = re.compile(r"\b(?:from|join)\s+(\"?[\w.]+\"?)", re.IGNORECASE)
_CTE_NAME = re.compile(r"(?:\bwith\s+|,\s*)(\w+)\s+as\s*\(", re.IGNORECASE)


_LITERAL_OR_COMMENT = re.compile(r"'(?:[^']|'')*'|/\*.*?\*/|--[^\n]*", re.DOTALL)


def _strip_comments(sql: str) -> str:
    """Remove SQL comments but leave '...' string literals untouched (a literal may contain '--')."""
    return _LITERAL_OR_COMMENT.sub(lambda m: m.group(0) if m.group(0).startswith("'") else " ", sql)


def validate_sql(sql: str) -> str:
    """Return the cleaned single statement or raise QueryRejected."""
    if not sql or not sql.strip():
        raise QueryRejected("The query is empty.")
    cleaned = _strip_comments(sql).strip()
    while cleaned.endswith(";"):
        cleaned = cleaned[:-1].rstrip()
    if ";" in cleaned:
        raise QueryRejected("Only a single SQL statement is allowed.")
    if not re.match(r"^(select|with)\b", cleaned, re.IGNORECASE):
        raise QueryRejected("Only SELECT queries are allowed (the query must start with SELECT or WITH).")
    if re.match(r"^with\s+recursive\b", cleaned, re.IGNORECASE):
        raise QueryRejected("Recursive queries are not allowed.")

    # String literals may legitimately contain words such as 'SET'; check keywords outside of them.
    without_literals = re.sub(r"'(?:[^']|'')*'", "''", cleaned)
    bad = _FORBIDDEN.search(without_literals)
    if bad:
        raise QueryRejected(f"'{bad.group(1)}' is not allowed. This tool is read-only.")
    if _SYSTEM.search(without_literals):
        raise QueryRejected("System tables and functions are not available.")
    if _OTHER_TABLES.search(without_literals):
        raise QueryRejected(f"Only these tables can be read: {', '.join(TABLES)}.")

    ctes = {m.lower() for m in _CTE_NAME.findall(without_literals)}
    for target in _FROM_TARGET.findall(without_literals):
        name = target.strip('"').lower()
        name = name.split(".")[-1] if name.startswith(f"{SCHEMA}.") else name
        if name in TABLES or name in ctes:
            continue
        if name.startswith("(") or not name:
            continue
        raise QueryRejected(f"Table '{target}' is not available. Use only: {', '.join(TABLES)}.")
    return cleaned


def _plant_literal(plant_id: Optional[str]) -> Optional[str]:
    if not plant_id or plant_id.strip().upper() == "ALL":
        return None
    plant = plant_id.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{1,32}", plant):
        raise QueryRejected("Invalid plant scope.")
    return plant


def scope_sql(cleaned: str, plant_id: Optional[str]) -> str:
    """Prefix shadow CTEs so the query can only read plant-scoped rows of the approved tables."""
    plant = _plant_literal(plant_id)
    where = f" WHERE plant_id = '{plant}'" if plant else ""
    # The agent may write 'ehs_core.table' or plain 'table'; both resolve to the shadow CTE below.
    body = re.sub(rf"\"?{SCHEMA}\"?\.", "", cleaned, flags=re.IGNORECASE)
    shadows = ", ".join(f"{name} AS (SELECT * FROM {SCHEMA}.{name}{where})" for name in TABLES)
    if re.match(r"^with\b", body, re.IGNORECASE):
        return f"WITH {shadows}, {body[4:].lstrip()}"
    return f"WITH {shadows} {body}"
