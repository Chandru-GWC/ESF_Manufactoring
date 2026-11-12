"""
FastAPI AI Assistant & Multi-Agent Orchestration Routes.

Exposes the centralized /api/v1/ai/query endpoint expected by the React frontend,
alongside agent metadata and DomoGPT connectivity inspection without exposing credentials.
"""
from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.agents.orchestrator import ehs_orchestrator
from app.agents.registry import list_all_agents_metadata
from app.core.config import settings
from app.core.database import get_db
from app.schemas.ai_agent import AIQueryRequest, AIQueryResponse, AgentMetadata
from app.services.domogpt_service import (
    DomoAuthenticationError,
    DomoConfigurationError,
    DomoConnectivityResult,
    DomoForbiddenError,
    DomoGPTError,
    DomoModelUnavailableError,
    DomoRateLimitError,
    DomoTimeoutError,
    domogpt_service,
)

logger = logging.getLogger("ehs.ai.routes")

router = APIRouter(prefix="/ai", tags=["EHS Multi-Agent AI & DomoGPT"])


@router.get("/agents", response_model=List[AgentMetadata])
def list_agents():
    """Return registry metadata for the EHS Orchestrator and 7 logical specialist agents."""
    return list_all_agents_metadata()


@router.get("/health", response_model=DomoConnectivityResult)
async def ai_health(
    probe: bool = Query(False, description="When true, executes a live DomoGPT text generation ping"),
):
    """Inspect DomoGPT integration status safely without leaking credentials."""
    if not probe:
        return DomoConnectivityResult(
            configured=settings.is_domo_configured,
            connected=settings.is_domo_configured,
            endpoint=settings.domo_generation_url,
            configured_model=settings.DOMO_AI_MODEL,
            message=(
                "DomoGPT developer token configured in backend/.env. Pass ?probe=true to verify live upstream response."
                if settings.is_domo_configured
                else "DOMO_DEVELOPER_TOKEN is missing or set to placeholder in backend/.env."
            ),
        )
    return await domogpt_service.check_connectivity()


@router.post("/query", response_model=AIQueryResponse)
async def query_ai_assistant(
    payload: AIQueryRequest,
    db: Session = Depends(get_db),
):
    """
    Execute an EHS safety inquiry via EHS Orchestrator -> Specialist Agent(s) ->
    Read-only Neon PostgreSQL retrieval -> Shared DomoGPT synthesis.
    """
    try:
        return await ehs_orchestrator.handle_query(
            db=db,
            user_question=payload.prompt,
            plant_id=payload.plant_id,
            target_agent=payload.target_agent,
        )
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DomoConfigurationError as exc:
        raise HTTPException(status_code=503, detail={"error_code": exc.error_code, "message": exc.message}) from exc
    except (DomoAuthenticationError, DomoForbiddenError) as exc:
        raise HTTPException(status_code=502, detail={"error_code": exc.error_code, "message": exc.message}) from exc
    except DomoModelUnavailableError as exc:
        raise HTTPException(status_code=502, detail={"error_code": exc.error_code, "message": exc.message}) from exc
    except DomoRateLimitError as exc:
        raise HTTPException(status_code=429, detail={"error_code": exc.error_code, "message": exc.message}) from exc
    except DomoTimeoutError as exc:
        raise HTTPException(status_code=504, detail={"error_code": exc.error_code, "message": exc.message}) from exc
    except DomoGPTError as exc:
        raise HTTPException(status_code=502, detail={"error_code": exc.error_code, "message": exc.message}) from exc
    except Exception as exc:
        logger.exception("Unexpected error during EHS multi-agent query")
        raise HTTPException(
            status_code=500,
            detail={"error_code": "AGENT_EXECUTION_ERROR", "message": "Unable to complete safety analysis request."},
        ) from exc

