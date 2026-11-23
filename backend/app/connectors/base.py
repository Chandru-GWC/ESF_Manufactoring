"""
Abstract Base Connector Interface.
Defines mandatory contracts for all external SQL and NoSQL database adapters.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.schemas.connector import (
    CollectionMetadata,
    ColumnMetadata,
    ConnectionTestResult,
    DatabaseMetadata,
    DataPreviewRequest,
    DataPreviewResponse,
    TableMetadata,
)


class BaseConnector(ABC):
    """Abstract database adapter interface."""

    def __init__(
        self,
        connector_id: str,
        name: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database_name: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        uri: Optional[str] = None,
        ssl_mode: str = "prefer",
        timeout_sec: int = 10,
        read_only: bool = True,
        schema_filters: Optional[List[str]] = None,
        collection_filters: Optional[List[str]] = None,
    ) -> None:
        self.connector_id = connector_id
        self.name = name
        self.host = host
        self.port = port
        self.database_name = database_name
        self.username = username
        self.password = password
        self.uri = uri
        self.ssl_mode = ssl_mode
        self.timeout_sec = timeout_sec
        self.read_only = read_only
        self.schema_filters = schema_filters or []
        self.collection_filters = collection_filters or []
        self._is_connected = False

    @abstractmethod
    def connect(self) -> Any:
        """Establish connection or initialize client."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection and release pool resources."""
        pass

    @abstractmethod
    def test_connection(self) -> ConnectionTestResult:
        """Test active credentials and connectivity, returning latency and diagnostics."""
        pass

    def get_databases(self) -> List[str]:
        """Discover database names if supported by database engine."""
        return [self.database_name] if self.database_name else []

    def get_schemas(self) -> List[str]:
        """Discover schemas if supported by database engine."""
        return []

    def get_tables(self, schema: Optional[str] = None) -> List[TableMetadata]:
        """Discover tables and views."""
        return []

    def get_collections(self, database: Optional[str] = None) -> List[CollectionMetadata]:
        """Discover collections (NoSQL engines like MongoDB)."""
        return []

    def get_columns(self, table: str, schema: Optional[str] = None) -> List[ColumnMetadata]:
        """Discover columns, types and keys for a specific table."""
        return []

    @abstractmethod
    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        """Safely fetch a small bounded sample of records."""
        pass

    def get_metadata(self) -> DatabaseMetadata:
        """Discover comprehensive schema and object hierarchy."""
        databases = self.get_databases()
        schemas = self.get_schemas()
        tables = self.get_tables()
        collections = self.get_collections()

        return DatabaseMetadata(
            connector_id=self.connector_id,
            connector_name=self.name,
            db_type=self.get_db_type(),  # type: ignore[arg-type]
            databases=databases,
            schemas=schemas,
            tables=tables,
            collections=collections,
        )

    @classmethod
    @abstractmethod
    def get_db_type(cls) -> str:
        """Return the database type identifier string."""
        pass

