"""
Tests for Dedicated Enterprise Database & Resource Connector Management module.

Validates:
1. Complete isolation: Operates against separate Connector Database.
2. Security utilities (AES-256-GCM encryption/decryption, masking, SSRF validation, SQL identifier sanitization).
3. SQLite adapter (real zero-mock engine for connection, discovery, filtering, and preview).
4. Driver status discovery.
5. Connector Database Health endpoint (/api/v1/connectors/health).
6. REST API routes (/api/v1/connectors) with TestClient, RBAC, separate DB session, test history, module & agent mappings.
7. AI Agent data access layer (AgentConnectedDataService with provenance tagging and audit logging).
"""
from sqlalchemy.engine import make_url
import os
import sqlite3
import tempfile
from datetime import datetime
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.connectors.database import ConnectorBase, get_connector_db
from app.main import app
from app.connectors.security import (
    encrypt_secret,
    decrypt_secret,
    mask_secret,
    validate_connection_target,
    sanitize_sql_identifier,
    validate_read_only_clause,
)
from app.connectors.adapters.sqlite import SQLiteConnector
from app.connectors.registry import get_driver_status_response, get_adapter_class
from app.connectors.manager import connector_manager
from app.connectors.service import ConnectorManagementService
from app.connectors.agent_access import AgentConnectedDataService
from app.models.connector import (
    ConnectorAgentMapping,
    ConnectorAuditLog,
    ConnectorMetadataCache,
    ConnectorModuleMapping,
    ConnectorTestHistory,
    DataConnector,
)
from app.schemas.connector import DataPreviewRequest


# ---------------------------------------------------------------------------
# 1. Security Utilities Tests
# ---------------------------------------------------------------------------

def test_aes_gcm_encryption_roundtrip():
    secret = "SuperSecretDbPassword123!@#"
    encrypted = encrypt_secret(secret)
    assert encrypted is not None
    assert encrypted != secret
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret


def test_encryption_empty_and_none():
    assert encrypt_secret(None) is None
    assert encrypt_secret("") is None
    assert decrypt_secret(None) is None
    assert decrypt_secret("") is None


def test_mask_secret():
    assert mask_secret(None) == ""
    assert mask_secret("") == ""
    masked = mask_secret("some_secret_or_hash")
    assert masked == "••••••••"


def test_ssrf_validation():
    # Safe targets
    validate_connection_target("localhost")
    validate_connection_target("127.0.0.1")
    validate_connection_target("db.internal.company.com")
    validate_connection_target("postgres-primary.cluster.local")

    # Cloud metadata endpoints must be blocked with HTTP 400
    with pytest.raises(HTTPException) as exc_info:
        validate_connection_target("169.254.169.254")
    assert exc_info.value.status_code == 400
    assert "prohibited" in exc_info.value.detail.lower()

    with pytest.raises(HTTPException) as exc_info:
        validate_connection_target("metadata.google.internal")
    assert exc_info.value.status_code == 400


def test_sql_identifier_sanitization():
    assert sanitize_sql_identifier("valid_table_1") == "valid_table_1"
    assert sanitize_sql_identifier("equipment_telemetry") == "equipment_telemetry"

    with pytest.raises(HTTPException) as exc_info:
        sanitize_sql_identifier("users; DROP TABLE users;")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        sanitize_sql_identifier("table--comment")
    assert exc_info.value.status_code == 400


def test_read_only_clause_validation():
    assert validate_read_only_clause("status = 'ACTIVE' AND severity > 2") == "status = 'ACTIVE' AND severity > 2"
    assert validate_read_only_clause(None) is None
    assert validate_read_only_clause("") is None

    # Mutation keywords must be blocked with HTTP 400
    for bad in ["id = 1; DELETE FROM users", "1=1; DROP TABLE logs", "status = 'A'; INSERT INTO x VALUES (1)"]:
        with pytest.raises(HTTPException) as exc_info:
            validate_read_only_clause(bad)
        assert exc_info.value.status_code == 400


