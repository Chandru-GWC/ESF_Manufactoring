"""
Pydantic request, trace, evidence, and response schemas for the
EHS Safety AI Multi-Agent Architecture powered by DomoGPT and Neon PostgreSQL.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TokenUsageSchema(BaseModel):
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    reasoning_tokens: Optional[int] = None


class EvidenceItem(BaseModel):
    id: str = Field(..., description="Record identifier or verified aggregation key")
    label: str = Field(..., description="Human-readable metric or record description")
    dataset_source: str = Field(..., description="Approved Neon PostgreSQL table reference")
    value: Optional[str] = Field(None, description="Verified count, rate, severity, or status")
    excerpt: Optional[str] = Field(None, description="Concise fact context from database row")


class AgentTraceStep(BaseModel):
    step: int
    agent_key: str
    agent_name: str
    tool_name: str
    status: str = Field(..., pattern="^(completed|skipped|error)$")
    duration_ms: int = Field(0, ge=0)
    records_examined: int = Field(0, ge=0)
    summary: str


class AgentMetadata(BaseModel):
    agent_key: str
    agent_name: str
    role: str
    data_sources: List[str]
    capabilities: List[str]
    limitations: List[str] = []


class AIQueryRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=2000, description="Safety question from EHS operator")
    plant_id: Optional[str] = Field(
        None,
        pattern="^(ALL|IN-KA-01|IN-TN-01)$",
        description="Optional plant scope filter (ALL, IN-KA-01, IN-TN-01)",
    )
    target_agent: Optional[str] = Field(
        None,
        description="Optional explicit specialist agent key; if omitted, EHS Orchestrator selects automatically",
    )


class SpecialistAgentOutput(BaseModel):
    """Internal normalized contract returned by every specialist agent."""

    agent_key: str
    agent_name: str
    plant_scope: str
    summary: str
    key_findings: List[str]
    supporting_evidence: List[EvidenceItem]
    recommendations: List[str]
    data_sources: List[str]
    limitations: List[str] = []
    suggested_questions: List[str] = []
    model_id: Optional[str] = None
    session_id: Optional[str] = None
    token_usage: Optional[TokenUsageSchema] = None
    records_examined: int = 0
    duration_ms: int = 0
    metrics_snapshot: Dict[str, Any] = {}


class AIQueryResponse(BaseModel):
    """Structured API contract returned by POST /api/v1/ai/query."""

    success: bool = True
    agent_key: str
    agent_name: str
    user_question: str
    plant_scope: str = "ALL"
    routing_reason: str
    specialist_agents_invoked: List[str] = []
    summary: str
    key_findings: List[str]
    supporting_evidence: List[EvidenceItem]
    recommendations: List[str]
    data_sources: List[str]
    limitations: List[str] = []
    human_review_required: bool = True
    model_id: Optional[str] = None
    session_id: Optional[str] = None
    token_usage: Optional[TokenUsageSchema] = None
    execution_trace: List[AgentTraceStep] = []
    suggested_questions: List[str] = []
    timestamp: str
    error_code: Optional[str] = None

