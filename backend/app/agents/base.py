"""
Shared Base Agent Contract, Safe Prompt Builder, and JSON Output Validator
for all EHS Safety AI Logical Specialist Agents using DomoGPTService.
"""
from __future__ import annotations

import json
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.agents.tools import EhsNeonDataTools, _normalize_plant_filter
from app.schemas.ai_agent import (
    AgentMetadata,
    EvidenceItem,
    SpecialistAgentOutput,
    TokenUsageSchema,
)
from app.services.domogpt_service import DomoGPTService, domogpt_service


def _extract_json_object(raw_text: str) -> Optional[Dict[str, Any]]:
    """Parse strict, markdown-fenced, or slightly truncated JSON returned by DomoGPT."""
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*)\s*```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    else:
        # Handle unclosed ```json fence if model stopped near token limit
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except ValueError:
        # Partial JSON field recovery if response clipped before final brace
        recovered: Dict[str, Any] = {}
        sum_match = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', cleaned, re.DOTALL)
        if sum_match:
            try:
                recovered["summary"] = json.loads(f'"{sum_match.group(1)}"')
            except ValueError:
                recovered["summary"] = sum_match.group(1)

        for key in ("key_findings", "recommendations", "suggested_questions"):
            arr_match = re.search(rf'"{key}"\s*:\s*\[(.*?)\]', cleaned, re.DOTALL)
            if arr_match:
                items = re.findall(r'"((?:[^"\\]|\\.)+)"', arr_match.group(1))
                cleaned_items: List[str] = []
                for it in items:
                    try:
                        cleaned_items.append(json.loads(f'"{it}"'))
                    except ValueError:
                        cleaned_items.append(it)
                if cleaned_items:
                    recovered[key] = cleaned_items
        return recovered if recovered.get("summary") else None


def _coerce_string_list(value: Any, limit: int = 6) -> List[str]:
    if not isinstance(value, list):
        return []
    items: List[str] = []
    for entry in value:
        text = str(entry).strip()
        if text:
            items.append(text)
        if len(items) >= limit:
            break
    return items


