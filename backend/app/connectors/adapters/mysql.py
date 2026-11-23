"""
MySQL Database Connector Adapter.
Uses PyMySQL to discover databases, tables, columns, indexes and preview records safely.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
import pymysql
import pymysql.cursors

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


class MySQLConnector(BaseConnector):
    @classmethod
    def get_db_type(cls) -> str:
        return "mysql"

    def _get_connection_kwargs(self) -> Dict[str, Any]:
        validate_connection_target(self.host or "127.0.0.1", self.port or 3306)
        kwargs: Dict[str, Any] = {
            "host": self.host or "127.0.0.1",
            "port": self.port or 3306,
            "database": self.database_name,
            "user": self.username or "root",
            "connect_timeout": self.timeout_sec,
            "cursorclass": pymysql.cursors.DictCursor,
            "charset": "utf8mb4",
        }
        if self.password:
            kwargs["password"] = self.password
        if self.ssl_mode and self.ssl_mode.lower() in ("require", "verify-ca", "verify-full"):
            kwargs["ssl"] = {"check_hostname": True}
        return kwargs

    def connect(self) -> pymysql.Connection:
        kwargs = self._get_connection_kwargs()
        conn = pymysql.connect(**kwargs)
        self._is_connected = True
        return conn

    def disconnect(self) -> None:
        self._is_connected = False

    def test_connection(self) -> ConnectionTestResult:
        t0 = time.perf_counter()
        try:
            conn = self.connect()
            with conn.cursor() as cursor:
                cursor.execute("SELECT VERSION();")
                row = cursor.fetchone()
                version = row.get("VERSION()") or list(row.values())[0] if row else "MySQL"
                cursor.execute("SELECT DATABASE();")
                row_db = cursor.fetchone()
                cur_db = row_db.get("DATABASE()") or list(row_db.values())[0] if row_db else self.database_name
                cursor.execute("SHOW DATABASES;")
                dbs = [list(r.values())[0] for r in cursor.fetchall() if list(r.values())[0] not in ('information_schema', 'performance_schema', 'mysql', 'sys')]
            conn.close()
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=True,
                status="CONNECTED",
                latency_ms=latency,
                message=f"Connected successfully to MySQL v{version} ({len(dbs)} visible databases).",
                server_version=str(version),
                discovered_databases=dbs,
            )
        except Exception as e:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=False,
                status="FAILED",
                latency_ms=latency,
                message=f"MySQL connection failed: {str(e)}",
                error_code="MYSQL_AUTH_OR_NETWORK_ERROR",
                error_detail=str(e),
            )

    def get_databases(self) -> List[str]:
        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SHOW DATABASES;")
                return [list(r.values())[0] for r in cursor.fetchall() if list(r.values())[0] not in ('information_schema', 'performance_schema', 'mysql', 'sys')]
        finally:
            conn.close()

    def get_tables(self, schema: Optional[str] = None) -> List[TableMetadata]:
        db_target = schema or self.database_name
        if not db_target:
            return []
        clean_db = sanitize_sql_identifier(db_target, "database")

        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT TABLE_NAME
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = %s AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
                    ORDER BY TABLE_NAME;
                    """,
                    (clean_db,),
                )
                tables: List[TableMetadata] = []
                for r in cursor.fetchall():
                    tbl_name = r["TABLE_NAME"]
                    cols = self._get_columns_internal(cursor, clean_db, tbl_name)
                    idx = self._get_indexes_internal(cursor, clean_db, tbl_name)
                    tables.append(
                        TableMetadata(
                            name=tbl_name,
                            schema_name=clean_db,
                            columns=cols,
                            indexes=idx,
                        )
                    )
                return tables
        finally:
            conn.close()

    def _get_columns_internal(self, cursor: Any, db: str, table: str) -> List[ColumnMetadata]:
        cursor.execute(
            """
            SELECT
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                CHARACTER_MAXIMUM_LENGTH,
                COLUMN_KEY
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION;
            """,
            (db, table),
        )
        cols = []
        for r in cursor.fetchall():
            cols.append(
                ColumnMetadata(
                    name=r["COLUMN_NAME"],
                    data_type=r["DATA_TYPE"],
                    is_nullable=(r["IS_NULLABLE"] == "YES"),
                    is_primary_key=(r["COLUMN_KEY"] == "PRI"),
                    default_value=str(r["COLUMN_DEFAULT"]) if r["COLUMN_DEFAULT"] is not None else None,
                    max_length=r["CHARACTER_MAXIMUM_LENGTH"],
                )
            )
        return cols

    def _get_indexes_internal(self, cursor: Any, db: str, table: str) -> List[IndexMetadata]:
        cursor.execute(f"SHOW INDEX FROM `{db}`.`{table}`;")
        by_name: Dict[str, Dict[str, Any]] = {}
        for r in cursor.fetchall():
            name = r["Key_name"]
            col = r["Column_name"]
            unique = (r["Non_unique"] == 0)
            if name not in by_name:
                by_name[name] = {"columns": [], "unique": unique, "is_primary": (name == "PRIMARY")}
            by_name[name]["columns"].append(col)
        return [
            IndexMetadata(
                name=k,
                columns=v["columns"],
                is_unique=v["unique"],
                is_primary=v["is_primary"],
            )
            for k, v in by_name.items()
        ]

    def get_columns(self, table: str, schema: Optional[str] = None) -> List[ColumnMetadata]:
        db = sanitize_sql_identifier(schema or self.database_name or "mysql", "database")
        tbl = sanitize_sql_identifier(table, "table")
        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                return self._get_columns_internal(cursor, db, tbl)
        finally:
            conn.close()

    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        t0 = time.perf_counter()
        db = sanitize_sql_identifier(req.schema_name or req.database_name or self.database_name or "mysql", "database")
        tbl = sanitize_sql_identifier(req.target, "table")
        validate_read_only_clause(req.filter_clause)

        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                cols = self._get_columns_internal(cursor, db, tbl)
                col_names = [c.name for c in cols]
                col_types = {c.name: c.data_type for c in cols}

                selected = col_names
                if req.columns:
                    clean_selected = [sanitize_sql_identifier(c, "column") for c in req.columns if c in col_names]
                    if clean_selected:
                        selected = clean_selected

                cols_expr = ", ".join(f"`{c}`" for c in selected)
                sql = f"SELECT {cols_expr} FROM `{db}`.`{tbl}`"
                if req.filter_clause:
                    sql += f" WHERE {req.filter_clause}"
                sql += f" LIMIT {req.limit} OFFSET {req.offset};"

                cursor.execute(sql)
                rows = cursor.fetchall()

                cursor.execute(f"SELECT COUNT(*) as cnt FROM `{db}`.`{tbl}`;")
                cnt_row = cursor.fetchone()
                total = cnt_row.get("cnt") or 0

                elapsed = round((time.perf_counter() - t0) * 1000, 2)
                return DataPreviewResponse(
                    connector_id=self.connector_id,
                    target=tbl,
                    schema_name=db,
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

