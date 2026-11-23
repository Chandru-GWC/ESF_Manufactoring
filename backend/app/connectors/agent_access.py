"""
Controlled Data Access Layer for EHS AI Agents.
Enables the 8 EHS AI agents to safely retrieve relevant records from authorized connected external databases
with plant-scope governance, strict read-only execution, audit logging, and explicit provenance tagging.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from sqlalchemy.orm import Session

from app.connectors.manager import connector_manager, record_audit_log
from app.models.connector import ConnectorAgentMapping, DataConnector
from app.schemas.connector import DataPreviewRequest


class AgentConnectedDataService:
    """Provides controlled read-only queries for specialized EHS AI agents."""

    def __init__(self, db: Session, plant_scope: str = "ALL", user_id: str = "AI-AGENT") -> None:
        self.db = db
        self.plant_scope = plant_scope
        self.user_id = user_id

    def list_authorized_connectors(self, plant_id: Optional[str] = None) -> List[DataConnector]:
        """Find active/connected data sources permitted for the given or current plant scope."""
        scope = plant_id or self.plant_scope
        query = self.db.query(DataConnector).filter(DataConnector.status == "CONNECTED")
        if scope != "ALL":
            query = query.filter(
                (DataConnector.plant_id == "ALL") | (DataConnector.plant_id == scope)
            )
        return query.all()

    def get_available_sources(self, plant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return a structured summary of authorized data sources for agents."""
        connectors = self.list_authorized_connectors(plant_id=plant_id)
        return [
            {
                "connector_id": c.connector_id,
                "name": c.name,
                "db_type": c.db_type,
                "database_name": c.database_name,
                "plant_id": c.plant_id,
                "status": c.status,
            }
            for c in connectors
        ]

    def query_external_records(
        self,
        connector_id: Optional[str] = None,
        table_or_collection: Optional[str] = None,
        agent_name: str = "ehs_agent",
        domain_keywords: Optional[List[str]] = None,
        plant_id: Optional[str] = None,
        filter_clause: Optional[str] = None,
        limit: int = 15,
    ) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Query connected external database resources with strict read-only guarantees,
        explicit provenance tagging, and audit logging.

        Supports two query modes:
        1. Targeted Query: connector_id + table_or_collection specified -> returns single result dict with records & provenance.
        2. Domain Search: domain_keywords specified -> searches across authorized connectors for matching tables.
        """
        effective_scope = plant_id or self.plant_scope

        # Check explicit agent authorization mapping if configured
        if connector_id:
            mapping = (
                self.db.query(ConnectorAgentMapping)
                .filter(
                    ConnectorAgentMapping.connector_id == connector_id,
                    ConnectorAgentMapping.agent_name == agent_name,
                )
                .first()
            )
            if mapping:
                if not mapping.enabled:
                    raise PermissionError(f"Agent '{agent_name}' access to connector '{connector_id}' is disabled by administrator.")
                if mapping.max_query_limit and limit > mapping.max_query_limit:
                    limit = mapping.max_query_limit

        # Mode 1: Targeted Query
        if connector_id and table_or_collection:
            conn_model = self.db.query(DataConnector).filter(DataConnector.connector_id == connector_id).first()
            if not conn_model:
                raise ValueError(f"Connector '{connector_id}' not found.")
            if conn_model.status != "CONNECTED":
                raise RuntimeError(f"Connector '{conn_model.name}' is currently {conn_model.status}.")

            adapter = connector_manager.get_adapter_for_model(conn_model)
            preview_req = DataPreviewRequest(
                target=table_or_collection,
                filter_clause=filter_clause,
                limit=limit,
            )
            preview_res = adapter.preview_data(preview_req)

            record_audit_log(
                db=self.db,
                connector_id=connector_id,
                action="AGENT_QUERY",
                result="SUCCESS",
                user_id=f"AI:{agent_name}",
                user_email=f"agent.{agent_name}@ehs-ai.internal",
                execution_time_ms=preview_res.execution_time_ms,
                details={
                    "agent": agent_name,
                    "target": table_or_collection,
                    "rows_retrieved": len(preview_res.rows),
                },
            )

            return {
                "provenance": {
                    "source_type": conn_model.db_type,
                    "connector_id": conn_model.connector_id,
                    "connector_name": conn_model.name,
                    "database": conn_model.database_name or "default",
                    "table": table_or_collection,
                    "requested_by_agent": agent_name,
                    "retrieved_at": datetime.utcnow().isoformat(),
                    "records_count": len(preview_res.rows),
                    "note": f"Retrieved by AI Agent '{agent_name}' from external connected {conn_model.db_type} database '{conn_model.name}'.",
                },
                "columns": preview_res.columns,
                "records": preview_res.rows,
            }

        # Mode 2: Domain Search across authorized connectors
        keywords = domain_keywords or ["incident", "hazard", "telemetry", "maintenance"]
        connectors = self.list_authorized_connectors(plant_id=effective_scope)
        results: List[Dict[str, Any]] = []

        for conn_model in connectors:
            try:
                adapter = connector_manager.get_adapter_for_model(conn_model)

                # Check SQL tables
                tables = adapter.get_tables()
                matching_tables = [
                    t for t in tables
                    if any(kw.lower() in t.name.lower() for kw in keywords)
                ]

                for tbl in matching_tables[:2]:
                    preview_req = DataPreviewRequest(
                        target=tbl.name,
                        schema_name=tbl.schema_name,
                        filter_clause=filter_clause,
                        limit=limit,
                    )
                    data = adapter.preview_data(preview_req)
                    if data.rows:
                        results.append({
                            "provenance": {
                                "source_type": conn_model.db_type,
                                "connector_id": conn_model.connector_id,
                                "connector_name": conn_model.name,
                                "database": conn_model.database_name or "default",
                                "table": tbl.name,
                                "requested_by_agent": agent_name,
                                "retrieved_at": datetime.utcnow().isoformat(),
                                "records_count": len(data.rows),
                                "note": f"Retrieved by {agent_name} from external connected {conn_model.db_type} database '{conn_model.name}'.",
                            },
                            "records": data.rows,
                        })
                        record_audit_log(
                            db=self.db,
                            connector_id=conn_model.connector_id,
                            action="AGENT_QUERY",
                            result="SUCCESS",
                            user_id=f"AI:{agent_name}",
                            user_email=f"agent.{agent_name}@ehs-ai.internal",
                            details={"agent": agent_name, "table": tbl.name, "rows_retrieved": len(data.rows)},
                        )

            except Exception as e:
                # Do not crash the agent if an external data source is offline
                results.append({
                    "provenance": {
                        "source_type": conn_model.db_type,
                        "connector_id": conn_model.connector_id,
                        "connector_name": conn_model.name,
                        "status": "UNAVAILABLE",
                        "error": str(e),
                    },
                    "records": [],
                })

        return results
