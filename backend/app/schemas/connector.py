"""
Pydantic Schemas for Database & Resource Connectors API.
Ensures strict validation, secret masking, and comprehensive metadata discovery types.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

DatabaseType = Literal["postgresql", "mysql", "mongodb", "sqlite", "sqlserver", "oracle"]
ConnectorStatus = Literal["CONNECTED", "DISCONNECTED", "FAILED", "TESTING"]


class DriverStatusItem(BaseModel):
    db_type: DatabaseType
    display_name: str
    category: Literal["SQL", "NoSQL", "Embedded"]
    driver_name: str
    installed: bool
    version: Optional[str] = None
    default_port: Optional[int] = None
    supports_schemas: bool
    supports_collections: bool
    supports_ssl: bool
    description: str


class DriverStatusResponse(BaseModel):
    drivers: List[DriverStatusItem]
    total_drivers: int
    installed_count: int


class ConnectorCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    db_type: DatabaseType
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    uri: Optional[str] = None  # for MongoDB or SQLite
    ssl_mode: str = "prefer"  # disable, allow, prefer, require
    ssl_ca_cert: Optional[str] = None
    read_only: bool = True
    connection_timeout_sec: int = Field(10, ge=1, le=60)
    pool_size: int = Field(5, ge=1, le=20)
    schema_filters: Optional[List[str]] = None
    collection_filters: Optional[List[str]] = None
    plant_id: str = "ALL"
    test_before_save: bool = True


class ConnectorUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None  # None means keep existing encrypted password
    uri: Optional[str] = None
    ssl_mode: Optional[str] = None
    read_only: Optional[bool] = None
    connection_timeout_sec: Optional[int] = Field(None, ge=1, le=60)
    pool_size: Optional[int] = Field(None, ge=1, le=20)
    schema_filters: Optional[List[str]] = None
    collection_filters: Optional[List[str]] = None
    plant_id: Optional[str] = None


class ConnectionTestRequest(BaseModel):
    db_type: DatabaseType
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    uri: Optional[str] = None
    ssl_mode: str = "prefer"
    connection_timeout_sec: int = 10


class ConnectionTestResult(BaseModel):
    success: bool
    status: ConnectorStatus
    latency_ms: Optional[float] = None
    message: str
    server_version: Optional[str] = None
    discovered_databases: Optional[List[str]] = None
    discovered_schemas: Optional[List[str]] = None
    discovered_collections: Optional[List[str]] = None
    error_code: Optional[str] = None
    error_detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ColumnMetadata(BaseModel):
    name: str
    data_type: str
    is_nullable: bool = True
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_key_target: Optional[str] = None
    default_value: Optional[str] = None
    max_length: Optional[int] = None


class IndexMetadata(BaseModel):
    name: str
    columns: List[str]
    is_unique: bool = False
    is_primary: bool = False


class TableMetadata(BaseModel):
    name: str
    schema_name: Optional[str] = None
    columns: List[ColumnMetadata] = Field(default_factory=list)
    indexes: List[IndexMetadata] = Field(default_factory=list)
    estimated_row_count: Optional[int] = None


class CollectionMetadata(BaseModel):
    name: str
    database_name: str
    document_count: Optional[int] = None
    sample_fields: List[ColumnMetadata] = Field(default_factory=list)
    indexes: List[IndexMetadata] = Field(default_factory=list)


class DatabaseMetadata(BaseModel):
    connector_id: str
    connector_name: str
    db_type: DatabaseType
    databases: List[str] = Field(default_factory=list)
    schemas: List[str] = Field(default_factory=list)
    tables: List[TableMetadata] = Field(default_factory=list)
    collections: List[CollectionMetadata] = Field(default_factory=list)
    refreshed_at: datetime = Field(default_factory=datetime.utcnow)


class DataPreviewRequest(BaseModel):
    target: str  # table name or collection name
    schema_name: Optional[str] = None
    database_name: Optional[str] = None
    columns: Optional[List[str]] = None
    filter_clause: Optional[str] = None
    limit: int = Field(25, ge=1, le=100)
    offset: int = Field(0, ge=0)


class DataPreviewResponse(BaseModel):
    connector_id: str
    target: str
    schema_name: Optional[str] = None
    columns: List[str]
    column_types: Dict[str, str] = Field(default_factory=dict)
    rows: List[Dict[str, Any]]
    total_rows_estimate: Optional[int] = None
    limit: int
    offset: int
    execution_time_ms: float
    is_read_only: bool = True


class ConnectorResponse(BaseModel):
    connector_id: str
    name: str
    description: Optional[str] = None
    db_type: DatabaseType
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    masked_password: str = ""
    masked_uri: str = ""
    ssl_mode: str
    read_only: bool
    connection_timeout_sec: int
    pool_size: int
    schema_filters: List[str] = Field(default_factory=list)
    collection_filters: List[str] = Field(default_factory=list)
    plant_id: str
    status: ConnectorStatus
    last_tested_at: Optional[datetime] = None
    last_connected_at: Optional[datetime] = None
    last_failed_at: Optional[datetime] = None
    last_error_message: Optional[str] = None
    last_latency_ms: Optional[float] = None
    metadata_refreshed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ConnectorOverviewStats(BaseModel):
    total_connectors: int
    active_connections: int
    failed_connections: int
    disconnected_sources: int
    by_type: Dict[str, int]
    average_latency_ms: Optional[float] = 0.0


class ConnectorTestHistoryResponse(BaseModel):
    test_id: str
    connector_id: Optional[str] = None
    db_type: str
    tested_at: datetime
    success: bool
    latency_ms: Optional[float] = None
    status: str
    server_version: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    discovered_databases: Optional[List[str]] = None
    discovered_schemas: Optional[List[str]] = None
    discovered_collections: Optional[List[str]] = None
    tested_by: Optional[str] = None


class ConnectorModuleMappingRequest(BaseModel):
    ehs_module: str = Field(..., description="EHS module name, e.g. overview, monitoring, events, insights, compliance")
    allowed_tables: List[str] = Field(default_factory=lambda: ["*"])
    access_level: str = "READ_ONLY"
    enabled: bool = True
    description: Optional[str] = None


class ConnectorModuleMappingResponse(BaseModel):
    mapping_id: str
    connector_id: str
    ehs_module: str
    allowed_tables: List[str]
    access_level: str
    enabled: bool
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ConnectorAgentMappingRequest(BaseModel):
    agent_name: str = Field(..., description="EHS AI Agent name, e.g. telemetry_anomaly_agent, hazard_agent")
    allowed_tables: List[str] = Field(default_factory=lambda: ["*"])
    allowed_collections: List[str] = Field(default_factory=lambda: ["*"])
    plant_scope: str = "ALL"
    max_query_limit: int = Field(25, ge=1, le=100)
    enabled: bool = True


class ConnectorAgentMappingResponse(BaseModel):
    mapping_id: str
    connector_id: str
    agent_name: str
    allowed_tables: List[str]
    allowed_collections: List[str]
    plant_scope: str
    max_query_limit: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ConnectorDBHealthResponse(BaseModel):
    healthy: bool
    status: str
    database_name: Optional[str] = None
    dialect: str
    latency_ms: float
    pool: Dict[str, Any]


class ConnectorAuditLogItem(BaseModel):
    log_id: str
    connector_id: Optional[str] = None
    action: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    result: str
    execution_time_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
