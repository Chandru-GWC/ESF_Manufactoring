import asyncio
import json
import httpx
from fastapi.testclient import TestClient

from app.agents.base import _extract_json_object
from app.agents.orchestrator import EhsOrchestratorAgent
from app.agents.registry import SPECIALIST_AGENTS
from app.core.config import Settings, settings
from app.core.database import SessionLocal
from app.main import app
from app.services.domogpt_service import DomoGPTService


def _stub_domo_service(response_builder=None) -> DomoGPTService:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8"))
        prompt_text = body.get("input", "")
        if response_builder:
            payload = response_builder(prompt_text)
        else:
            payload = {
                "summary": "Verified operational analysis generated from Neon ehs_core telemetry.",
                "key_findings": [
                    "Verified database summary checked.",
                    "Evidence IDs preserved without synthetic additions.",
                ],
                "recommendations": [
                    "EHS officer manual review required prior to CAPA closure or permit clearance.",
                ],
                "suggested_questions": [
                    "Break down results by plant",
                ],
            }
        return httpx.Response(
            200,
            json={
                "output": json.dumps(payload),
                "modelId": settings.DOMO_AI_MODEL,
                "sessionId": "test-session-001",
                "modelProviderUsage": {"inputTokens": 120, "outputTokens": 45, "totalTokens": 165},
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    cfg = Settings(
        DATABASE_URL=settings.DATABASE_URL,
        DOMO_BASE_URL=settings.DOMO_BASE_URL,
        DOMO_AI_ENDPOINT=settings.DOMO_AI_ENDPOINT,
        DOMO_AI_MODEL=settings.DOMO_AI_MODEL,
        DOMO_DEVELOPER_TOKEN="DDCI_unit_test_dummy_token_value",
        DOMO_MAX_RETRIES=0,
    )
    return DomoGPTService(config=cfg, http_client=client)


def test_all_seven_specialists_grounded_in_neon():
    prompts = {
        "hazard_analysis": "Summarize workplace hazards and CRITICAL hotspots.",
        "incident_analysis": "Analyze first aid, near misses, and audit findings.",
        "workforce_safety": "Check workforce attendance, expired training, and overtime.",
        "maintenance_safety": "Summarize P1 maintenance work orders and failure modes.",
        "capa_monitoring": "Identify overdue CAPA actions requiring follow-up.",
        "permit_compliance": "Analyze permit exceptions and LOTO compliance boundaries.",
        "safety_intelligence": "Provide an executive enterprise safety summary report.",
    }

    db = SessionLocal()
    try:
        async def _run_all():
            svc = _stub_domo_service()
            results = {}
            for key, prompt in prompts.items():
                agent = SPECIALIST_AGENTS[key]
                res = await agent.run(db=db, user_question=prompt, llm_service=svc)
                results[key] = res
            return results

        results = asyncio.run(_run_all())

        # Verify exact Neon counts from ehs_core
        assert results["hazard_analysis"].metrics_snapshot["total_events"] == 400
        assert results["hazard_analysis"].metrics_snapshot["hazard_observation_count"] == 84

        inc = results["incident_analysis"].metrics_snapshot
        assert inc["lost_time_injury_true_count"] == 0
        assert inc["by_event_type"]["FIRST_AID"] == 88
        assert inc["by_event_type"]["NEAR_MISS"] == 63
        assert inc["by_event_type"]["AUDIT_FINDING"] == 86

        wf = results["workforce_safety"].metrics_snapshot
        assert wf["total_attendance_records"] == 16560
        assert wf["training_expired_logs"] == 398
        assert any("fatigue" in lim.lower() for lim in results["workforce_safety"].limitations)

        mwo = results["maintenance_safety"].metrics_snapshot
        assert mwo["total_work_orders"] == 400
        assert mwo["p1_priority_total"] == 132
        assert any("permit_id" in lim for lim in results["maintenance_safety"].limitations)

        capa = results["capa_monitoring"].metrics_snapshot
        assert capa["total_capa_records"] == 400
        assert capa["open_count"] == 130
        assert capa["in_progress_count"] == 127
        assert capa["closed_count"] == 143
        assert capa["overdue_total_count"] > 0

        ptw = results["permit_compliance"].metrics_snapshot
        assert ptw["permit_exception_total"] == 79
        assert any("loto" in lim.lower() for lim in results["permit_compliance"].limitations)

        si = results["safety_intelligence"].records_examined
        assert si == 400 + 16560 + 400
    finally:
        db.close()


def test_orchestrator_single_and_multi_agent_routing():
    orch = EhsOrchestratorAgent(llm_service=_stub_domo_service())

    # Single specialist intents
    assert orch.identify_intent("How many expired training records in workforce?")[0] == ["workforce_safety"]
    assert orch.identify_intent("Check P1 maintenance failure modes")[0] == ["maintenance_safety"]
    assert orch.identify_intent("Show overdue CAPAs due date")[0] == ["capa_monitoring"]
    assert orch.identify_intent("Review permit exceptions and LOTO status")[0] == ["permit_compliance"]

    # Multi-domain collaborative query execution against real Neon DB
    db = SessionLocal()
    try:
        res = asyncio.run(
            orch.handle_query(
                db=db,
                user_question="Analyze overdue CAPAs, expired workforce training, and P1 maintenance work orders for IN-KA-01.",
            )
        )
        assert res.success is True
        assert res.plant_scope == "IN-KA-01"
        assert res.agent_key == "orchestrator"
        assert len(res.specialist_agents_invoked) >= 2
        assert res.human_review_required is True
        assert res.token_usage is not None
        assert res.token_usage.total_tokens >= 330
        assert len(res.execution_trace) >= 4
        assert len(res.supporting_evidence) >= 3
    finally:
        db.close()


def test_ai_routes_metadata_health_and_validation():
    client = TestClient(app)

    agents_res = client.get("/api/v1/ai/agents")
    assert agents_res.status_code == 200
    agents = agents_res.json()
    assert len(agents) == 8
    assert {a["agent_key"] for a in agents} == {
        "orchestrator",
        "hazard_analysis",
        "incident_analysis",
        "workforce_safety",
        "maintenance_safety",
        "capa_monitoring",
        "permit_compliance",
        "safety_intelligence",
    }

    health_res = client.get("/api/v1/ai/health")
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert health_data["configured"] is True
    assert settings.DOMO_DEVELOPER_TOKEN not in json.dumps(health_data)

    # Validation check: invalid plant_id rejected with 422
    bad_plant = client.post("/api/v1/ai/query", json={"prompt": "Summarize hazards", "plant_id": "INVALID"})
    assert bad_plant.status_code == 422

    # Validation check: empty prompt rejected with 422
    empty_prompt = client.post("/api/v1/ai/query", json={"prompt": ""})
    assert empty_prompt.status_code == 422


def test_truncated_fence_recovery_and_plural_capa_routing():
    truncated = '```json\n{\n  "summary": "257 CAPAs remain open.",\n  "key_findings": ["Open: 130", "In Progress: 127"],\n  "recommendations": ["Review critical overdue items."'
    parsed = _extract_json_object(truncated)
    assert parsed is not None
    assert parsed["summary"] == "257 CAPAs remain open."
    assert parsed["key_findings"] == ["Open: 130", "In Progress: 127"]

    orch = EhsOrchestratorAgent(llm_service=_stub_domo_service())
    routed, _ = orch.identify_intent("For IN-KA-01, analyze overdue CAPAs alongside expired workforce training records.")
    assert "workforce_safety" in routed
    assert "capa_monitoring" in routed

