"""
Microsoft SQL Server Database Connector Adapter.
Uses pymssql to discover databases, schemas, tables, columns, indexes and preview records safely.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
import pymssql

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
    IndexMetadata,
    TableMetadata,
)


class SQLServerConnector(BaseConnector):
    @classmethod
    def get_db_type(cls) -> str:
        return "sqlserver"

    def _get_connection_kwargs(self) -> Dict[str, Any]:
        validate_connection_target(self.host or "127.0.0.1", self.port or 1433)
        server_str = f"{self.host or '127.0.0.1'}:{self.port or 1433}"
        kwargs: Dict[str, Any] = {
            "server": server_str,
            "user": self.username or "sa",
            "database": self.database_name or "master",
            "timeout": self.timeout_sec,
            "as_dict": True,
        }
        if self.password:
            kwargs["password"] = self.password
        return kwargs

    def connect(self) -> pymssql.Connection:
        kwargs = self._get_connection_kwargs()
        conn = pymssql.connect(**kwargs)
        self._is_connected = True
        return conn

    def disconnect(self) -> None:
        self._is_connected = False

    def test_connection(self) -> ConnectionTestResult:
        t0 = time.perf_counter()
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT @@VERSION AS version, DB_NAME() AS cur_db;")
            row = cursor.fetchone()
            ver_full = row.get("version", "Microsoft SQL Server") if row else "MSSQL"
            ver_short = ver_full.split("-")[0].strip() if "-" in ver_full else "SQL Server"
            cur_db = row.get("cur_db", self.database_name) if row else self.database_name
            cursor.execute("SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb');")
            dbs = [r["name"] for r in cursor.fetchall()]
            conn.close()
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=True,
                status="CONNECTED",
                latency_ms=latency,
                message=f"Connected successfully to {ver_short} (Database: '{cur_db}', {len(dbs)} databases found).",
                server_version=ver_short,
                discovered_databases=dbs or [str(cur_db)],
            )
        except Exception as e:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=False,
                status="FAILED",
                latency_ms=latency,
                message=f"SQL Server connection failed: {str(e)}",
                error_code="MSSQL_AUTH_OR_NETWORK_ERROR",
                error_detail=str(e),
            )

    def get_databases(self) -> List[str]:
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb');")
            return [r["name"] for r in cursor.fetchall()]
        finally:
            conn.close()

    def get_schemas(self) -> List[str]:
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('sys', 'information_schema', 'guest') ORDER BY schema_name;")
            schemas = [r["schema_name"] for r in cursor.fetchall()]
            if self.schema_filters:
                schemas = [s for s in schemas if s in self.schema_filters]
            return schemas or ["dbo"]
        finally:
            conn.close()

    def get_tables(self, schema: Optional[str] = None) -> List[TableMetadata]:
        conn = self.connect()
        try:
            cursor = conn.cursor()
            target_schemas = [schema] if schema else self.get_schemas()
            tables: List[TableMetadata] = []
            for s in target_schemas:
                clean_s = sanitize_sql_identifier(s, "schema")
                cursor.execute(
                    """
                    SELECT TABLE_NAME
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = %s AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
                    ORDER BY TABLE_NAME;
                    """,
                    (clean_s,),
                )
                for r in cursor.fetchall():
                    tbl_name = r["TABLE_NAME"]
                    cols = self._get_columns_internal(cursor, clean_s, tbl_name)
                    tables.append(
                        TableMetadata(
                            name=tbl_name,
                            schema_name=clean_s,
                            columns=cols,
                        )
                    )
            return tables
        finally:
            conn.close()

    def _get_columns_internal(self, cursor: Any, schema: str, table: str) -> List[ColumnMetadata]:
        cursor.execute(
            """
            SELECT
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION;
            """,
            (schema, table),
        )
        cols = []
        for r in cursor.fetchall():
            cols.append(
                ColumnMetadata(
                    name=r["COLUMN_NAME"],
                    data_type=r["DATA_TYPE"],
                    is_nullable=(r["IS_NULLABLE"] == "YES"),
                    default_value=str(r["COLUMN_DEFAULT"]) if r["COLUMN_DEFAULT"] is not None else None,
                    max_length=r["CHARACTER_MAXIMUM_LENGTH"],
                )
            )
        return cols

    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        t0 = time.perf_counter()
        s = sanitize_sql_identifier(req.schema_name or "dbo", "schema")
        tbl = sanitize_sql_identifier(req.target, "table")
        validate_read_only_clause(req.filter_clause)

        conn = self.connect()
        try:
            cursor = conn.cursor()
            cols = self._get_columns_internal(cursor, s, tbl)
            col_names = [c.name for c in cols]
            col_types = {c.name: c.data_type for c in cols}

            selected = col_names
            if req.columns:
                clean_selected = [sanitize_sql_identifier(c, "column") for c in req.columns if c in col_names]
                if clean_selected:
                    selected = clean_selected

            cols_expr = ", ".join(f"[{c}]" for c in selected)
            # T-SQL pagination via OFFSET ... FETCH NEXT (requires ORDER BY)
            first_col = selected[0] if selected else "(SELECT NULL)"
            sql = f"SELECT {cols_expr} FROM [{s}].[{tbl}]"
            if req.filter_clause:
                sql += f" WHERE {req.filter_clause}"
            sql += f" ORDER BY [{first_col}] OFFSET {req.offset} ROWS FETCH NEXT {req.limit} ROWS ONLY;"

            cursor.execute(sql)
            rows = cursor.fetchall()

            cursor.execute(f"SELECT COUNT(*) AS cnt FROM [{s}].[{tbl}];")
            cnt_row = cursor.fetchone()
            total = cnt_row.get("cnt") if cnt_row else len(rows)

            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return DataPreviewResponse(
                connector_id=self.connector_id,
                target=tbl,
                schema_name=s,
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

