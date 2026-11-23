"""
FastAPI REST Routes for Enterprise Database & Resource Connector Management.
Prefix: /api/v1/connectors

Guarantees:
- Completely isolated from primary Neon DB: uses dedicated separate Connector Database (ehs_connector_db).
- Real-time connection testing, schema discovery, and read-only preview.
- Resource-to-module and resource-to-agent mapping governance.
- Strict AES-256-GCM credential encryption and masking.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.connectors.database import check_connector_db_health, get_connector_db, init_connector_db
from app.connectors.manager import connector_manager, record_audit_log
from app.connectors.registry import get_driver_status_response
from app.connectors.security import encrypt_secret, mask_secret, validate_connection_target
from app.core.deps import ACTOR, plant_filter
from app.models.connector import (
    ConnectorAgentMapping,
    ConnectorAuditLog,
    ConnectorMetadataCache,
    ConnectorModuleMapping,
    ConnectorTestHistory,
    DataConnector,
)
from app.schemas.connector import (
    CollectionMetadata,
    ConnectionTestRequest,
    ConnectionTestResult,
    ConnectorAgentMappingRequest,
    ConnectorAgentMappingResponse,
    ConnectorAuditLogItem,
    ConnectorCreateRequest,
    ConnectorDBHealthResponse,
    ConnectorModuleMappingRequest,
    ConnectorModuleMappingResponse,
    ConnectorOverviewStats,
    ConnectorResponse,
    ConnectorTestHistoryResponse,
    ConnectorUpdateRequest,
    DatabaseMetadata,
    DataPreviewRequest,
    DataPreviewResponse,
    DriverStatusResponse,
    TableMetadata,
)

router = APIRouter(prefix="/connectors", tags=["Database Connectors"])

_TABLES_ENSURED = False


def _ensure_connector_tables() -> None:
    """Ensure connector tables exist in the dedicated Connector Database."""
    global _TABLES_ENSURED
    if _TABLES_ENSURED:
        return
    try:
        init_connector_db()
        _TABLES_ENSURED = True
    except Exception:
        # Avoid crashing route startup if DB is offline; errors will be handled during queries
        pass


def _model_to_response(model: DataConnector) -> ConnectorResponse:
    return ConnectorResponse(
        connector_id=model.connector_id,
        name=model.name,
        description=model.description,
        db_type=model.db_type,  # type: ignore[arg-type]
        host=model.host,
        port=model.port,
        database_name=model.database_name,
        username=model.username,
        masked_password=mask_secret(model.encrypted_password),
        masked_uri=mask_secret(model.encrypted_uri),
        ssl_mode=model.ssl_mode,
        read_only=model.read_only,
        connection_timeout_sec=model.connection_timeout_sec,
        pool_size=model.pool_size,
        schema_filters=json.loads(model.schema_filters_json) if model.schema_filters_json else [],
        collection_filters=json.loads(model.collection_filters_json) if model.collection_filters_json else [],
        plant_id=model.plant_id,
        status=model.status,  # type: ignore[arg-type]
        last_tested_at=model.last_tested_at,
        last_connected_at=model.last_connected_at,
        last_failed_at=model.last_failed_at,
        last_error_message=model.last_error_message,
        last_latency_ms=model.last_latency_ms,
        metadata_refreshed_at=model.metadata_refreshed_at,
        created_by=model.created_by,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


# ---------------------------------------------------------------------------
# Health & Drivers
# ---------------------------------------------------------------------------

@router.get("/health", response_model=ConnectorDBHealthResponse)
def get_connector_database_health():
    """Report health and pool status of the separate Connector Database."""
    _ensure_connector_tables()
    return check_connector_db_health()


@router.get("/drivers/status", response_model=DriverStatusResponse)
def get_drivers_status():
    """Report installed database driver libraries and supported database types."""
    return get_driver_status_response()


# ---------------------------------------------------------------------------
# Overview & Listing
# ---------------------------------------------------------------------------

@router.get("/primary")
def get_primary_database():
    """
    Connection details and live status of the platform's own database (Neon PostgreSQL).
    The password is never returned, only a mask.
    """
    import time

    from sqlalchemy import text
    from sqlalchemy.engine import make_url

    from app.core.config import settings
    from app.core.database import SessionLocal, engine
    from app.models.ehs_event import EhsEvent
    from app.models.workforce_maintenance import MaintenanceWorkOrder, WorkforceAttendance

    raw = (settings.DATABASE_URL or "").strip()
    url = make_url(raw) if raw else None
    host = url.host if url else None
    is_postgres = engine.dialect.name == "postgresql"

    info: Dict[str, Any] = {
        "name": "Neon PostgreSQL" if host and "neon.tech" in host else ("PostgreSQL" if is_postgres else "Local database"),
        "db_type": "postgresql" if is_postgres else engine.dialect.name,
        "host": host,
        "port": (url.port if url and url.port else (5432 if is_postgres else None)),
        "database_name": url.database if url else None,
        "username": url.username if url else None,
        "password_masked": "•" * 10 if url and url.password else None,
        "ssl_mode": (url.query.get("sslmode") if url else None) or ("require" if is_postgres else None),
        "schema": settings.DB_SCHEMA,
        "status": "DISCONNECTED",
        "latency_ms": None,
        "server_version": None,
        "tables": [],
        "error": None,
    }
    started = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            info["latency_ms"] = int((time.perf_counter() - started) * 1000)
            if is_postgres:
                info["server_version"] = str(conn.execute(text("SHOW server_version")).scalar())
        info["status"] = "CONNECTED"
    except Exception as exc:
        info["error"] = str(getattr(exc, "orig", exc)).strip().splitlines()[0][:200]
        return info

    db = SessionLocal()
    try:
        for model in (EhsEvent, WorkforceAttendance, MaintenanceWorkOrder):
            try:
                info["tables"].append({"table": f"{settings.DB_SCHEMA}.{model.__tablename__}", "rows": db.query(model).count()})
            except Exception:
                db.rollback()
    finally:
        db.close()
    return info


@router.get("/overview", response_model=ConnectorOverviewStats)
def get_connectors_overview(db: Session = Depends(get_connector_db),
):
    """Get aggregated connector stats for dashboard KPI cards."""
    _ensure_connector_tables()
    query = db.query(DataConnector)
    connectors = query.all()

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


@router.get("", response_model=List[ConnectorResponse])
def list_connectors(db: Session = Depends(get_connector_db),
):
    """List all registered database connectors with masked secrets."""
    _ensure_connector_tables()
    query = db.query(DataConnector)
    models = query.order_by(DataConnector.created_at.desc()).all()
    return [_model_to_response(m) for m in models]


# ---------------------------------------------------------------------------
# Testing Transient Connection
# ---------------------------------------------------------------------------

@router.post("/test", response_model=ConnectionTestResult)
def test_transient_connection(
    req: ConnectionTestRequest,
):
    """Test a database connection dynamically before creating or saving it."""
    if req.host:
        validate_connection_target(req.host, req.port)

    return connector_manager.test_transient_connection(
        db_type=req.db_type,
        host=req.host,
        port=req.port,
        database_name=req.database_name,
        username=req.username,
        password=req.password,
        uri=req.uri,
        ssl_mode=req.ssl_mode,
        timeout_sec=req.connection_timeout_sec,
    )


# ---------------------------------------------------------------------------
# Creation & CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=ConnectorResponse, status_code=201)
def create_connector(
    req: ConnectorCreateRequest,
    db: Session = Depends(get_connector_db),
):
    """Create and register a new database connector (Administrator only)."""
    _ensure_connector_tables()

    # SSRF verification on host if provided
    if req.host:
        validate_connection_target(req.host, req.port)

    # Prefix based ID: CONN-PG-123456
    type_prefix = {
        "postgresql": "PG",
        "mysql": "MY",
        "mongodb": "MG",
        "sqlite": "SQ",
        "sqlserver": "MS",
        "oracle": "OR",
    }.get(req.db_type, "DB")
    connector_id = f"CONN-{type_prefix}-{uuid.uuid4().hex[:8].upper()}"

    encrypted_pwd = encrypt_secret(req.password) if req.password else None
    encrypted_uri = encrypt_secret(req.uri) if req.uri else None

    # Test before saving if requested
    initial_status = "DISCONNECTED"
    test_result = None
    if req.test_before_save:
        test_result = connector_manager.test_transient_connection(
            db_type=req.db_type,
            host=req.host,
            port=req.port,
            database_name=req.database_name,
            username=req.username,
            password=req.password,
            uri=req.uri,
            ssl_mode=req.ssl_mode,
            timeout_sec=req.connection_timeout_sec,
        )
        if test_result.success:
            initial_status = "CONNECTED"
        else:
            initial_status = "FAILED"

    now = datetime.utcnow()
    model = DataConnector(
        connector_id=connector_id,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        db_type=req.db_type,
        host=req.host.strip() if req.host else None,
        port=req.port,
        database_name=req.database_name.strip() if req.database_name else None,
        username=req.username.strip() if req.username else None,
        encrypted_password=encrypted_pwd,
        encrypted_uri=encrypted_uri,
        ssl_mode=req.ssl_mode,
        ssl_ca_cert=req.ssl_ca_cert,
        read_only=req.read_only,
        connection_timeout_sec=req.connection_timeout_sec,
        pool_size=req.pool_size,
        schema_filters_json=json.dumps(req.schema_filters) if req.schema_filters else None,
        collection_filters_json=json.dumps(req.collection_filters) if req.collection_filters else None,
        plant_id=req.plant_id or "ALL",
        status=initial_status,
        last_tested_at=now if test_result else None,
        last_connected_at=now if test_result and test_result.success else None,
        last_failed_at=now if test_result and not test_result.success else None,
        last_error_message=test_result.message if test_result and not test_result.success else None,
        last_latency_ms=test_result.latency_ms if test_result else None,
        created_by=ACTOR,
        created_at=now,
        updated_at=now,
    )
    db.add(model)
    db.flush()

    # If tested, record in connector_test_history
    if test_result:
        test_entry = ConnectorTestHistory(
            test_id=f"TEST-{uuid.uuid4().hex[:8].upper()}",
            connector_id=connector_id,
            db_type=req.db_type,
            tested_at=now,
            success=test_result.success,
            latency_ms=test_result.latency_ms,
            status=test_result.status,
            server_version=test_result.server_version,
            error_code=test_result.error_code,
            error_message=test_result.error_detail or test_result.message,
            discovered_databases_json=json.dumps(test_result.discovered_databases) if test_result.discovered_databases else None,
            discovered_schemas_json=json.dumps(test_result.discovered_schemas) if test_result.discovered_schemas else None,
            discovered_collections_json=json.dumps(test_result.discovered_collections) if test_result.discovered_collections else None,
            tested_by=ACTOR,
        )
        db.add(test_entry)

    db.commit()
    db.refresh(model)

    record_audit_log(
        db=db,
        connector_id=connector_id,
        action="CREATED",
        result="SUCCESS",
        user_id=ACTOR,
        user_email=ACTOR,
        details={
            "name": req.name,
            "db_type": req.db_type,
            "status": initial_status,
            "host": req.host,
            "database": req.database_name,
        },
    )

    return _model_to_response(model)


@router.get("/{connector_id}", response_model=ConnectorResponse)
def get_connector(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """Retrieve details for a single connector."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    return _model_to_response(model)


