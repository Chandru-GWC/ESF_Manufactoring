"""
PostgreSQL Database Connector Adapter.
Uses psycopg2 and SQLAlchemy connection pooling to discover databases, schemas, tables, columns,
indexes and preview records with strict parameterization and read-only semantics.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

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


class PostgreSQLConnector(BaseConnector):
    @classmethod
    def get_db_type(cls) -> str:
        return "postgresql"

    def _get_connection_kwargs(self) -> Dict[str, Any]:
        validate_connection_target(self.host or "127.0.0.1", self.port or 5432)
        kwargs: Dict[str, Any] = {
            "host": self.host or "127.0.0.1",
            "port": self.port or 5432,
            "dbname": self.database_name or "postgres",
            "user": self.username or "postgres",
            "connect_timeout": self.timeout_sec,
        }
        if self.password:
            kwargs["password"] = self.password
        if self.ssl_mode:
            kwargs["sslmode"] = self.ssl_mode.lower()
        return kwargs

    def connect(self) -> psycopg2.extensions.connection:
        kwargs = self._get_connection_kwargs()
        conn = psycopg2.connect(**kwargs)
        conn.autocommit = True
        self._is_connected = True
        return conn

    def disconnect(self) -> None:
        self._is_connected = False

    def test_connection(self) -> ConnectionTestResult:
        t0 = time.perf_counter()
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            ver_raw = cursor.fetchone()[0]
            # Extract version short
            ver = ver_raw.split(",")[0] if ver_raw else "PostgreSQL"
            cursor.execute("SELECT current_database();")
            cur_db = cursor.fetchone()[0]
            # List visible schemas
            cursor.execute(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name;"
            )
            schemas = [r[0] for r in cursor.fetchall()]
            conn.close()
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=True,
                status="CONNECTED",
                latency_ms=latency,
                message=f"Connected successfully to {ver} (Database: '{cur_db}', {len(schemas)} schemas found).",
                server_version=ver,
                discovered_databases=[cur_db],
                discovered_schemas=schemas,
            )
        except Exception as e:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=False,
                status="FAILED",
                latency_ms=latency,
                message=f"PostgreSQL connection failed: {str(e)}",
                error_code="POSTGRES_AUTH_OR_NETWORK_ERROR",
                error_detail=str(e),
            )

    def get_databases(self) -> List[str]:
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;")
            dbs = [r[0] for r in cursor.fetchall()]
            conn.close()
            return dbs
        except Exception:
            return [self.database_name] if self.database_name else ["postgres"]

    def get_schemas(self) -> List[str]:
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name;"
            )
            schemas = [r[0] for r in cursor.fetchall()]
            if self.schema_filters:
                schemas = [s for s in schemas if s in self.schema_filters]
            return schemas
        finally:
            conn.close()

    def get_tables(self, schema: Optional[str] = None) -> List[TableMetadata]:
        conn = self.connect()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            target_schemas = [schema] if schema else self.get_schemas()
            if not target_schemas:
                target_schemas = ["public"]

            tables: List[TableMetadata] = []
            for s in target_schemas:
                clean_s = sanitize_sql_identifier(s, "schema")
                cursor.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = %s AND table_type IN ('BASE TABLE', 'VIEW')
                    ORDER BY table_name;
                    """,
                    (clean_s,),
                )
                rows = cursor.fetchall()
                for r in rows:
                    tbl_name = r["table_name"]
                    cols = self._get_columns_internal(cursor, clean_s, tbl_name)
                    idx = self._get_indexes_internal(cursor, clean_s, tbl_name)
                    tables.append(
                        TableMetadata(
                            name=tbl_name,
                            schema_name=clean_s,
                            columns=cols,
                            indexes=idx,
                        )
                    )
            return tables
        finally:
            conn.close()

    def _get_columns_internal(self, cursor: Any, schema: str, table: str) -> List[ColumnMetadata]:
        cursor.execute(
            """
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                CASE WHEN pk.column_name IS NOT NULL THEN TRUE ELSE FALSE END as is_pk
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = %s
                  AND tc.table_name = %s
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_schema = %s AND c.table_name = %s
            ORDER BY c.ordinal_position;
            """,
            (schema, table, schema, table),
        )
        cols = []
        for r in cursor.fetchall():
            cols.append(
                ColumnMetadata(
                    name=r["column_name"],
                    data_type=r["data_type"],
                    is_nullable=(r["is_nullable"] == "YES"),
                    is_primary_key=bool(r["is_pk"]),
                    default_value=str(r["column_default"]) if r["column_default"] is not None else None,
                    max_length=r["character_maximum_length"],
                )
            )
        return cols

    def _get_indexes_internal(self, cursor: Any, schema: str, table: str) -> List[IndexMetadata]:
        cursor.execute(
            """
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = %s AND tablename = %s;
            """,
            (schema, table),
        )
        indexes = []
        for r in cursor.fetchall():
            idx_name = r["indexname"]
            idx_def = r["indexdef"] or ""
            is_unique = "UNIQUE" in idx_def.upper()
            indexes.append(
                IndexMetadata(
                    name=idx_name,
                    columns=[idx_name],
                    is_unique=is_unique,
                )
            )
        return indexes

    def get_columns(self, table: str, schema: Optional[str] = None) -> List[ColumnMetadata]:
        s = sanitize_sql_identifier(schema or "public", "schema")
        t = sanitize_sql_identifier(table, "table")
        conn = self.connect()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            return self._get_columns_internal(cursor, s, t)
        finally:
            conn.close()

    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        t0 = time.perf_counter()
        s = sanitize_sql_identifier(req.schema_name or "public", "schema")
        t = sanitize_sql_identifier(req.target, "table")
        validate_read_only_clause(req.filter_clause)

        conn = self.connect()
        try:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cols = self._get_columns_internal(cursor, s, t)
            col_names = [c.name for c in cols]
            col_types = {c.name: c.data_type for c in cols}

            selected = col_names
            if req.columns:
                clean_selected = [sanitize_sql_identifier(c, "column") for c in req.columns if c in col_names]
                if clean_selected:
                    selected = clean_selected

            cols_expr = ", ".join(f'"{c}"' for c in selected)
            sql = f'SELECT {cols_expr} FROM "{s}"."{t}"'
            if req.filter_clause:
                sql += f" WHERE {req.filter_clause}"
            sql += " LIMIT %s OFFSET %s;"

            cursor.execute(sql, (req.limit, req.offset))
            rows = [dict(row) for row in cursor.fetchall()]

            # Approximate total
            cursor.execute(
                """
                SELECT reltuples::BIGINT AS estimate
                FROM pg_class
                JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
                WHERE pg_namespace.nspname = %s AND pg_class.relname = %s;
                """,
                (s, t),
            )
            est_row = cursor.fetchone()
            total_est = est_row["estimate"] if est_row and est_row["estimate"] >= 0 else len(rows)

            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return DataPreviewResponse(
                connector_id=self.connector_id,
                target=t,
                schema_name=s,
                columns=selected,
                column_types=col_types,
                rows=rows,
                total_rows_estimate=total_est,
                limit=req.limit,
                offset=req.offset,
                execution_time_ms=elapsed,
                is_read_only=True,
            )
        finally:
            conn.close()

