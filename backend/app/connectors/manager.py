"""
Connection Manager.
Controls connector instantiation, credential decryption, testing, metadata caching,
connection pooling cleanup, and audit logging.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.connectors.base import BaseConnector
from app.connectors.registry import get_adapter_class
from app.connectors.security import decrypt_secret
from app.models.connector import (
    ConnectorAuditLog,
    ConnectorMetadataCache,
    ConnectorTestHistory,
    DataConnector,
)
from app.schemas.connector import (
    ConnectionTestResult,
    ConnectorStatus,
    DataPreviewRequest,
    DataPreviewResponse,
    DatabaseMetadata,
)

logger = logging.getLogger("ehs.connectors")


def record_audit_log(
    db: Session,
    connector_id: Optional[str],
    action: str,
    result: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    execution_time_ms: Optional[float] = None,
    details: Optional[Dict[str, Any]] = None,
) -> ConnectorAuditLog:
    """Record an audit trail event without sensitive credentials into separate Connector DB."""
    log_id = f"AUD-{uuid.uuid4().hex[:12].upper()}"
    sanitized_details = details or {}
    sanitized_details.pop("password", None)
    sanitized_details.pop("encrypted_password", None)
    sanitized_details.pop("uri", None)
    sanitized_details.pop("encrypted_uri", None)

    entry = ConnectorAuditLog(
        log_id=log_id,
        connector_id=connector_id,
        action=action,
        user_id=user_id,
        user_email=user_email,
        ip_address=ip_address,
        execution_time_ms=execution_time_ms,
        result=result,
        details_json=json.dumps(sanitized_details) if sanitized_details else None,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("Could not write audit log: %s", e)
    return entry


class ConnectionManager:
    """Manages active connector instances and database operations."""

    def __init__(self) -> None:
        self._active_connectors: Dict[str, BaseConnector] = {}

    def get_adapter_for_model(self, model: DataConnector) -> BaseConnector:
        """Instantiate or retrieve an adapter for a stored DataConnector model."""
        raw_password = decrypt_secret(model.encrypted_password)
        raw_uri = decrypt_secret(model.encrypted_uri)

        schema_filters = json.loads(model.schema_filters_json) if model.schema_filters_json else None
        collection_filters = json.loads(model.collection_filters_json) if model.collection_filters_json else None

        adapter_cls = get_adapter_class(model.db_type)  # type: ignore[arg-type]
        return adapter_cls(
            connector_id=model.connector_id,
            name=model.name,
            host=model.host,
            port=model.port,
            database_name=model.database_name,
            username=model.username,
            password=raw_password,
            uri=raw_uri,
            ssl_mode=model.ssl_mode,
            timeout_sec=model.connection_timeout_sec,
            read_only=model.read_only,
            schema_filters=schema_filters,
            collection_filters=collection_filters,
        )

    def test_transient_connection(
        self,
        db_type: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database_name: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        uri: Optional[str] = None,
        ssl_mode: str = "prefer",
        timeout_sec: int = 10,
    ) -> ConnectionTestResult:
        """Test credentials and network connectivity dynamically without saving."""
        adapter_cls = get_adapter_class(db_type)  # type: ignore[arg-type]
        adapter = adapter_cls(
            connector_id="transient-test",
            name="Transient Test",
            host=host,
            port=port,
            database_name=database_name,
            username=username,
            password=password,
            uri=uri,
            ssl_mode=ssl_mode,
            timeout_sec=timeout_sec,
        )
        return adapter.test_connection()

    def test_and_update_status(
        self,
        db: Session,
        model: DataConnector,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> ConnectionTestResult:
        """Test an existing stored connector and persist updated status, latency & test history."""
        adapter = self.get_adapter_for_model(model)
        result = adapter.test_connection()

        now = datetime.utcnow()
        model.last_tested_at = now
        model.last_latency_ms = result.latency_ms

        # Record into connector_test_history in separate DB
        test_history_entry = ConnectorTestHistory(
            test_id=f"TEST-{uuid.uuid4().hex[:8].upper()}",
            connector_id=model.connector_id,
            db_type=model.db_type,
            tested_at=now,
            success=result.success,
            latency_ms=result.latency_ms,
            status=result.status,
            server_version=result.server_version,
            error_code=result.error_code,
            error_message=result.error_detail or result.message,
            discovered_databases_json=json.dumps(result.discovered_databases) if result.discovered_databases else None,
            discovered_schemas_json=json.dumps(result.discovered_schemas) if result.discovered_schemas else None,
            discovered_collections_json=json.dumps(result.discovered_collections) if result.discovered_collections else None,
            tested_by=user_email or user_id,
        )
        db.add(test_history_entry)

        if result.success:
            model.status = "CONNECTED"
            model.last_connected_at = now
            model.last_error_message = None
            record_audit_log(
                db=db,
                connector_id=model.connector_id,
                action="TESTED",
                result="SUCCESS",
                user_id=user_id,
                user_email=user_email,
                details={"latency_ms": result.latency_ms, "server_version": result.server_version},
            )
        else:
            model.status = "FAILED"
            model.last_failed_at = now
            model.last_error_message = result.message
            record_audit_log(
                db=db,
                connector_id=model.connector_id,
                action="TESTED",
                result="FAILED",
                user_id=user_id,
                user_email=user_email,
                details={"error": result.message, "error_code": result.error_code},
            )

        db.commit()
        db.refresh(model)
        return result

    def disconnect_connector(
        self,
        db: Session,
        model: DataConnector,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> None:
        """Mark connector as disconnected and close cached connection."""
        if model.connector_id in self._active_connectors:
            try:
                self._active_connectors[model.connector_id].disconnect()
            except Exception:
                pass
            del self._active_connectors[model.connector_id]

        model.status = "DISCONNECTED"
        db.commit()
        record_audit_log(
            db=db,
            connector_id=model.connector_id,
            action="DISCONNECTED",
            result="SUCCESS",
            user_id=user_id,
            user_email=user_email,
            details={"status": "DISCONNECTED"},
        )

    def refresh_metadata(
        self,
        db: Session,
        model: DataConnector,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> DatabaseMetadata:
        """Discover database schema, tables, and columns, caching in connector record & metadata cache table."""
        adapter = self.get_adapter_for_model(model)
        metadata = adapter.get_metadata()

        now = datetime.utcnow()
        model.metadata_json = metadata.model_dump_json()
        model.metadata_refreshed_at = now
        model.status = "CONNECTED"
        model.last_connected_at = now
        model.last_error_message = None

        # Upsert in connector_metadata_cache table
        meta_cache = db.query(ConnectorMetadataCache).filter(ConnectorMetadataCache.connector_id == model.connector_id).first()
        if not meta_cache:
            meta_cache = ConnectorMetadataCache(
                cache_id=f"META-{uuid.uuid4().hex[:8].upper()}",
                connector_id=model.connector_id,
                db_type=model.db_type,
            )
            db.add(meta_cache)

        meta_cache.databases_json = json.dumps(metadata.databases)
        meta_cache.schemas_json = json.dumps(metadata.schemas)
        meta_cache.tables_json = json.dumps([t.model_dump() for t in metadata.tables])
        meta_cache.collections_json = json.dumps([c.model_dump() for c in metadata.collections])
        meta_cache.refreshed_at = now

        db.commit()
        db.refresh(model)

        record_audit_log(
            db=db,
            connector_id=model.connector_id,
            action="METADATA_REFRESHED",
            result="SUCCESS",
            user_id=user_id,
            user_email=user_email,
            details={
                "tables_count": len(metadata.tables),
                "collections_count": len(metadata.collections),
            },
        )
        return metadata

    def preview_data(
        self,
        db: Session,
        model: DataConnector,
        req: DataPreviewRequest,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> DataPreviewResponse:
        """Execute a safe, read-only preview of data without storing external records."""
        adapter = self.get_adapter_for_model(model)
        response = adapter.preview_data(req)

        record_audit_log(
            db=db,
            connector_id=model.connector_id,
            action="DATA_PREVIEWED",
            result="SUCCESS",
            user_id=user_id,
            user_email=user_email,
            execution_time_ms=response.execution_time_ms,
            details={
                "target": req.target,
                "schema": req.schema_name,
                "rows_returned": len(response.rows),
                "execution_time_ms": response.execution_time_ms,
            },
        )
        return response


# Global manager singleton
connector_manager = ConnectionManager()
