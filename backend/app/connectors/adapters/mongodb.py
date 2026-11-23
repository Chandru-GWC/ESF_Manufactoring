"""
MongoDB & MongoDB Atlas Connector Adapter.
Uses PyMongo to discover databases, collections, document schemas, indexes
and preview documents with safe limits and read-only projection.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.connectors.base import BaseConnector
from app.connectors.security import validate_connection_target
from app.schemas.connector import (
    CollectionMetadata,
    ColumnMetadata,
    ConnectionTestResult,
    DataPreviewRequest,
    DataPreviewResponse,
    IndexMetadata,
)


class MongoDBConnector(BaseConnector):
    @classmethod
    def get_db_type(cls) -> str:
        return "mongodb"

    def _get_uri(self) -> str:
        if self.uri and self.uri.strip():
            return self.uri.strip()
        # Build standard mongodb URI
        user_part = f"{self.username}:{self.password}@" if self.username and self.password else ""
        host = self.host or "127.0.0.1"
        port = self.port or 27017
        validate_connection_target(host, port)
        db = f"/{self.database_name}" if self.database_name else ""
        ssl_part = "?ssl=true" if self.ssl_mode and self.ssl_mode.lower() in ("require", "true") else ""
        return f"mongodb://{user_part}{host}:{port}{db}{ssl_part}"

    def connect(self) -> MongoClient:
        uri = self._get_uri()
        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=self.timeout_sec * 1000,
            connectTimeoutMS=self.timeout_sec * 1000,
        )
        self._is_connected = True
        return client

    def disconnect(self) -> None:
        self._is_connected = False

    def test_connection(self) -> ConnectionTestResult:
        t0 = time.perf_counter()
        try:
            client = self.connect()
            # Force ping to test actual authentication and server availability
            info = client.admin.command("ping")
            server_info = client.server_info()
            version = server_info.get("version", "MongoDB")
            dbs = [d for d in client.list_database_names() if d not in ("admin", "local", "config")]
            client.close()
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=True,
                status="CONNECTED",
                latency_ms=latency,
                message=f"Connected successfully to MongoDB v{version} ({len(dbs)} databases accessible).",
                server_version=str(version),
                discovered_databases=dbs,
            )
        except Exception as e:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            return ConnectionTestResult(
                success=False,
                status="FAILED",
                latency_ms=latency,
                message=f"MongoDB connection failed: {str(e)}",
                error_code="MONGODB_AUTH_OR_NETWORK_ERROR",
                error_detail=str(e),
            )

    def get_databases(self) -> List[str]:
        client = self.connect()
        try:
            return [d for d in client.list_database_names() if d not in ("admin", "local", "config")]
        finally:
            client.close()

    def get_collections(self, database: Optional[str] = None) -> List[CollectionMetadata]:
        client = self.connect()
        try:
            target_dbs = [database] if database else self.get_databases()
            if not target_dbs and self.database_name:
                target_dbs = [self.database_name]

            collections: List[CollectionMetadata] = []
            for db_name in target_dbs:
                db = client[db_name]
                col_names = db.list_collection_names()
                if self.collection_filters:
                    col_names = [c for c in col_names if c in self.collection_filters]

                for c_name in col_names:
                    col = db[c_name]
                    doc_count = col.estimated_document_count()

                    # Sample 5 documents to infer schema fields
                    sample_docs = list(col.find().limit(5))
                    fields_dict: Dict[str, str] = {}
                    for doc in sample_docs:
                        for k, v in doc.items():
                            fields_dict[k] = type(v).__name__

                    cols_meta = [
                        ColumnMetadata(
                            name=fname,
                            data_type=ftype,
                            is_nullable=True,
                            is_primary_key=(fname == "_id"),
                        )
                        for fname, ftype in fields_dict.items()
                    ]

                    # Indexes
                    idx_info = col.index_information()
                    indexes = [
                        IndexMetadata(
                            name=idx_name,
                            columns=[k[0] for k in idx_val.get("key", [])],
                            is_unique=idx_val.get("unique", False),
                            is_primary=(idx_name == "_id_"),
                        )
                        for idx_name, idx_val in idx_info.items()
                    ]

                    collections.append(
                        CollectionMetadata(
                            name=c_name,
                            database_name=db_name,
                            document_count=doc_count,
                            sample_fields=cols_meta,
                            indexes=indexes,
                        )
                    )
            return collections
        finally:
            client.close()

    def preview_data(self, req: DataPreviewRequest) -> DataPreviewResponse:
        t0 = time.perf_counter()
        client = self.connect()
        try:
            db_name = req.database_name or self.database_name
            if not db_name:
                dbs = [d for d in client.list_database_names() if d not in ("admin", "local", "config")]
                db_name = dbs[0] if dbs else "test"

            col = client[db_name][req.target]

            projection = None
            if req.columns:
                projection = {c: 1 for c in req.columns}

            cursor = col.find({}, projection).skip(req.offset).limit(req.limit)
            raw_docs = list(cursor)

            # Convert non-serializable objects (like ObjectId) to string
            clean_rows: List[Dict[str, Any]] = []
            columns_set = set()
            types_dict = {}

            for doc in raw_docs:
                clean_doc = {}
                for k, v in doc.items():
                    columns_set.add(k)
                    types_dict[k] = type(v).__name__
                    clean_doc[k] = str(v) if not isinstance(v, (int, float, bool, str, list, dict, type(None))) else v
                clean_rows.append(clean_doc)

            columns_list = sorted(list(columns_set))
            total_count = col.estimated_document_count()

            elapsed = round((time.perf_counter() - t0) * 1000, 2)
            return DataPreviewResponse(
                connector_id=self.connector_id,
                target=req.target,
                schema_name=db_name,
                columns=columns_list,
                column_types=types_dict,
                rows=clean_rows,
                total_rows_estimate=total_count,
                limit=req.limit,
                offset=req.offset,
                execution_time_ms=elapsed,
                is_read_only=True,
            )
        finally:
            client.close()