class BaseEhsAgent(ABC):
    """Abstract base class for all Neon-grounded EHS logical specialist agents."""

    agent_key: str
    agent_name: str
    role: str
    data_sources: List[str]
    capabilities: List[str]
    limitations: List[str] = []
    system_rules: str

    def metadata(self) -> AgentMetadata:
        return AgentMetadata(
            agent_key=self.agent_key,
            agent_name=self.agent_name,
            role=self.role,
            data_sources=self.data_sources,
            capabilities=self.capabilities,
            limitations=self.limitations,
        )

    @abstractmethod
    def retrieve_data(
        self, tools: EhsNeonDataTools, plant_id: Optional[str] = None
    ) -> Tuple[Dict[str, Any], List[EvidenceItem], int]:
        """Execute controlled read-only database retrieval for this specialist."""

    @abstractmethod
    def build_fallback_summary(self, data: Dict[str, Any]) -> Tuple[str, List[str], List[str], List[str]]:
        """
        Deterministic fallback tuple (summary, key_findings, recommendations, suggested_questions)
        used ONLY if DomoGPT prose doesn't parse cleanly as JSON while LLM call succeeded.
        """

    def build_domogpt_prompt(
        self,
        user_question: str,
        plant_scope: str,
        verified_data: Dict[str, Any],
    ) -> str:
        limitations_block = "\n".join(f"- {item}" for item in self.limitations) or "- None beyond approved schema scope."
        compact_data = json.dumps(verified_data, indent=2, default=str)
        if len(compact_data) > 7500:
            compact_data = compact_data[:7500] + "\n... [truncated for token budget]"

        return (
            f"You are the '{self.agent_name}' inside the EHS Safety AI Platform.\n"
            f"Role: {self.role}\n\n"
            f"Domain Guardrails:\n{self.system_rules}\n\n"
            "STRICT INTEGRITY RULES:\n"
            "1. Use ONLY the verified database metrics and record IDs provided under VERIFIED_NEON_DATA.\n"
            "2. NEVER invent numbers, counts, percentages, dates, event IDs, permit IDs, plant codes, or employee IDs.\n"
            "3. Distinguish VERIFIED FACTS ('key_findings') from AI ADVISORY RECOMMENDATIONS ('recommendations').\n"
            "4. NEVER recommend or state automatic closure of CAPAs, automatic permit approval, or overriding physical safety controls; state human EHS officer verification is required.\n"
            f"5. Respect these verified dataset limitations:\n{limitations_block}\n\n"
            f"PLANT_SCOPE: {plant_scope}\n"
            f"USER_QUESTION: {user_question}\n\n"
            f"VERIFIED_NEON_DATA:\n{compact_data}\n\n"
            "Respond with COMPACT VALID JSON ONLY (no ```json markdown fences, keep response concise under 350 words):\n"
            "{\n"
            '  "summary": "2-3 concise sentences citing exact figures from VERIFIED_NEON_DATA",\n'
            '  "key_findings": ["Concise verified DB fact 1", "Concise verified DB fact 2", "Concise verified DB fact 3"],\n'
            '  "recommendations": ["Concise human-reviewed action 1", "Concise human-reviewed action 2"],\n'
            '  "suggested_questions": ["Follow-up question 1", "Follow-up question 2"]\n'
            "}"
        )

    async def run(
        self,
        *,
        db: Session,
        user_question: str,
        plant_id: Optional[str] = None,
        llm_service: DomoGPTService = domogpt_service,
        temperature: float = 0.15,
        max_tokens: int = 1600,
    ) -> SpecialistAgentOutput:
        started = time.perf_counter()
        normalized_plant = _normalize_plant_filter(plant_id)
        plant_scope = normalized_plant or "ALL"

        tools = EhsNeonDataTools(db)
        verified_data, evidence, records_examined = self.retrieve_data(tools, normalized_plant)

        prompt = self.build_domogpt_prompt(user_question, plant_scope, verified_data)
        domo_res = await llm_service.generate_text(
            prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        fallback_summary, fallback_findings, fallback_recs, fallback_suggestions = self.build_fallback_summary(verified_data)
        parsed = _extract_json_object(domo_res.output)

        if parsed:
            summary = str(parsed.get("summary") or "").strip() or domo_res.output.strip()
            key_findings = _coerce_string_list(parsed.get("key_findings")) or fallback_findings
            recommendations = _coerce_string_list(parsed.get("recommendations")) or fallback_recs
            suggested = _coerce_string_list(parsed.get("suggested_questions"), limit=3) or fallback_suggestions
        else:
            # DomoGPT returned readable prose directly without JSON wrapper
            summary = domo_res.output.strip() or fallback_summary
            key_findings = fallback_findings
            recommendations = fallback_recs
            suggested = fallback_suggestions

        token_schema = None
        if domo_res.token_usage:
            token_schema = TokenUsageSchema(
                input_tokens=domo_res.token_usage.input_tokens,
                output_tokens=domo_res.token_usage.output_tokens,
                total_tokens=domo_res.token_usage.total_tokens,
                reasoning_tokens=domo_res.token_usage.reasoning_tokens,
            )

        duration_ms = int((time.perf_counter() - started) * 1000)

        return SpecialistAgentOutput(
            agent_key=self.agent_key,
            agent_name=self.agent_name,
            plant_scope=plant_scope,
            summary=summary,
            key_findings=key_findings,
            supporting_evidence=evidence,
            recommendations=recommendations,
            data_sources=list(self.data_sources),
            limitations=list(self.limitations),
            suggested_questions=suggested,
            model_id=domo_res.model_id,
            session_id=domo_res.session_id,
            token_usage=token_schema,
            records_examined=records_examined,
            duration_ms=duration_ms,
            metrics_snapshot=verified_data,
        )