# ---------------------------------------------------------------------------
# 2. SQLite Adapter Real Engine Tests (Zero-Mock)
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_sqlite_db():
    """Create a temporary SQLite database populated with realistic EHS equipment telemetry."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE equipment_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipment_id TEXT NOT NULL,
            plant_id TEXT NOT NULL,
            temperature REAL,
            vibration_level REAL,
            status TEXT,
            recorded_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE safety_checklists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            checklist_name TEXT NOT NULL,
            plant_id TEXT NOT NULL,
            verified INTEGER DEFAULT 1
        )
    """)
    for i in range(1, 16):
        cur.execute(
            "INSERT INTO equipment_telemetry (equipment_id, plant_id, temperature, vibration_level, status, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
            (f"EQ-{i:03d}", "PLANT-A" if i % 2 == 0 else "PLANT-B", 45.0 + i, 1.2 * i, "NORMAL" if i < 12 else "WARNING", "2026-11-13T10:00:00Z"),
        )
    conn.commit()
    conn.close()

    yield path

    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


def test_sqlite_adapter_connection_and_discovery(sample_sqlite_db):
    connector = SQLiteConnector(
        connector_id="test-sqlite-1",
        name="Local Telemetry DB",
        database_name=sample_sqlite_db,
        read_only=True,
    )

    # Test connection
    test_res = connector.test_connection()
    assert test_res.success is True
    assert test_res.latency_ms >= 0
    assert test_res.server_version is not None
    assert "SQLite" in test_res.message

    # Test database listing
    dbs = connector.get_databases()
    assert len(dbs) >= 1
    assert "main" in dbs

    # Test table listing
    tables = connector.get_tables()
    table_names = [t.name for t in tables]
    assert "equipment_telemetry" in table_names
    assert "safety_checklists" in table_names

    # Test column discovery
    cols = connector.get_columns("equipment_telemetry")
    col_names = [c.name for c in cols]
    assert "id" in col_names
    assert "equipment_id" in col_names
    assert "temperature" in col_names
    id_col = next(c for c in cols if c.name == "id")
    assert id_col.is_primary_key is True

    # Test data preview
    req = DataPreviewRequest(target="equipment_telemetry", limit=5, offset=0)
    preview = connector.preview_data(req)
    assert len(preview.columns) >= 6
    assert len(preview.rows) == 5
    assert preview.total_rows_estimate == 15
    assert preview.rows[0]["equipment_id"] == "EQ-001"

    # Test data preview with filter
    filtered_req = DataPreviewRequest(target="equipment_telemetry", limit=5, filter_clause="status = 'WARNING'")
    filtered_preview = connector.preview_data(filtered_req)
    assert len(filtered_preview.rows) == 4
    assert all(r["status"] == "WARNING" for r in filtered_preview.rows)

    # Test metadata tree
    metadata = connector.get_metadata()
    assert metadata.db_type == "sqlite"
    assert len(metadata.tables) >= 2

    connector.disconnect()


# ---------------------------------------------------------------------------
# 3. Registry & Driver Status Tests
# ---------------------------------------------------------------------------

def test_driver_status_discovery():
    status = get_driver_status_response()
    assert len(status.drivers) >= 6

    driver_types = [d.db_type for d in status.drivers]
    assert "sqlite" in driver_types
    assert "postgresql" in driver_types
    assert "mysql" in driver_types
    assert "mongodb" in driver_types

    sqlite_driver = next(d for d in status.drivers if d.db_type == "sqlite")
    assert sqlite_driver.installed is True


# ---------------------------------------------------------------------------
# 4. REST API Routes Integration Tests with Dedicated Connector DB Session
# ---------------------------------------------------------------------------