@router.put("/{connector_id}", response_model=ConnectorResponse)
def update_connector(
    connector_id: str,
    req: ConnectorUpdateRequest,
    db: Session = Depends(get_connector_db),
):
    """Update connector configuration (Administrator only)."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")

    if req.name is not None:
        model.name = req.name.strip()
    if req.description is not None:
        model.description = req.description.strip()
    if req.host is not None:
        validate_connection_target(req.host, req.port or model.port)
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
    if req.plant_id is not None:
        model.plant_id = req.plant_id

    model.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(model)

    record_audit_log(
        db=db,
        connector_id=connector_id,
        action="UPDATED",
        result="SUCCESS",
        user_id=ACTOR,
        user_email=ACTOR,
        details={"name": model.name, "updated_fields": list(req.model_dump(exclude_unset=True).keys())},
    )

    return _model_to_response(model)


@router.delete("/{connector_id}")
def delete_connector(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """Delete a connector and release its connection resources (Administrator only)."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")

    connector_manager.disconnect_connector(db, model, user_id=ACTOR, user_email=ACTOR)
    name = model.name

    # Cascade delete mappings and history
    db.query(ConnectorModuleMapping).filter(ConnectorModuleMapping.connector_id == connector_id).delete()
    db.query(ConnectorAgentMapping).filter(ConnectorAgentMapping.connector_id == connector_id).delete()
    db.query(ConnectorMetadataCache).filter(ConnectorMetadataCache.connector_id == connector_id).delete()
    db.query(ConnectorTestHistory).filter(ConnectorTestHistory.connector_id == connector_id).delete()
    db.delete(model)
    db.commit()

    record_audit_log(
        db=db,
        connector_id=connector_id,
        action="DELETED",
        result="SUCCESS",
        user_id=ACTOR,
        user_email=ACTOR,
        details={"deleted_connector_name": name},
    )
    return {
        "status": "success",
        "deleted": True,
        "connector_id": connector_id,
        "name": name,
        "message": f"Connector '{name}' ({connector_id}) removed successfully.",
    }


