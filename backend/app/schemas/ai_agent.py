"""
Pydantic request, trace, evidence, and response schemas for the
EHS Safety AI Multi-Agent Architecture powered by DomoGPT and Neon PostgreSQL.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
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
        description="Ignored: the platform has a single agent (kept for API compatibility)",
    )


class SpecialistAgentOutput(BaseModel):
    """Normalized agent result."""

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


ChartType = Literal[
    "line", "area", "bar", "horizontal_bar", "stacked_bar", "grouped_bar", "pie", "donut", "heatmap", "scatter", "radial_gauge", "speedometer"
]


class KpiItem(BaseModel):
    label: str
    value: Union[str, int, float]
    unit: Optional[str] = None
    caption: Optional[str] = None
    tone: Literal["neutral", "good", "warning", "critical"] = "neutral"


class ChartAxis(BaseModel):
    label: Optional[str] = None


class ChartPoint(BaseModel):
    x: Union[str, int, float]
    y: float
    label: Optional[str] = None


class ChartSeries(BaseModel):
    name: str
    data: List[ChartPoint]


class ChartSlice(BaseModel):
    label: str
    value: float


class ChartCell(BaseModel):
    x: str
    y: str
    value: float


class ChartSpec(BaseModel):
    """One chart the agent decided to show. Only the data field of its type is filled."""

    type: ChartType
    title: str
    subtitle: Optional[str] = None
    x_axis: Optional[ChartAxis] = None
    y_axis: Optional[ChartAxis] = None
    unit: Optional[str] = None
    series: List[ChartSeries] = []  # line, area, bar, horizontal_bar, stacked_bar, grouped_bar, scatter
    slices: List[ChartSlice] = []  # pie, donut
    cells: List[ChartCell] = []  # heatmap


class TableSpec(BaseModel):
    title: Optional[str] = None
    columns: List[str]
    rows: List[List[Union[str, int, float, bool, None]]]


class AIQueryResponse(BaseModel):
    """Structured API contract returned by POST /api/v1/ai/query."""

    success: bool = True
    agent_key: str
    agent_name: str
    user_question: str
    plant_scope: str = "ALL"
    routing_reason: str
    specialist_agents_invoked: List[str] = []
    # The answer: `content` always; kpis / charts / table only when the agent decided they are needed.
    content: str = ""
    kpis: List[KpiItem] = []
    charts: List[ChartSpec] = []
    table: Optional[TableSpec] = None
    summary: str  # same text as `content` (kept for older clients)
    key_findings: List[str] = []
    supporting_evidence: List[EvidenceItem]
    recommendations: List[str] = []
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

