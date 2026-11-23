"""
SQLAlchemy models for the Dedicated EHS Resource & Database Connector Management System.
Stored exclusively in the separate Connector Database (ehs_connector_db).

Completely separated from the primary Neon PostgreSQL application database (neondb).
"""
from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from app.connectors.database import ConnectorBase


class DataConnector(ConnectorBase):
    """Configuration, credentials reference, and status of connected external databases."""
    __tablename__ = "data_connectors"

    connector_id = Column(String(64), primary_key=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    db_type = Column(String(32), nullable=False)  # postgresql, mysql, mongodb, sqlite, sqlserver, oracle
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String(120), nullable=True)
    username = Column(String(120), nullable=True)
    encrypted_password = Column(Text, nullable=True)
    encrypted_uri = Column(Text, nullable=True)
    ssl_mode = Column(String(32), nullable=False, default="prefer")
    ssl_ca_cert = Column(Text, nullable=True)
    read_only = Column(Boolean, nullable=False, default=True)
    connection_timeout_sec = Column(Integer, nullable=False, default=10)
    pool_size = Column(Integer, nullable=False, default=5)
    schema_filters_json = Column(Text, nullable=True)
    collection_filters_json = Column(Text, nullable=True)
    plant_id = Column(String(64), nullable=False, default="ALL")

    # Status & Health Monitoring
    status = Column(String(32), nullable=False, default="DISCONNECTED")  # CONNECTED, DISCONNECTED, FAILED, TESTING
    last_tested_at = Column(DateTime, nullable=True)
    last_connected_at = Column(DateTime, nullable=True)
    last_failed_at = Column(DateTime, nullable=True)
    last_error_message = Column(Text, nullable=True)
    last_latency_ms = Column(Float, nullable=True)

    # Discovered Metadata cache reference
    metadata_json = Column(Text, nullable=True)
    metadata_refreshed_at = Column(DateTime, nullable=True)

    created_by = Column(String(120), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConnectorTestHistory(ConnectorBase):
    """Historical ledger of connection tests with latency, server versions, and diagnostics."""
    __tablename__ = "connector_test_history"

    test_id = Column(String(64), primary_key=True)
    connector_id = Column(String(64), ForeignKey("data_connectors.connector_id", ondelete="CASCADE"), nullable=True, index=True)
    db_type = Column(String(32), nullable=False)
    tested_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    success = Column(Boolean, nullable=False)
    latency_ms = Column(Float, nullable=True)
    status = Column(String(32), nullable=False)
    server_version = Column(String(120), nullable=True)
    error_code = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    discovered_databases_json = Column(Text, nullable=True)
    discovered_schemas_json = Column(Text, nullable=True)
    discovered_collections_json = Column(Text, nullable=True)
    tested_by = Column(String(120), nullable=True)


class ConnectorMetadataCache(ConnectorBase):
    """Cached discovered schemas, tables, collections, and indexes for connected resources."""
    __tablename__ = "connector_metadata_cache"

    cache_id = Column(String(64), primary_key=True)
    connector_id = Column(String(64), ForeignKey("data_connectors.connector_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    db_type = Column(String(32), nullable=False)
    databases_json = Column(Text, nullable=True)
    schemas_json = Column(Text, nullable=True)
    tables_json = Column(Text, nullable=True)
    collections_json = Column(Text, nullable=True)
    estimated_row_counts_json = Column(Text, nullable=True)
    refreshed_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ConnectorModuleMapping(ConnectorBase):
    """Authorization mappings binding external database resources to EHS application modules."""
    __tablename__ = "connector_module_mappings"

    mapping_id = Column(String(64), primary_key=True)
    connector_id = Column(String(64), ForeignKey("data_connectors.connector_id", ondelete="CASCADE"), nullable=False, index=True)
    ehs_module = Column(String(64), nullable=False, index=True)  # overview, monitoring, events, insights, compliance
    allowed_tables_json = Column(Text, nullable=True)
    access_level = Column(String(32), nullable=False, default="READ_ONLY")
    enabled = Column(Boolean, nullable=False, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConnectorAgentMapping(ConnectorBase):
    """Authorization and governance mappings binding external resources to the 8 EHS AI Agents."""
    __tablename__ = "connector_agent_mappings"

    mapping_id = Column(String(64), primary_key=True)
    connector_id = Column(String(64), ForeignKey("data_connectors.connector_id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name = Column(String(64), nullable=False, index=True)  # e.g. telemetry_anomaly_agent, hazard_agent
    allowed_tables_json = Column(Text, nullable=True)
    allowed_collections_json = Column(Text, nullable=True)
    plant_scope = Column(String(64), nullable=False, default="ALL")
    max_query_limit = Column(Integer, nullable=False, default=25)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConnectorAuditLog(ConnectorBase):
    """Immutable audit trail for all connector actions, queries, previews, and agent accesses."""
    __tablename__ = "connector_audit_logs"

    log_id = Column(String(64), primary_key=True)
    connector_id = Column(String(64), nullable=True, index=True)
    action = Column(String(64), nullable=False)  # CREATE, UPDATE, DELETE, TEST, DISCONNECT, REFRESH_METADATA, DATA_PREVIEW, AGENT_ACCESSED
    result = Column(String(32), nullable=False)  # SUCCESS, FAILED, BLOCKED
    user_id = Column(String(120), nullable=True)
    user_email = Column(String(120), nullable=True)
    ip_address = Column(String(64), nullable=True)
    execution_time_ms = Column(Float, nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