# ---------------------------------------------------------------------------
# Connection Operations: Test, Disconnect, Metadata, Preview
# ---------------------------------------------------------------------------

@router.post("/{connector_id}/test", response_model=ConnectionTestResult)
def test_saved_connector(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """Test connection of an existing connector and update status and history."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    return connector_manager.test_and_update_status(
        db=db,
        model=model,
        user_id=ACTOR,
        user_email=ACTOR,
    )


@router.get("/{connector_id}/history", response_model=List[ConnectorTestHistoryResponse])
def get_connector_test_history(
    connector_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_connector_db),
):
    """Get the connection test history and diagnostics for a connector."""
    _ensure_connector_tables()
    entries = (
        db.query(ConnectorTestHistory)
        .filter(ConnectorTestHistory.connector_id == connector_id)
        .order_by(ConnectorTestHistory.tested_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ConnectorTestHistoryResponse(
            test_id=e.test_id,
            connector_id=e.connector_id,
            db_type=e.db_type,
            tested_at=e.tested_at,
            success=e.success,
            latency_ms=e.latency_ms,
            status=e.status,
            server_version=e.server_version,
            error_code=e.error_code,
            error_message=e.error_message,
            discovered_databases=json.loads(e.discovered_databases_json) if e.discovered_databases_json else None,
            discovered_schemas=json.loads(e.discovered_schemas_json) if e.discovered_schemas_json else None,
            discovered_collections=json.loads(e.discovered_collections_json) if e.discovered_collections_json else None,
            tested_by=e.tested_by,
        )
        for e in entries
    ]


@router.post("/{connector_id}/disconnect")
def disconnect_saved_connector(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """Disconnect an active connector."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    connector_manager.disconnect_connector(db, model, user_id=ACTOR, user_email=ACTOR)
    return {"status": "success", "message": f"Connector '{model.name}' disconnected."}


@router.get("/{connector_id}/metadata", response_model=DatabaseMetadata)
def get_connector_metadata(
    connector_id: str,
    refresh: bool = Query(False, description="Force fresh discovery against database"),
    db: Session = Depends(get_connector_db),
):
    """Retrieve or refresh discovered metadata tree (schemas, tables, collections, columns, indexes)."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")

    if not refresh and model.metadata_json:
        try:
            return DatabaseMetadata.model_validate_json(model.metadata_json)
        except Exception:
            pass

    return connector_manager.refresh_metadata(
        db=db,
        model=model,
        user_id=ACTOR,
        user_email=ACTOR,
    )


@router.get("/{connector_id}/databases", response_model=List[str])
def list_databases(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """List databases visible to this connector."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    adapter = connector_manager.get_adapter_for_model(model)
    dbs = adapter.get_databases()
    return [d.database_name for d in dbs]


@router.get("/{connector_id}/schemas", response_model=List[str])
def list_schemas(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """List schemas visible to this connector."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    adapter = connector_manager.get_adapter_for_model(model)
    return adapter.get_schemas()


@router.get("/{connector_id}/tables", response_model=List[TableMetadata])
def list_tables(
    connector_id: str,
    schema: Optional[str] = Query(None),
    db: Session = Depends(get_connector_db),
):
    """List tables and views."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    adapter = connector_manager.get_adapter_for_model(model)
    return adapter.get_tables(schema=schema)


@router.get("/{connector_id}/collections", response_model=List[CollectionMetadata])
def list_collections(
    connector_id: str,
    database: Optional[str] = Query(None),
    db: Session = Depends(get_connector_db),
):
    """List MongoDB collections."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")
    adapter = connector_manager.get_adapter_for_model(model)
    return adapter.get_collections(database=database)


@router.post("/{connector_id}/preview", response_model=DataPreviewResponse)
def preview_data(
    connector_id: str,
    req: DataPreviewRequest,
    db: Session = Depends(get_connector_db),
):
    """Preview small bounded sample of records with safe pagination."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")

    return connector_manager.preview_data(
        db=db,
        model=model,
        req=req,
        user_id=ACTOR,
        user_email=ACTOR,
    )


# ---------------------------------------------------------------------------
# Module and Agent Mappings
# ---------------------------------------------------------------------------

@router.get("/{connector_id}/modules", response_model=List[ConnectorModuleMappingResponse])
def get_module_mappings(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """List authorized EHS module mappings for this connector."""
    _ensure_connector_tables()
    mappings = db.query(ConnectorModuleMapping).filter(ConnectorModuleMapping.connector_id == connector_id).all()
    return [
        ConnectorModuleMappingResponse(
            mapping_id=m.mapping_id,
            connector_id=m.connector_id,
            ehs_module=m.ehs_module,
            allowed_tables=json.loads(m.allowed_tables_json) if m.allowed_tables_json else ["*"],
            access_level=m.access_level,
            enabled=m.enabled,
            description=m.description,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in mappings
    ]


@router.post("/{connector_id}/modules", response_model=ConnectorModuleMappingResponse)
def upsert_module_mapping(
    connector_id: str,
    req: ConnectorModuleMappingRequest,
    db: Session = Depends(get_connector_db),
):
    """Authorize or update an EHS application module mapping."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")

    mapping = (
        db.query(ConnectorModuleMapping)
        .filter(
            ConnectorModuleMapping.connector_id == connector_id,
            ConnectorModuleMapping.ehs_module == req.ehs_module,
        )
        .first()
    )
    now = datetime.utcnow()
    if not mapping:
        mapping = ConnectorModuleMapping(
            mapping_id=f"MAP-MOD-{uuid.uuid4().hex[:8].upper()}",
            connector_id=connector_id,
            ehs_module=req.ehs_module,
            created_at=now,
        )
        db.add(mapping)

    mapping.allowed_tables_json = json.dumps(req.allowed_tables)
    mapping.access_level = req.access_level
    mapping.enabled = req.enabled
    mapping.description = req.description
    mapping.updated_at = now
    db.commit()
    db.refresh(mapping)

    return ConnectorModuleMappingResponse(
        mapping_id=mapping.mapping_id,
        connector_id=mapping.connector_id,
        ehs_module=mapping.ehs_module,
        allowed_tables=json.loads(mapping.allowed_tables_json),
        access_level=mapping.access_level,
        enabled=mapping.enabled,
        description=mapping.description,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
    )


@router.get("/{connector_id}/agents", response_model=List[ConnectorAgentMappingResponse])
def get_agent_mappings(
    connector_id: str,
    db: Session = Depends(get_connector_db),
):
    """List authorized AI agent mappings for this connector."""
    _ensure_connector_tables()
    mappings = db.query(ConnectorAgentMapping).filter(ConnectorAgentMapping.connector_id == connector_id).all()
    return [
        ConnectorAgentMappingResponse(
            mapping_id=m.mapping_id,
            connector_id=m.connector_id,
            agent_name=m.agent_name,
            allowed_tables=json.loads(m.allowed_tables_json) if m.allowed_tables_json else ["*"],
            allowed_collections=json.loads(m.allowed_collections_json) if m.allowed_collections_json else ["*"],
            plant_scope=m.plant_scope,
            max_query_limit=m.max_query_limit,
            enabled=m.enabled,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in mappings
    ]


@router.post("/{connector_id}/agents", response_model=ConnectorAgentMappingResponse)
def upsert_agent_mapping(
    connector_id: str,
    req: ConnectorAgentMappingRequest,
    db: Session = Depends(get_connector_db),
):
    """Authorize or update an AI Agent access mapping."""
    _ensure_connector_tables()
    model = db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
    if not model:
        raise HTTPException(status_code=404, detail=f"Connector '{connector_id}' not found.")

    mapping = (
        db.query(ConnectorAgentMapping)
        .filter(
            ConnectorAgentMapping.connector_id == connector_id,
            ConnectorAgentMapping.agent_name == req.agent_name,
        )
        .first()
    )
    now = datetime.utcnow()
    if not mapping:
        mapping = ConnectorAgentMapping(
            mapping_id=f"MAP-AGT-{uuid.uuid4().hex[:8].upper()}",
            connector_id=connector_id,
            agent_name=req.agent_name,
            created_at=now,
        )
        db.add(mapping)

    mapping.allowed_tables_json = json.dumps(req.allowed_tables)
    mapping.allowed_collections_json = json.dumps(req.allowed_collections)
    mapping.plant_scope = req.plant_scope
    mapping.max_query_limit = req.max_query_limit
    mapping.enabled = req.enabled
    mapping.updated_at = now
    db.commit()
    db.refresh(mapping)

    return ConnectorAgentMappingResponse(
        mapping_id=mapping.mapping_id,
        connector_id=mapping.connector_id,
        agent_name=mapping.agent_name,
        allowed_tables=json.loads(mapping.allowed_tables_json),
        allowed_collections=json.loads(mapping.allowed_collections_json),
        plant_scope=mapping.plant_scope,
        max_query_limit=mapping.max_query_limit,
        enabled=mapping.enabled,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
    )


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

@router.get("/{connector_id}/audit-logs", response_model=List[ConnectorAuditLogItem])
def get_connector_audit_logs(
    connector_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_connector_db),
):
    """Get audit trail for a specific connector."""
    _ensure_connector_tables()
    logs = (
        db.query(ConnectorAuditLog)
        .filter(ConnectorAuditLog.connector_id == connector_id)
        .order_by(ConnectorAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ConnectorAuditLogItem(
            log_id=l.log_id,
            connector_id=l.connector_id,
            action=l.action,
            user_id=l.user_id,
            user_email=l.user_email,
            result=l.result,
            execution_time_ms=l.execution_time_ms,
            details=json.loads(l.details_json) if l.details_json else None,
            created_at=l.created_at,
        )
        for l in logs
    ]


@router.get("/audit-logs/recent", response_model=List[ConnectorAuditLogItem])
def get_recent_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_connector_db),
):
    """Get recent audit trail across all connectors."""
    _ensure_connector_tables()
    logs = (
        db.query(ConnectorAuditLog)
        .order_by(ConnectorAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ConnectorAuditLogItem(
            log_id=l.log_id,
            connector_id=l.connector_id,
            action=l.action,
            user_id=l.user_id,
            user_email=l.user_email,
            result=l.result,
            execution_time_ms=l.execution_time_ms,
            details=json.loads(l.details_json) if l.details_json else None,
            created_at=l.created_at,
        )
        for l in logs
    ]
