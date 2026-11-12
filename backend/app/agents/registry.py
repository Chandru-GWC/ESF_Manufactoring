"""Agent Registry for EHS Safety AI Logical Multi-Agent System."""
from __future__ import annotations

from typing import Dict, List

from app.agents.base import BaseEhsAgent
from app.agents.specialists import (
    CapaMonitoringAgent,
    HazardAnalysisAgent,
    IncidentAnalysisAgent,
    MaintenanceSafetyAgent,
    PermitComplianceAgent,
    SafetyIntelligenceAgent,
    WorkforceSafetyAgent,
)
from app.schemas.ai_agent import AgentMetadata


SPECIALIST_AGENTS: Dict[str, BaseEhsAgent] = {
    "hazard_analysis": HazardAnalysisAgent(),
    "incident_analysis": IncidentAnalysisAgent(),
    "workforce_safety": WorkforceSafetyAgent(),
    "maintenance_safety": MaintenanceSafetyAgent(),
    "capa_monitoring": CapaMonitoringAgent(),
    "permit_compliance": PermitComplianceAgent(),
    "safety_intelligence": SafetyIntelligenceAgent(),
}

ORCHESTRATOR_METADATA = AgentMetadata(
    agent_key="orchestrator",
    agent_name="EHS Orchestrator Agent",
    role="Interprets user safety inquiries, routes to relevant specialist agent(s), validates Neon DB evidence, and synthesizes unified DomoGPT responses.",
    data_sources=[
        "ehs_core.fact_ehs_event",
        "ehs_core.fact_workforce_attendance",
        "ehs_core.fact_maintenance_work_order",
    ],
    capabilities=[
        "Multi-domain intent classification",
        "Parallel specialist agent orchestration",
        "Grounded evidence aggregation & token tracking",
        "Safety guardrail & human-review enforcement",
    ],
    limitations=[
        "Strictly bound to approved Neon ehs_core tables; read-only operation with mandatory human EHS verification before CAPA or permit updates.",
    ],
)


def list_all_agents_metadata() -> List[AgentMetadata]:
    return [ORCHESTRATOR_METADATA, *[agent.metadata() for agent in SPECIALIST_AGENTS.values()]]


def get_specialist(agent_key: str) -> BaseEhsAgent:
    if agent_key not in SPECIALIST_AGENTS:
        raise KeyError(f"Unknown EHS specialist agent key: '{agent_key}'")
    return SPECIALIST_AGENTS[agent_key]

