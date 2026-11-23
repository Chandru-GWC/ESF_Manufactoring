"""
SQLite Database Connector Adapter.
Standard library implementation with zero external driver dependencies.
Supports file databases and in-memory databases with schema, table, column discovery and read-only previews.
"""
from __future__ import annotations

import os
import sqlite3
import time
from typing import Any, Dict, List, Optional

from app.connectors.base import BaseConnector
from app.connectors.security import sanitize_sql_identifier, validate_read_only_clause
from app.schemas.connector import (
    ColumnMetadata,
    ConnectionTestResult,
    DataPreviewRequest,
    DataPreviewResponse,
    IndexMetadata,
    TableMetadata,
)


class SQLiteConnector(BaseConnector):
    @classmethod
    def get_db_type(cls) -> str:
        return "sqlite"

    def _get_path(self) -> str:
        # uri or database_name or host
        return self.uri or self.database_name or self.host or ":memory:"

    def connect(self) -> sqlite3.Connection:
        path = self._get_path()
        conn = sqlite3.connect(
            path,
            timeout=float(self.timeout_sec),
            check_same_thread=False,
        )
        conn.row_factory = sqlite3.Row
        self._is_connected = True
        return conn

    def disconnect(self) -> None:
        self._is_connected = False

    def test_connection(self) -> ConnectionTestResult:
        t0 = time.perf_counter()
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT sqlite_version();")
            version = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table';")
            tbl_count = cursor.fetchone()[0]
            conn.close()
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=True,
                status="CONNECTED",
                latency_ms=latency,
                message=f"Connected successfully to SQLite v{version} ({tbl_count} tables detected).",
                server_version=str(version),
                discovered_databases=["main"],
            )
        except Exception as e:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=False,
                status="FAILED",
                latency_ms=latency,
                message=f"SQLite connection failed: {str(e)}",
                error_code="SQLITE_ERROR",
                error_detail=str(e),
            )

    def get_databases(self) -> List[str]:
        return ["main"]

    def get_schemas(self) -> List[str]:
        return ["main"]

    def get_tables(self, schema: Optional[str] = None) -> List[TableMetadata]:
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name;")
            names = [row[0] for row in cursor.fetchall()]

            tables: List[TableMetadata] = []
            for name in names:
                cols = self._get_columns_internal(conn, name)
                idx = self._get_indexes_internal(conn, name)
                cursor.execute(f"SELECT count(*) FROM [{name}];")
                count = cursor.fetchone()[0]
                tables.append(
                    TableMetadata(
                        name=name,
                        schema_name="main",
                        columns=cols,
                        indexes=idx,
                        estimated_row_count=count,
                    )
                )
            return tables
        finally:
            conn.close()

    def _get_columns_internal(self, conn: sqlite3.Connection, table: str) -> List[ColumnMetadata]:
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info([{table}]);")
        cols: List[ColumnMetadata] = []
        for row in cursor.fetchall():
            # (cid, name, type, notnull, dflt_value, pk)
            cols.append(
                ColumnMetadata(
                    name=row[1],
                    data_type=row[2] or "TEXT",
                    is_nullable=not bool(row[3]),
                    is_primary_key=bool(row[5]),
                    default_value=str(row[4]) if row[4] is not None else None,
                )
            )
        return cols

    def _get_indexes_internal(self, conn: sqlite3.Connection, table: str) -> List[IndexMetadata]:
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA index_list([{table}]);")
        indexes: List[IndexMetadata] = []
        for row in cursor.fetchall():
            idx_name = row[1]
            is_unique = bool(row[2])
            cursor.execute(f"PRAGMA index_info([{idx_name}]);")
            col_names = [r[2] for r in cursor.fetchall()]
            indexes.append(
                IndexMetadata(
                    name=idx_name,
                    columns=col_names,
                    is_unique=is_unique,
                    is_primary=False,
                )
            )
        return indexes

    def get_columns(self, table: str, schema: Optional[str] = None) -> List[ColumnMetadata]:
        clean_table = sanitize_sql_identifier(table, "table")
        conn = self.connect()
        try:
            return self._get_columns_internal(conn, clean_table)
        finally:
            conn.close()

    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        t0 = time.perf_counter()
        clean_table = sanitize_sql_identifier(req.target, "table")
        validate_read_only_clause(req.filter_clause)

        conn = self.connect()
        try:
            cursor = conn.cursor()
            cols = self._get_columns_internal(conn, clean_table)
            col_names = [c.name for c in cols]
            col_types = {c.name: c.data_type for c in cols}

            # Selected columns
            selected = col_names
            if req.columns:
                clean_selected = [sanitize_sql_identifier(c, "column") for c in req.columns if c in col_names]
                if clean_selected:
                    selected = clean_selected

            cols_expr = ", ".join(f"[{c}]" for c in selected)
            sql = f"SELECT {cols_expr} FROM [{clean_table}]"
            if req.filter_clause:
                sql += f" WHERE {req.filter_clause}"
            sql += f" LIMIT {req.limit} OFFSET {req.offset};"

            cursor.execute(sql)
            rows = [dict(row) for row in cursor.fetchall()]

            cursor.execute(f"SELECT count(*) FROM [{clean_table}];")
            total = cursor.fetchone()[0]

            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return DataPreviewResponse(
                connector_id=self.connector_id,
                target=clean_table,
                schema_name="main",
                columns=selected,
                column_types=col_types,
                rows=rows,
                total_rows_estimate=total,
                limit=req.limit,
                offset=req.offset,
                execution_time_ms=elapsed,
                is_read_only=True,
            )
        finally:
            conn.close()

