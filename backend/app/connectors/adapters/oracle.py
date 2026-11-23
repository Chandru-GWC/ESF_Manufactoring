"""
Oracle Database Connector Adapter.
Uses python-oracledb in thin mode to discover services, schemas, tables, columns, indexes and preview records safely.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
import oracledb

from app.connectors.base import BaseConnector
from app.connectors.security import (
    sanitize_sql_identifier,
    validate_connection_target,
    validate_read_only_clause,
)
from app.schemas.connector import (
    ColumnMetadata,
    ConnectionTestResult,
    DataPreviewRequest,
    DataPreviewResponse,
    TableMetadata,
)


class OracleConnector(BaseConnector):
    @classmethod
    def get_db_type(cls) -> str:
        return "oracle"

    def connect(self) -> oracledb.Connection:
        validate_connection_target(self.host or "127.0.0.1", self.port or 1521)
        conn = oracledb.connect(
            user=self.username or "system",
            password=self.password or "",
            host=self.host or "127.0.0.1",
            port=self.port or 1521,
            service_name=self.database_name or "XE",
            tcp_connect_timeout=float(self.timeout_sec),
        )
        self._is_connected = True
        return conn

    def disconnect(self) -> None:
        self._is_connected = False

    def test_connection(self) -> ConnectionTestResult:
        t0 = time.perf_counter()
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1")
            row = cursor.fetchone()
            banner = row[0] if row else "Oracle Database"
            cursor.execute("SELECT sys_context('USERENV', 'DB_NAME') FROM DUAL")
            cur_db = cursor.fetchone()[0]
            conn.close()
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=True,
                status="CONNECTED",
                latency_ms=latency,
                message=f"Connected successfully to {banner} (Database: '{cur_db}').",
                server_version=banner,
                discovered_databases=[str(cur_db)],
            )
        except Exception as e:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=False,
                status="FAILED",
                latency_ms=latency,
                message=f"Oracle connection failed: {str(e)}",
                error_code="ORACLE_AUTH_OR_NETWORK_ERROR",
                error_detail=str(e),
            )

    def get_databases(self) -> List[str]:
        return [self.database_name or "XE"]

    def get_schemas(self) -> List[str]:
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT USERNAME FROM ALL_USERS ORDER BY USERNAME")
            schemas = [r[0] for r in cursor.fetchall()]
            if self.schema_filters:
                schemas = [s for s in schemas if s in self.schema_filters]
            return schemas
        finally:
            conn.close()

    def get_tables(self, schema: Optional[str] = None) -> List[TableMetadata]:
        owner = schema or self.username
        if not owner:
            return []
        clean_owner = sanitize_sql_identifier(owner.upper(), "owner")

        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :1 ORDER BY TABLE_NAME",
                [clean_owner],
            )
            tables = []
            for r in cursor.fetchall():
                tbl_name = r[0]
                cols = self._get_columns_internal(cursor, clean_owner, tbl_name)
                tables.append(
                    TableMetadata(
                        name=tbl_name,
                        schema_name=clean_owner,
                        columns=cols,
                    )
                )
            return tables
        finally:
            conn.close()

    def _get_columns_internal(self, cursor: Any, owner: str, table: str) -> List[ColumnMetadata]:
        cursor.execute(
            """
            SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT, DATA_LENGTH
            FROM ALL_TAB_COLUMNS
            WHERE OWNER = :1 AND TABLE_NAME = :2
            ORDER BY COLUMN_ID
            """,
            [owner, table],
        )
        cols = []
        for r in cursor.fetchall():
            cols.append(
                ColumnMetadata(
                    name=r[0],
                    data_type=r[1],
                    is_nullable=(r[2] == "Y"),
                    default_value=str(r[3]) if r[3] is not None else None,
                    max_length=r[4],
                )
            )
        return cols

    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        t0 = time.perf_counter()
        owner = sanitize_sql_identifier((req.schema_name or self.username or "SYSTEM").upper(), "owner")
        tbl = sanitize_sql_identifier(req.target.upper(), "table")
        validate_read_only_clause(req.filter_clause)

        conn = self.connect()
        try:
            cursor = conn.cursor()
            cols = self._get_columns_internal(cursor, owner, tbl)
            col_names = [c.name for c in cols]
            col_types = {c.name: c.data_type for c in cols}

            selected = col_names
            if req.columns:
                clean_selected = [sanitize_sql_identifier(c.upper(), "column") for c in req.columns if c.upper() in col_names]
                if clean_selected:
                    selected = clean_selected

            cols_expr = ", ".join(f'"{c}"' for c in selected)
            sql = f'SELECT {cols_expr} FROM "{owner}"."{tbl}"'
            if req.filter_clause:
                sql += f" WHERE {req.filter_clause}"
            sql += " OFFSET :1 ROWS FETCH NEXT :2 ROWS ONLY"

            cursor.execute(sql, [req.offset, req.limit])
            raw_rows = cursor.fetchall()
            dict_rows = [dict(zip(selected, row)) for row in raw_rows]

            cursor.execute(f'SELECT COUNT(*) FROM "{owner}"."{tbl}"')
            cnt_row = cursor.fetchone()
            total = cnt_row[0] if cnt_row else len(dict_rows)

            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return DataPreviewResponse(
                connector_id=self.connector_id,
                target=tbl,
                schema_name=owner,
                columns=selected,
                column_types=col_types,
                rows=dict_rows,
                total_rows_estimate=total,
                limit=req.limit,
                offset=req.offset,
                execution_time_ms=elapsed,
                is_read_only=True,
            )
        finally:
            conn.close()