@pytest.fixture
def connector_test_db():
    """Create an isolated database session for connector tables during tests."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ConnectorBase.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()

    yield session

    session.close()
    engine.dispose()


@pytest.fixture
def client_with_connector_db(connector_test_db, monkeypatch):
    """Provide a TestClient with get_connector_db overridden to use connector_test_db."""
    def override_get_connector_db():
        yield connector_test_db

    app.dependency_overrides[get_connector_db] = override_get_connector_db
    import app.api.routes.connectors as conn_routes
    monkeypatch.setattr(conn_routes, "_ensure_connector_tables", lambda: None)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def test_api_health(client_with_connector_db):
    resp = client_with_connector_db.get("/api/v1/connectors/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "healthy" in data
    assert "pool" in data


def test_api_driver_status(client_with_connector_db):
    resp = client_with_connector_db.get("/api/v1/connectors/drivers/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "drivers" in data
    assert any(d["db_type"] == "sqlite" for d in data["drivers"])


def test_api_transient_connection_test(client_with_connector_db, sample_sqlite_db):
    payload = {
        "db_type": "sqlite",
        "database_name": sample_sqlite_db,
    }
    resp = client_with_connector_db.post("/api/v1/connectors/test", json=payload)
    assert resp.status_code == 200
    result = resp.json()
    assert result["success"] is True
    assert result["latency_ms"] >= 0


def test_api_connector_crud_and_features(client_with_connector_db, sample_sqlite_db):

    # 1. Create connector (HTTP 201)
    create_payload = {
        "name": "Integration Test SQLite",
        "description": "Telemetry database for testing",
        "db_type": "sqlite",
        "database_name": sample_sqlite_db,
        "plant_id": "PLANT-A",
        "read_only": True,
    }
    create_resp = client_with_connector_db.post("/api/v1/connectors", json=create_payload)
    assert create_resp.status_code == 201
    created = create_resp.json()
    conn_id = created["connector_id"]
    assert created["name"] == "Integration Test SQLite"
    assert created["db_type"] == "sqlite"
    assert created["status"] == "CONNECTED"


    # 3. List connectors
    list_resp = client_with_connector_db.get("/api/v1/connectors")
    assert list_resp.status_code == 200
    connectors = list_resp.json()
    assert len(connectors) == 1
    assert connectors[0]["connector_id"] == conn_id

    # 4. Overview stats
    overview_resp = client_with_connector_db.get("/api/v1/connectors/overview")
    assert overview_resp.status_code == 200
    stats = overview_resp.json()
    assert stats["total_connectors"] == 1
    assert stats["active_connections"] == 1

    # 5. Test saved connector
    test_saved_resp = client_with_connector_db.post(f"/api/v1/connectors/{conn_id}/test")
    assert test_saved_resp.status_code == 200
    assert test_saved_resp.json()["success"] is True

    # 6. Test history endpoint
    history_resp = client_with_connector_db.get(f"/api/v1/connectors/{conn_id}/history")
    assert history_resp.status_code == 200
    hist = history_resp.json()
    assert len(hist) >= 1
    assert hist[0]["success"] is True

    # 7. Module mapping endpoint
    module_payload = {
        "ehs_module": "overview",
        "allowed_tables": ["equipment_telemetry"],
        "access_level": "READ_ONLY",
        "enabled": True,
    }
    mod_post_resp = client_with_connector_db.post(f"/api/v1/connectors/{conn_id}/modules", json=module_payload)
    assert mod_post_resp.status_code == 200
    mod_get_resp = client_with_connector_db.get(f"/api/v1/connectors/{conn_id}/modules")
    assert mod_get_resp.status_code == 200
    assert len(mod_get_resp.json()) == 1
    assert mod_get_resp.json()[0]["ehs_module"] == "overview"

    # 8. Agent mapping endpoint
    agent_payload = {
        "agent_name": "telemetry_anomaly_agent",
        "allowed_tables": ["equipment_telemetry"],
        "plant_scope": "PLANT-A",
        "max_query_limit": 20,
        "enabled": True,
    }
    agent_post_resp = client_with_connector_db.post(f"/api/v1/connectors/{conn_id}/agents", json=agent_payload)
    assert agent_post_resp.status_code == 200
    agent_get_resp = client_with_connector_db.get(f"/api/v1/connectors/{conn_id}/agents")
    assert agent_get_resp.status_code == 200
    assert len(agent_get_resp.json()) == 1
    assert agent_get_resp.json()[0]["agent_name"] == "telemetry_anomaly_agent"

    # 9. List tables via API
    tables_resp = client_with_connector_db.get(f"/api/v1/connectors/{conn_id}/tables")
    assert tables_resp.status_code == 200
    tables = tables_resp.json()
    assert len(tables) >= 2
    table_names = [t["name"] for t in tables]
    assert "equipment_telemetry" in table_names

    # 10. Get full metadata via API
    meta_resp = client_with_connector_db.get(f"/api/v1/connectors/{conn_id}/metadata")
    assert meta_resp.status_code == 200
    meta = meta_resp.json()
    assert meta["connector_id"] == conn_id
    assert len(meta["tables"]) >= 2

    # 11. Preview data via API
    preview_payload = {
        "target": "equipment_telemetry",
        "limit": 5,
        "offset": 0,
        "filter_clause": "status = 'NORMAL'",
    }
    preview_resp = client_with_connector_db.post(f"/api/v1/connectors/{conn_id}/preview", json=preview_payload)
    assert preview_resp.status_code == 200
    pdata = preview_resp.json()
    assert len(pdata["rows"]) == 5
    assert all(r["status"] == "NORMAL" for r in pdata["rows"])

    # 12. Disconnect connector
    disc_resp = client_with_connector_db.post(f"/api/v1/connectors/{conn_id}/disconnect")
    assert disc_resp.status_code == 200

    # 13. Audit logs endpoint
    audit_resp = client_with_connector_db.get(f"/api/v1/connectors/{conn_id}/audit-logs")
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 1

    # 14. Delete connector
    del_resp = client_with_connector_db.delete(f"/api/v1/connectors/{conn_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True


# ---------------------------------------------------------------------------
# 5. AI Agent Connected Data Service Tests
# ---------------------------------------------------------------------------

def test_agent_connected_data_service(connector_test_db, sample_sqlite_db):
    conn_record = DataConnector(
        connector_id="agent-conn-sqlite",
        name="Equipment Sensors DB",
        db_type="sqlite",
        database_name=sample_sqlite_db,
        plant_id="PLANT-A",
        read_only=True,
        status="CONNECTED",
    )
    connector_test_db.add(conn_record)
    connector_test_db.commit()

    agent_service = AgentConnectedDataService(db=connector_test_db)

    # 1. List available external sources for agent
    sources = agent_service.get_available_sources(plant_id="PLANT-A")
    assert len(sources) == 1
    assert sources[0]["connector_id"] == "agent-conn-sqlite"

    # 2. Query external records with provenance tagging
    result = agent_service.query_external_records(
        connector_id="agent-conn-sqlite",
        table_or_collection="equipment_telemetry",
        agent_name="telemetry_anomaly_agent",
        plant_id="PLANT-A",
        filter_clause="status = 'WARNING'",
        limit=10,
    )

    # Verify provenance metadata
    assert result["provenance"]["source_type"] == "sqlite"
    assert result["provenance"]["connector_name"] == "Equipment Sensors DB"
    assert result["provenance"]["table"] == "equipment_telemetry"
    assert result["provenance"]["requested_by_agent"] == "telemetry_anomaly_agent"
    assert "retrieved_at" in result["provenance"]

    # Verify records returned
    assert len(result["records"]) > 0
    assert result["records"][0]["status"] == "WARNING"

    # 3. Verify audit log entry was created for the AI query
    audit = connector_test_db.query(ConnectorAuditLog).filter_by(
        connector_id="agent-conn-sqlite",
        action="AGENT_QUERY",
    ).first()
    assert audit is not None
    assert audit.user_id == "AI:telemetry_anomaly_agent"


def test_primary_database_info_shows_connection_details_without_the_password(client_with_connector_db):
    from app.core.config import settings

    resp = client_with_connector_db.get("/api/v1/connectors/primary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("CONNECTED", "DISCONNECTED")
    for key in ("name", "db_type", "host", "port", "database_name", "username", "password_masked", "schema", "tables"):
        assert key in data
    password = make_url(settings.DATABASE_URL).password if settings.DATABASE_URL else None
    if password:
        assert password not in resp.text  # the real password is never sent to the browser
        assert data["password_masked"]
    if data["status"] == "CONNECTED":
        assert data["latency_ms"] is not None
