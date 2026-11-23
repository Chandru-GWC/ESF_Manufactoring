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

from app.agents import ehs_agent
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ACTOR, plant_filter
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

router = APIRouter(prefix="/ai", tags=["EHS Safety Agent & DomoGPT"])


@router.get("/agents", response_model=List[AgentMetadata])
def list_agents():
    """Return metadata of the EHS Safety Agent (the platform has a single agent)."""
    return [ehs_agent.metadata()]


@router.get("/health", response_model=DomoConnectivityResult)
async def ai_health(
    probe: bool = Query(False, description="When true, bypasses the short result cache and probes DomoGPT again"),
):
    """Inspect DomoGPT status. `connected` reflects a real upstream probe (cached ~120s); probe=true forces a fresh one."""
    return await domogpt_service.get_cached_connectivity(force=probe)


@router.post("/query", response_model=AIQueryResponse)
async def query_ai_assistant(
    payload: AIQueryRequest,
    db: Session = Depends(get_db),
):
    """
    Execute an EHS safety inquiry with the EHS Safety Agent: DomoGPT decides which of the two
    read-only tools (inspect_schema, run_query) to call over the approved ehs_core tables, then answers.
    """
    plant_id = plant_filter(payload.plant_id)
    try:
        return await ehs_agent.handle_query(
            db=db,
            user_question=payload.prompt,
            plant_id=plant_id,
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

