"""
Agent 1: EHS Orchestrator Agent.

Workflow:
User Question -> Intent Identification -> Specialist Selection ->
Controlled Neon PostgreSQL Retrieval -> Evidence Validation ->
Shared DomoGPT Service Reasoning -> Structured Multi-Agent Synthesis.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.agents.base import _coerce_string_list, _extract_json_object
from app.agents.registry import ORCHESTRATOR_METADATA, SPECIALIST_AGENTS, get_specialist
from app.agents.tools import EhsNeonDataTools, _normalize_plant_filter
from app.schemas.ai_agent import (
    AIQueryResponse,
    AgentTraceStep,
    EvidenceItem,
    SpecialistAgentOutput,
    TokenUsageSchema,
)
from app.services.domogpt_service import DomoGPTService, domogpt_service


DOMAIN_PATTERNS: Dict[str, List[Tuple[str, int]]] = {
    "hazard_analysis": [
        (r"\bhazard", 4),
        (r"\brisk severity|\bcritical\b|\bhigh severity", 3),
        (r"\bhotspot|\barea\b|\bzone\b|\bsmt\b|\bwarehouse\b|\bpackaging\b|\bfinal[_ ]assembly\b", 2),
        (r"\bforklift|\bchemical|\bergonomic|\bfire\b|\belectrical|\besd\b|\bslip", 3),
    ],
    "incident_analysis": [
        (r"\bincident", 4),
        (r"\bfirst[_ ]aid\b|\bnear[_ ]miss\b|\baudit", 4),
        (r"\blti\b|\blost[_ ]time|\binjur", 3),
        (r"\bmonthly trend|\btrend", 2),
    ],
    "workforce_safety": [
        (r"\bworkforce|\battendance|\bemployee", 4),
        (r"\btraining|\bexpired|\bcompliance", 4),
        (r"\bovertime|\bactual hours|\bshift|\bfatigue|\babsent|\blate|\bskill", 3),
    ],
    "maintenance_safety": [
        (r"\bmaintenance|\bwork[_ ]order|\bmwo\b", 4),
        (r"\bp1\b|\bp2\b|\bp3\b|\bpriority\b", 3),
        (r"\bfailure[_ ]mode|\bmachine|\bdowntime|\btechnician|\bpreventive|\bcorrective maintenance", 4),
    ],
    "capa_monitoring": [
        (r"\bcapas?\b|\bcorrective actions?", 5),
        (r"\boverdue|\bdue[_ ]date|\bpending\b|\bbacklog|\bclosure|\baction_owner|\bopen vs closed", 4),
    ],
    "permit_compliance": [
        (r"\bpermits?\b|\bptw\b|\bloto\b|\blockout|\bisolation|\bpermit_exception", 5),
    ],
    "safety_intelligence": [
        (r"\bexecutive|\bmanagement summary|\bsafety brief|\breport|\bcomprehensive|\boverall\b|\ball areas|\benterprise status", 4),
    ],
}


def _infer_plant_from_question(question: str, explicit_plant_id: Optional[str]) -> Optional[str]:
    norm = _normalize_plant_filter(explicit_plant_id)
    if norm:
        return norm
    q = question.lower()
    has_ka = bool(re.search(r"\bin-ka-01\b|\bkarnataka\b", q))
    has_tn = bool(re.search(r"\bin-tn-01\b|\btamil\s*nadu\b", q))
    if has_ka and not has_tn:
        return "IN-KA-01"
    if has_tn and not has_ka:
        return "IN-TN-01"
    return None


def _sum_token_usage(usages: List[Optional[TokenUsageSchema]]) -> Optional[TokenUsageSchema]:
    valid = [u for u in usages if u is not None]
    if not valid:
        return None
    in_sum = sum(u.input_tokens or 0 for u in valid)
    out_sum = sum(u.output_tokens or 0 for u in valid)
    tot_sum = sum(u.total_tokens or ((u.input_tokens or 0) + (u.output_tokens or 0)) for u in valid)
    reason_vals = [u.reasoning_tokens for u in valid if u.reasoning_tokens is not None]
    return TokenUsageSchema(
        input_tokens=in_sum or None,
        output_tokens=out_sum or None,
        total_tokens=tot_sum or None,
        reasoning_tokens=sum(reason_vals) if reason_vals else None,
    )


class EhsOrchestratorAgent:
    """
    Central Orchestrator coordinating specialist routing, read-only DB retrieval,
    DomoGPT synthesis, trace logging, and human-in-the-loop safety guardrails.
    """

    def __init__(self, llm_service: DomoGPTService = domogpt_service) -> None:
        self.llm_service = llm_service

    def identify_intent(
        self, user_question: str, target_agent: Optional[str] = None
    ) -> Tuple[List[str], str]:
        if target_agent and target_agent != "orchestrator":
            if target_agent in SPECIALIST_AGENTS:
                return [target_agent], f"Explicit specialist selection: {SPECIALIST_AGENTS[target_agent].agent_name}."
            raise KeyError(f"Unsupported target_agent '{target_agent}'.")

        q = user_question.lower()
        scores: Dict[str, int] = {}
        for agent_key, patterns in DOMAIN_PATTERNS.items():
            score = 0
            for regex, weight in patterns:
                if re.search(regex, q):
                    score += weight
            if score > 0:
                scores[agent_key] = score

        if not scores:
            return (
                ["safety_intelligence"],
                "Broad operational safety question routed to Safety Intelligence and Reporting Agent across all 3 Neon tables.",
            )

        # If executive briefing requested and <=1 concrete domain matched, delegate to Safety Intelligence Agent
        if "safety_intelligence" in scores and len([k for k in scores if k != "safety_intelligence"]) <= 1:
            return (
                ["safety_intelligence"],
                "Executive reporting intent identified; delegated to Safety Intelligence and Reporting Agent.",
            )

        ranked = sorted(
            [(k, v) for k, v in scores.items() if k != "safety_intelligence"],
            key=lambda item: -item[1],
        )
        top_score = ranked[0][1]

        # Select all clear domain matches (score >= 4) up to 3 specialists for multi-domain queries
        selected = [k for k, v in ranked if v >= 4][:3]
        if not selected:
            selected = [ranked[0][0]]

        if "safety_intelligence" in scores and len(selected) >= 2:
            reason = f"Cross-domain safety briefing routed to {', '.join(SPECIALIST_AGENTS[k].agent_name for k in selected)} and synthesized via executive rules."
        elif len(selected) == 1:
            reason = f"Intent matched domain specialist: {SPECIALIST_AGENTS[selected[0]].agent_name}."
        else:
            reason = f"Multi-domain inquiry routed collaboratively across {len(selected)} specialists: {', '.join(SPECIALIST_AGENTS[k].agent_name for k in selected)}."

        return selected, reason

    async def _run_single_specialist(
        self,
        agent_key: str,
        *,
        db: Session,
        user_question: str,
        effective_plant: Optional[str],
        routing_reason: str,
    ) -> AIQueryResponse:
        specialist = get_specialist(agent_key)
        t0 = time.perf_counter()
        result = await specialist.run(
            db=db,
            user_question=user_question,
            plant_id=effective_plant,
            llm_service=self.llm_service,
        )
        route_ms = max(1, int((time.perf_counter() - t0) * 1000) - result.duration_ms)

        trace = [
            AgentTraceStep(
                step=1,
                agent_key=ORCHESTRATOR_METADATA.agent_key,
                agent_name=ORCHESTRATOR_METADATA.agent_name,
                tool_name="intent_router",
                status="completed",
                duration_ms=max(1, route_ms),
                records_examined=0,
                summary=routing_reason,
            ),
            AgentTraceStep(
                step=2,
                agent_key=specialist.agent_key,
                agent_name=specialist.agent_name,
                tool_name=f"neon_query + domogpt({result.model_id or 'domogpt'})",
                status="completed",
                duration_ms=result.duration_ms,
                records_examined=result.records_examined,
                summary=(
                    f"Retrieved verified rows from {', '.join(result.data_sources)} "
                    f"and generated structured analysis."
                ),
            ),
        ]

        return AIQueryResponse(
            success=True,
            agent_key=specialist.agent_key,
            agent_name=specialist.agent_name,
            user_question=user_question,
            plant_scope=result.plant_scope,
            routing_reason=routing_reason,
            specialist_agents_invoked=[specialist.agent_name],
            summary=result.summary,
            key_findings=result.key_findings,
            supporting_evidence=result.supporting_evidence,
            recommendations=result.recommendations,
            data_sources=result.data_sources,
            limitations=result.limitations,
            human_review_required=True,
            model_id=result.model_id,
            session_id=result.session_id,
            token_usage=result.token_usage,
            execution_trace=trace,
            suggested_questions=result.suggested_questions,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    async def _run_multi_specialist(
        self,
        agent_keys: List[str],
        *,
        db: Session,
        user_question: str,
        effective_plant: Optional[str],
        routing_reason: str,
    ) -> AIQueryResponse:
        plant_scope = _normalize_plant_filter(effective_plant) or "ALL"
        tools = EhsNeonDataTools(db)
        trace: List[AgentTraceStep] = [
            AgentTraceStep(
                step=1,
                agent_key=ORCHESTRATOR_METADATA.agent_key,
                agent_name=ORCHESTRATOR_METADATA.agent_name,
                tool_name="multi_agent_planner",
                status="completed",
                duration_ms=2,
                records_examined=0,
                summary=routing_reason,
            )
        ]

        # Step A: Retrieve all required datasets synchronously on single SQLAlchemy Session (thread-safe)
        prepared: List[Tuple[str, Dict[str, Any], List[EvidenceItem], int]] = []
        for key in agent_keys:
            spec = get_specialist(key)
            data, evidence, examined = spec.retrieve_data(tools, effective_plant)
            prepared.append((key, data, evidence, examined))

        # Step B: Invoke shared DomoGPTService concurrently per specialist
        async def _call_specialist_llm(
            key: str, data: Dict[str, Any], evidence: List[EvidenceItem], examined: int
        ) -> SpecialistAgentOutput:
            spec = get_specialist(key)
            started = time.perf_counter()
            prompt = spec.build_domogpt_prompt(user_question, plant_scope, data)
            domo_res = await self.llm_service.generate_text(prompt, temperature=0.15, max_tokens=1400)
            fb_summary, fb_findings, fb_recs, fb_sug = spec.build_fallback_summary(data)
            parsed = _extract_json_object(domo_res.output)
            tok = (
                TokenUsageSchema(
                    input_tokens=domo_res.token_usage.input_tokens,
                    output_tokens=domo_res.token_usage.output_tokens,
                    total_tokens=domo_res.token_usage.total_tokens,
                    reasoning_tokens=domo_res.token_usage.reasoning_tokens,
                )
                if domo_res.token_usage
                else None
            )
            return SpecialistAgentOutput(
                agent_key=spec.agent_key,
                agent_name=spec.agent_name,
                plant_scope=plant_scope,
                summary=(str(parsed.get("summary") or "").strip() if parsed else domo_res.output.strip()) or fb_summary,
                key_findings=_coerce_string_list(parsed.get("key_findings")) if parsed else fb_findings,
                supporting_evidence=evidence,
                recommendations=_coerce_string_list(parsed.get("recommendations")) if parsed else fb_recs,
                data_sources=list(spec.data_sources),
                limitations=list(spec.limitations),
                suggested_questions=_coerce_string_list(parsed.get("suggested_questions"), limit=2) if parsed else fb_sug,
                model_id=domo_res.model_id,
                session_id=domo_res.session_id,
                token_usage=tok,
                records_examined=examined,
                duration_ms=int((time.perf_counter() - started) * 1000),
                metrics_snapshot=data,
            )

        specialist_outputs = await asyncio.gather(
            *[_call_specialist_llm(k, d, ev, ex) for k, d, ev, ex in prepared]
        )

        # Add specialist steps to execution trace
        for idx, out in enumerate(specialist_outputs, start=2):
            trace.append(
                AgentTraceStep(
                    step=idx,
                    agent_key=out.agent_key,
                    agent_name=out.agent_name,
                    tool_name=f"neon_query + domogpt({out.model_id or 'domogpt'})",
                    status="completed",
                    duration_ms=out.duration_ms,
                    records_examined=out.records_examined,
                    summary=f"Analyzed {', '.join(out.data_sources)} ({out.records_examined:,} rows).",
                )
            )

        # Step C: Combined synthesis via DomoGPT acting as Safety Intelligence / Orchestrator combiner
        synth_start = time.perf_counter()
        specialist_digest = [
            {
                "agent": out.agent_name,
                "summary": out.summary,
                "key_findings": out.key_findings,
                "recommendations": out.recommendations,
            }
            for out in specialist_outputs
        ]
        synth_prompt = (
            "You are the EHS Orchestrator Agent combining verified specialist outputs into one executive answer.\n"
            f"USER_QUESTION: {user_question}\nPLANT_SCOPE: {plant_scope}\n\n"
            "SPECIALIST_FINDINGS (already verified against Neon PostgreSQL):\n"
            f"{json.dumps(specialist_digest, indent=2)}\n\n"
            "Rules:\n"
            "- Synthesize ONLY metrics and facts already present in SPECIALIST_FINDINGS.\n"
            "- Clearly separate factual findings from human-reviewed advisory recommendations.\n"
            "- NEVER authorize auto-closure of CAPAs, auto-approval of permits, or fatigue conclusions.\n"
            "Return COMPACT VALID JSON ONLY (no ```json markdown fences):\n"
            '{\n  "summary": "Cohesive multi-domain executive summary",\n'
            '  "key_findings": ["Combined finding 1", "Combined finding 2", "Combined finding 3", "Combined finding 4"],\n'
            '  "recommendations": ["Prioritized human-reviewed action 1", "Prioritized human-reviewed action 2", "Prioritized human-reviewed action 3"]\n}'
        )
        synth_res = await self.llm_service.generate_text(synth_prompt, temperature=0.15, max_tokens=1400)
        synth_parsed = _extract_json_object(synth_res.output)
        synth_ms = int((time.perf_counter() - synth_start) * 1000)

        merged_findings: List[str] = []
        merged_recs: List[str] = []
        merged_evidence: List[EvidenceItem] = []
        merged_sources: List[str] = []
        merged_limits: List[str] = []
        merged_suggestions: List[str] = []
        seen_ev_ids = set()

        for out in specialist_outputs:
            merged_findings.extend(out.key_findings[:2])
            merged_recs.extend(out.recommendations[:2])
            for ev in out.supporting_evidence:
                if ev.id not in seen_ev_ids:
                    merged_evidence.append(ev)
                    seen_ev_ids.add(ev.id)
            for ds in out.data_sources:
                if ds not in merged_sources:
                    merged_sources.append(ds)
            for lim in out.limitations:
                if lim not in merged_limits:
                    merged_limits.append(lim)
            for sq in out.suggested_questions:
                if sq not in merged_suggestions and len(merged_suggestions) < 3:
                    merged_suggestions.append(sq)

        final_summary = (
            str(synth_parsed.get("summary") or "").strip()
            if synth_parsed
            else " ".join(out.summary for out in specialist_outputs)
        ) or synth_res.output.strip()
        final_findings = (_coerce_string_list(synth_parsed.get("key_findings"), limit=6) if synth_parsed else None) or merged_findings[:6]
        final_recs = (_coerce_string_list(synth_parsed.get("recommendations"), limit=5) if synth_parsed else None) or merged_recs[:5]

        trace.append(
            AgentTraceStep(
                step=len(trace) + 1,
                agent_key=ORCHESTRATOR_METADATA.agent_key,
                agent_name=ORCHESTRATOR_METADATA.agent_name,
                tool_name=f"domogpt_synthesis({synth_res.model_id})",
                status="completed",
                duration_ms=synth_ms,
                records_examined=sum(o.records_examined for o in specialist_outputs),
                summary=f"Combined outputs from {len(specialist_outputs)} specialists with full evidence lineage.",
            )
        )

        synth_tok = (
            TokenUsageSchema(
                input_tokens=synth_res.token_usage.input_tokens,
                output_tokens=synth_res.token_usage.output_tokens,
                total_tokens=synth_res.token_usage.total_tokens,
                reasoning_tokens=synth_res.token_usage.reasoning_tokens,
            )
            if synth_res.token_usage
            else None
        )
        total_tok = _sum_token_usage([*(o.token_usage for o in specialist_outputs), synth_tok])

        return AIQueryResponse(
            success=True,
            agent_key=ORCHESTRATOR_METADATA.agent_key,
            agent_name=ORCHESTRATOR_METADATA.agent_name,
            user_question=user_question,
            plant_scope=plant_scope,
            routing_reason=routing_reason,
            specialist_agents_invoked=[o.agent_name for o in specialist_outputs],
            summary=final_summary,
            key_findings=final_findings,
            supporting_evidence=merged_evidence[:8],
            recommendations=final_recs,
            data_sources=merged_sources,
            limitations=merged_limits,
            human_review_required=True,
            model_id=synth_res.model_id,
            session_id=synth_res.session_id,
            token_usage=total_tok,
            execution_trace=trace,
            suggested_questions=merged_suggestions,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    async def handle_query(
        self,
        *,
        db: Session,
        user_question: str,
        plant_id: Optional[str] = None,
        target_agent: Optional[str] = None,
    ) -> AIQueryResponse:
        effective_plant = _infer_plant_from_question(user_question, plant_id)
        agent_keys, routing_reason = self.identify_intent(user_question, target_agent=target_agent)

        if len(agent_keys) == 1:
            return await self._run_single_specialist(
                agent_keys[0],
                db=db,
                user_question=user_question,
                effective_plant=effective_plant,
                routing_reason=routing_reason,
            )

        return await self._run_multi_specialist(
            agent_keys,
            db=db,
            user_question=user_question,
            effective_plant=effective_plant,
            routing_reason=routing_reason,
        )


ehs_orchestrator = EhsOrchestratorAgent()
