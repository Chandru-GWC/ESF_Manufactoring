"""
Dedicated Connector Management Service for EHS Safety AI.
Provides complete data management against the separate Connector Database (ehs_connector_db).

Encapsulates:
- Connector configuration CRUD and encryption lifecycle
- Connection test history logging and analysis
- Metadata caching (databases, schemas, tables, collections)
- EHS Application module authorization mappings
- EHS AI Agent authorization mappings
- Immutable audit trail logging
- Health and status aggregations
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.connectors.database import ConnectorSessionLocal, init_connector_db
from app.connectors.security import encrypt_secret, mask_secret, validate_connection_target
from app.models.connector import (
    ConnectorAgentMapping,
    ConnectorAuditLog,
    ConnectorMetadataCache,
    ConnectorModuleMapping,
    ConnectorTestHistory,
    DataConnector,
)
from app.schemas.connector import (
    ConnectionTestResult,
    ConnectorCreateRequest,
    ConnectorOverviewStats,
    ConnectorResponse,
    ConnectorUpdateRequest,
    DatabaseMetadata,
)

logger = logging.getLogger("ehs.connectors.service")


class ConnectorManagementService:
    """Dedicated management service operating against the separate Connector DB."""

    def __init__(self, db: Optional[Session] = None) -> None:
        self._db = db

    def _get_session(self) -> Session:
        return self._db if self._db is not None else ConnectorSessionLocal()

    # -----------------------------------------------------------------------
    # Connector Configurations CRUD
    # -----------------------------------------------------------------------

    def create_connector(
        self,
        req: ConnectorCreateRequest,
        creator_email: str = "admin@ehs.internal",
    ) -> DataConnector:
        db = self._get_session()
        close_needed = self._db is None
        try:
            # Generate deterministic prefix: CONN-PG-XXXX, CONN-MY-XXXX, etc.
            type_prefix = {
                "postgresql": "PG",
                "mysql": "MY",
                "mongodb": "MG",
                "sqlite": "SQ",
                "sqlserver": "MS",
                "oracle": "OR",
            }.get(req.db_type, "DB")
            connector_id = f"CONN-{type_prefix}-{uuid.uuid4().hex[:8].upper()}"

            enc_pass = encrypt_secret(req.password) if req.password else None
            enc_uri = encrypt_secret(req.uri) if req.uri else None

            model = DataConnector(
                connector_id=connector_id,
                name=req.name.strip(),
                description=req.description.strip() if req.description else None,
                db_type=req.db_type,
                host=req.host.strip() if req.host else None,
                port=req.port,
                database_name=req.database_name.strip() if req.database_name else None,
                username=req.username.strip() if req.username else None,
                encrypted_password=enc_pass,
                encrypted_uri=enc_uri,
                ssl_mode=req.ssl_mode,
                ssl_ca_cert=req.ssl_ca_cert,
                read_only=req.read_only,
                connection_timeout_sec=req.connection_timeout_sec,
                pool_size=req.pool_size,
                schema_filters_json=json.dumps(req.schema_filters) if req.schema_filters else None,
                collection_filters_json=json.dumps(req.collection_filters) if req.collection_filters else None,
                plant_id=req.plant_id or "ALL",
                status="DISCONNECTED",
                created_by=creator_email,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(model)
            db.commit()
            db.refresh(model)

            self.record_audit_log(
                connector_id=connector_id,
                action="CREATE",
                result="SUCCESS",
                user_email=creator_email,
                details={"name": model.name, "db_type": model.db_type},
            )
            return model
        finally:
            if close_needed:
                db.close()

    def get_connector(self, connector_id: str) -> Optional[DataConnector]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            return db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
        finally:
            if close_needed:
                db.close()

    def list_connectors(
        self,
        db_type: Optional[str] = None,
        status: Optional[str] = None,
        plant_id: Optional[str] = None,
    ) -> List[DataConnector]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            query = db.query(DataConnector)
            if db_type:
                query = query.filter(DataConnector.db_type == db_type)
            if status:
                query = query.filter(DataConnector.status == status)
            if plant_id and plant_id != "ALL":
                query = query.filter((DataConnector.plant_id == "ALL") | (DataConnector.plant_id == plant_id))
            return query.order_by(DataConnector.created_at.desc()).all()
        finally:
            if close_needed:
                db.close()

    def update_connector(
        self,
        connector_id: str,
        req: ConnectorUpdateRequest,
        updater_email: str = "admin@ehs.internal",
    ) -> DataConnector:
        db = self._get_session()
        close_needed = self._db is None
        try:
            model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
            if not model:
                raise ValueError(f"Connector '{connector_id}' not found.")

            if req.name is not None:
                model.name = req.name.strip()
            if req.description is not None:
                model.description = req.description.strip()
            if req.host is not None:
                model.host = req.host.strip()
            if req.port is not None:
                model.port = req.port
            if req.database_name is not None:
                model.database_name = req.database_name.strip()
            if req.username is not None:
                model.username = req.username.strip()
            if req.password is not None and req.password != "":
                model.encrypted_password = encrypt_secret(req.password)
            if req.uri is not None and req.uri != "":
                model.encrypted_uri = encrypt_secret(req.uri)
            if req.ssl_mode is not None:
                model.ssl_mode = req.ssl_mode
            if req.read_only is not None:
                model.read_only = req.read_only
            if req.connection_timeout_sec is not None:
                model.connection_timeout_sec = req.connection_timeout_sec
            if req.pool_size is not None:
                model.pool_size = req.pool_size
            if req.schema_filters is not None:
                model.schema_filters_json = json.dumps(req.schema_filters)
            if req.collection_filters is not None:
                model.collection_filters_json = json.dumps(req.collection_filters)

            model.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(model)

            self.record_audit_log(
                connector_id=connector_id,
                action="UPDATE",
                result="SUCCESS",
                user_email=updater_email,
                details={"updated_fields": [k for k, v in req.model_dump(exclude_unset=True).items() if k != "password"]},
            )
            return model
        finally:
            if close_needed:
                db.close()

    def delete_connector(self, connector_id: str, deleter_email: str = "admin@ehs.internal") -> bool:
        db = self._get_session()
        close_needed = self._db is None
        try:
            model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
            if not model:
                return False

            name = model.name
            db_type = model.db_type

            # Cascade delete mappings and test history
            db.query(ConnectorModuleMapping).filter(ConnectorModuleMapping.connector_id == connector_id).delete()
            db.query(ConnectorAgentMapping).filter(ConnectorAgentMapping.connector_id == connector_id).delete()
            db.query(ConnectorMetadataCache).filter(ConnectorMetadataCache.connector_id == connector_id).delete()
            db.query(ConnectorTestHistory).filter(ConnectorTestHistory.connector_id == connector_id).delete()
            db.delete(model)
            db.commit()

            self.record_audit_log(
                connector_id=connector_id,
                action="DELETE",
                result="SUCCESS",
                user_email=deleter_email,
                details={"deleted_name": name, "db_type": db_type},
            )
            return True
        finally:
            if close_needed:
                db.close()

    # -----------------------------------------------------------------------
    # Connection Test History
    # -----------------------------------------------------------------------

    def record_test_result(
        self,
        connector_id: Optional[str],
        result: ConnectionTestResult,
        db_type: str,
        tested_by: Optional[str] = None,
    ) -> ConnectorTestHistory:
        db = self._get_session()
        close_needed = self._db is None
        try:
            test_id = f"TEST-{uuid.uuid4().hex[:8].upper()}"
            entry = ConnectorTestHistory(
                test_id=test_id,
                connector_id=connector_id,
                db_type=db_type,
                tested_at=result.timestamp or datetime.utcnow(),
                success=result.success,
                latency_ms=result.latency_ms,
                status=result.status,
                server_version=result.server_version,
                error_code=result.error_code,
                error_message=result.error_detail or result.message,
                discovered_databases_json=json.dumps(result.discovered_databases) if result.discovered_databases else None,
                discovered_schemas_json=json.dumps(result.discovered_schemas) if result.discovered_schemas else None,
                discovered_collections_json=json.dumps(result.discovered_collections) if result.discovered_collections else None,
                tested_by=tested_by,
            )
            db.add(entry)

            # Update connector status if saved connector
            if connector_id:
                conn_model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
                if conn_model:
                    conn_model.last_tested_at = datetime.utcnow()
                    conn_model.last_latency_ms = result.latency_ms
                    if result.success:
                        conn_model.status = "CONNECTED"
                        conn_model.last_connected_at = datetime.utcnow()
                        conn_model.last_error_message = None
                    else:
                        conn_model.status = "FAILED"
                        conn_model.last_failed_at = datetime.utcnow()
                        conn_model.last_error_message = result.message

            db.commit()
            return entry
        finally:
            if close_needed:
                db.close()

    def get_test_history(self, connector_id: str, limit: int = 20) -> List[ConnectorTestHistory]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            return (
                db.query(ConnectorTestHistory)
                .filter(ConnectorTestHistory.connector_id == connector_id)
                .order_by(ConnectorTestHistory.tested_at.desc())
                .limit(limit)
                .all()
            )
        finally:
            if close_needed:
                db.close()

    # -----------------------------------------------------------------------
    # Metadata Cache
    # -----------------------------------------------------------------------

    def save_metadata_cache(self, connector_id: str, metadata: DatabaseMetadata) -> ConnectorMetadataCache:
        db = self._get_session()
        close_needed = self._db is None
        try:
            existing = db.query(ConnectorMetadataCache).filter(ConnectorMetadataCache.connector_id == connector_id).first()
            if not existing:
                existing = ConnectorMetadataCache(
                    cache_id=f"META-{uuid.uuid4().hex[:8].upper()}",
                    connector_id=connector_id,
                    db_type=metadata.db_type,
                )
                db.add(existing)

            existing.databases_json = json.dumps(metadata.databases)
            existing.schemas_json = json.dumps(metadata.schemas)
            existing.tables_json = json.dumps([t.model_dump() for t in metadata.tables])
            existing.collections_json = json.dumps([c.model_dump() for c in metadata.collections])
            existing.refreshed_at = datetime.utcnow()

            # Also update cached JSON on connector model
            conn_model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
            if conn_model:
                conn_model.metadata_json = json.dumps(metadata.model_dump(), default=str)
                conn_model.metadata_refreshed_at = existing.refreshed_at

            db.commit()
            db.refresh(existing)
            return existing
        finally:
            if close_needed:
                db.close()

    def get_metadata_cache(self, connector_id: str) -> Optional[ConnectorMetadataCache]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            return db.query(ConnectorMetadataCache).filter(ConnectorMetadataCache.connector_id == connector_id).first()
        finally:
            if close_needed:
                db.close()

    # -----------------------------------------------------------------------
    # Resource-to-EHS-Module Mappings
    # -----------------------------------------------------------------------

    def get_module_mappings(self, connector_id: str) -> List[ConnectorModuleMapping]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            return db.query(ConnectorModuleMapping).filter(ConnectorModuleMapping.connector_id == connector_id).all()
        finally:
            if close_needed:
                db.close()

    def upsert_module_mapping(
        self,
        connector_id: str,
        ehs_module: str,
        allowed_tables: Optional[List[str]] = None,
        access_level: str = "READ_ONLY",
        enabled: bool = True,
        description: Optional[str] = None,
    ) -> ConnectorModuleMapping:
        db = self._get_session()
        close_needed = self._db is None
        try:
            existing = (
                db.query(ConnectorModuleMapping)
                .filter(
                    ConnectorModuleMapping.connector_id == connector_id,
                    ConnectorModuleMapping.ehs_module == ehs_module,
                )
                .first()
            )
            if not existing:
                existing = ConnectorModuleMapping(
                    mapping_id=f"MAP-MOD-{uuid.uuid4().hex[:8].upper()}",
                    connector_id=connector_id,
                    ehs_module=ehs_module,
                )
                db.add(existing)

            existing.allowed_tables_json = json.dumps(allowed_tables or ["*"])
            existing.access_level = access_level
            existing.enabled = enabled
            existing.description = description
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        finally:
            if close_needed:
                db.close()

    # -----------------------------------------------------------------------
    # Resource-to-AI-Agent Mappings
    # -----------------------------------------------------------------------

    def get_agent_mappings(
        self,
        connector_id: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> List[ConnectorAgentMapping]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            query = db.query(ConnectorAgentMapping)
            if connector_id:
                query = query.filter(ConnectorAgentMapping.connector_id == connector_id)
            if agent_name:
                query = query.filter(ConnectorAgentMapping.agent_name == agent_name)
            return query.all()
        finally:
            if close_needed:
                db.close()

    def upsert_agent_mapping(
        self,
        connector_id: str,
        agent_name: str,
        allowed_tables: Optional[List[str]] = None,
        allowed_collections: Optional[List[str]] = None,
        plant_scope: str = "ALL",
        max_query_limit: int = 25,
        enabled: bool = True,
    ) -> ConnectorAgentMapping:
        db = self._get_session()
        close_needed = self._db is None
        try:
            existing = (
                db.query(ConnectorAgentMapping)
                .filter(
                    ConnectorAgentMapping.connector_id == connector_id,
                    ConnectorAgentMapping.agent_name == agent_name,
                )
                .first()
            )
            if not existing:
                existing = ConnectorAgentMapping(
                    mapping_id=f"MAP-AGT-{uuid.uuid4().hex[:8].upper()}",
                    connector_id=connector_id,
                    agent_name=agent_name,
                )
                db.add(existing)

            existing.allowed_tables_json = json.dumps(allowed_tables or ["*"])
            existing.allowed_collections_json = json.dumps(allowed_collections or ["*"])
            existing.plant_scope = plant_scope
            existing.max_query_limit = max_query_limit
            existing.enabled = enabled
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        finally:
            if close_needed:
                db.close()

    # -----------------------------------------------------------------------
    # Immutable Audit Logging
    # -----------------------------------------------------------------------

    def record_audit_log(
        self,
        action: str,
        result: str,
        connector_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        execution_time_ms: Optional[float] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> ConnectorAuditLog:
        db = self._get_session()
        close_needed = self._db is None
        try:
            entry = ConnectorAuditLog(
                log_id=f"LOG-{uuid.uuid4().hex[:8].upper()}",
                connector_id=connector_id,
                action=action,
                result=result,
                user_id=user_id,
                user_email=user_email,
                ip_address=ip_address,
                execution_time_ms=execution_time_ms,
                details_json=json.dumps(details, default=str) if details else None,
                created_at=datetime.utcnow(),
            )
            db.add(entry)
            db.commit()
            return entry
        finally:
            if close_needed:
                db.close()

    def get_audit_logs(self, connector_id: Optional[str] = None, limit: int = 50) -> List[ConnectorAuditLog]:
        db = self._get_session()
        close_needed = self._db is None
        try:
            query = db.query(ConnectorAuditLog)
            if connector_id:
                query = query.filter(ConnectorAuditLog.connector_id == connector_id)
            return query.order_by(ConnectorAuditLog.created_at.desc()).limit(limit).all()
        finally:
            if close_needed:
                db.close()

    # -----------------------------------------------------------------------
    # Overview Statistics Aggregation
    # -----------------------------------------------------------------------

    def get_overview_stats(self) -> ConnectorOverviewStats:
        db = self._get_session()
        close_needed = self._db is None
        try:
            connectors = db.query(DataConnector).all()
            total = len(connectors)
            active = sum(1 for c in connectors if c.status == "CONNECTED")
            failed = sum(1 for c in connectors if c.status == "FAILED")
            disconnected = sum(1 for c in connectors if c.status in ("DISCONNECTED", "TESTING"))

            by_type: Dict[str, int] = {}
            for c in connectors:
                by_type[c.db_type] = by_type.get(c.db_type, 0) + 1

            valid_latencies = [c.last_latency_ms for c in connectors if c.last_latency_ms is not None]
            avg_latency = round(sum(valid_latencies) / len(valid_latencies), 2) if valid_latencies else 0.0

            return ConnectorOverviewStats(
                total_connectors=total,
                active_connections=active,
                failed_connections=failed,
                disconnected_sources=disconnected,
                by_type=by_type,
                average_latency_ms=avg_latency,
            )
        finally:
            if close_needed:
                db.close()


# Singleton instance
connector_service = ConnectorManagementService()
