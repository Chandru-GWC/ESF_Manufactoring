"""
Centralized Asynchronous DomoGPT Client Service.

Connects to the official Domo Text Generation API (/api/ai/v1/text/generation)
using a shared connection-pooled httpx.AsyncClient, strict credential hygiene,
bounded retries for transient faults, and validated structured outputs.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import httpx
from pydantic import BaseModel, Field

from app.core.config import Settings, settings

logger = logging.getLogger("ehs.domogpt")


class DomoGPTError(Exception):
    """Base exception for sanitized, secret-free DomoGPT failures."""

    def __init__(
        self,
        message: str,
        *,
        error_code: str = "DOMO_ERROR",
        status_code: Optional[int] = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.retryable = retryable


class DomoConfigurationError(DomoGPTError):
    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="DOMO_CONFIG_ERROR", status_code=None, retryable=False)


class DomoAuthenticationError(DomoGPTError):
    def __init__(self, message: str = "DomoGPT authentication failed (401 Unauthorized).") -> None:
        super().__init__(message, error_code="DOMO_AUTH_ERROR", status_code=401, retryable=False)


class DomoForbiddenError(DomoGPTError):
    def __init__(self, message: str = "DomoGPT access forbidden (403 Forbidden).") -> None:
        super().__init__(message, error_code="DOMO_FORBIDDEN", status_code=403, retryable=False)


class DomoModelUnavailableError(DomoGPTError):
    def __init__(self, message: str, status_code: int = 404) -> None:
        super().__init__(message, error_code="DOMO_MODEL_UNAVAILABLE", status_code=status_code, retryable=False)


class DomoRateLimitError(DomoGPTError):
    def __init__(self, message: str = "DomoGPT API rate limit exceeded (429).") -> None:
        super().__init__(message, error_code="DOMO_RATE_LIMIT", status_code=429, retryable=True)


class DomoServerError(DomoGPTError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message, error_code="DOMO_SERVER_ERROR", status_code=status_code, retryable=True)


class DomoTimeoutError(DomoGPTError):
    def __init__(self, message: str = "DomoGPT API request timed out.") -> None:
        super().__init__(message, error_code="DOMO_TIMEOUT", status_code=504, retryable=True)


class DomoNetworkError(DomoGPTError):
    def __init__(self, message: str = "Network communication error calling DomoGPT.") -> None:
        super().__init__(message, error_code="DOMO_NETWORK_ERROR", status_code=503, retryable=True)


class DomoInvalidResponseError(DomoGPTError):
    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="DOMO_INVALID_RESPONSE", status_code=502, retryable=False)


class DomoTokenUsage(BaseModel):
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    reasoning_tokens: Optional[int] = None
    raw: Optional[Dict[str, Any]] = None


class DomoGenerationResult(BaseModel):
    output: str
    model_id: str
    session_id: Optional[str] = None
    token_usage: Optional[DomoTokenUsage] = None
    latency_ms: int = Field(default=0, ge=0)


class DomoConnectivityResult(BaseModel):
    configured: bool
    connected: bool
    endpoint: str
    configured_model: str
    returned_model_id: Optional[str] = None
    session_id: Optional[str] = None
    token_usage: Optional[DomoTokenUsage] = None
    latency_ms: int = 0
    error_code: Optional[str] = None
    message: str


def _redact_secret(text: str, secret: str) -> str:
    if not text:
        return ""
    sanitized = text
    if secret:
        sanitized = sanitized.replace(secret, "[REDACTED]")
    return sanitized


def _extract_token_usage(payload: Dict[str, Any]) -> Optional[DomoTokenUsage]:
    """Extract normalized token usage metrics when provided by Domo AI responses."""
    raw_usage = (
        payload.get("modelProviderUsage")
        or payload.get("tokenUsage")
        or payload.get("usage")
        or payload.get("metrics")
    )
    if isinstance(raw_usage, dict):
        in_tok = raw_usage.get("inputTokens") or raw_usage.get("promptTokens") or raw_usage.get("input_tokens") or raw_usage.get("prompt_tokens")
        out_tok = raw_usage.get("outputTokens") or raw_usage.get("completionTokens") or raw_usage.get("output_tokens") or raw_usage.get("completion_tokens")
        tot_tok = raw_usage.get("totalTokens") or raw_usage.get("total_tokens")
        reason_tok = raw_usage.get("reasoningTokens") or raw_usage.get("reasoning_tokens")
        if tot_tok is None and isinstance(in_tok, (int, float)) and isinstance(out_tok, (int, float)):
            tot_tok = int(in_tok) + int(out_tok)
        return DomoTokenUsage(
            input_tokens=int(in_tok) if isinstance(in_tok, (int, float)) else None,
            output_tokens=int(out_tok) if isinstance(out_tok, (int, float)) else None,
            total_tokens=int(tot_tok) if isinstance(tot_tok, (int, float)) else None,
            reasoning_tokens=int(reason_tok) if isinstance(reason_tok, (int, float)) else None,
            raw=raw_usage,
        )

    # Top-level fallback keys if API returns flat token fields
    in_flat = payload.get("inputTokens") or payload.get("promptTokens")
    out_flat = payload.get("outputTokens") or payload.get("completionTokens")
    tot_flat = payload.get("totalTokens")
    if any(isinstance(v, (int, float)) for v in (in_flat, out_flat, tot_flat)):
        return DomoTokenUsage(
            input_tokens=int(in_flat) if isinstance(in_flat, (int, float)) else None,
            output_tokens=int(out_flat) if isinstance(out_flat, (int, float)) else None,
            total_tokens=int(tot_flat) if isinstance(tot_flat, (int, float)) else None,
        )
    return None


class DomoGPTService:
    """
    Centralized async client for Domo Text Generation API.
    Shared across the EHS Orchestrator and all specialist agents.
    """

    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

    def __init__(
        self,
        config: Settings = settings,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.config = config
        self._injected_client = http_client
        self._client: Optional[httpx.AsyncClient] = http_client
        self._client_loop: Optional[asyncio.AbstractEventLoop] = None

    def validate_configuration(self) -> None:
        if not (self.config.DOMO_BASE_URL or "").strip().startswith("http"):
            raise DomoConfigurationError("DOMO_BASE_URL is missing or invalid in backend environment.")
        if not (self.config.DOMO_AI_ENDPOINT or "").strip():
            raise DomoConfigurationError("DOMO_AI_ENDPOINT is missing in backend environment.")
        if not (self.config.DOMO_AI_MODEL or "").strip():
            raise DomoConfigurationError("DOMO_AI_MODEL is missing in backend environment.")
        if not self.config.is_domo_configured:
            raise DomoConfigurationError(
                "DOMO_DEVELOPER_TOKEN is not configured or still set to a placeholder value in backend/.env."
            )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._injected_client is not None:
            return self._injected_client

        current_loop = asyncio.get_running_loop()
        if (
            self._client is None
            or self._client.is_closed
            or self._client_loop is not current_loop
        ):
            if self._client is not None and not self._client.is_closed:
                try:
                    await self._client.aclose()
                except Exception:
                    pass
            read_timeout = max(5.0, float(self.config.DOMO_TIMEOUT_SECONDS or 45.0))
            timeout = httpx.Timeout(connect=10.0, read=read_timeout, write=15.0, pool=10.0)
            self._client = httpx.AsyncClient(
                timeout=timeout,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
            self._client_loop = current_loop
        return self._client

    async def aclose(self) -> None:
        if self._injected_client is not None:
            return
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        self._client = None
        self._client_loop = None

    def _safe_error_excerpt(self, response: httpx.Response) -> str:
        secret = (self.config.DOMO_DEVELOPER_TOKEN or "").strip()
        try:
            data = response.json()
            if isinstance(data, dict):
                detail = data.get("message") or data.get("error") or data.get("detail") or ""
                if isinstance(detail, dict):
                    detail = detail.get("message") or str(detail)
                if detail:
                    return _redact_secret(str(detail)[:240], secret)
        except Exception:
            pass
        return _redact_secret((response.text or "")[:200].strip(), secret)

    def _raise_for_http_error(self, response: httpx.Response) -> None:
        code = response.status_code
        excerpt = self._safe_error_excerpt(response)
        suffix = f" Details: {excerpt}" if excerpt else ""

        if code == 401:
            raise DomoAuthenticationError(
                f"DomoGPT rejected the developer token (HTTP 401 Unauthorized). Verify DOMO_DEVELOPER_TOKEN in backend/.env.{suffix}"
            )
        if code == 403:
            raise DomoForbiddenError(
                f"DomoGPT developer token lacks AI service permission (HTTP 403 Forbidden).{suffix}"
            )
        if code in (400, 404, 422):
            raise DomoModelUnavailableError(
                f"DomoGPT model or request rejected (HTTP {code}). Check DOMO_AI_MODEL and payload format.{suffix}",
                status_code=code,
            )
        if code == 429:
            raise DomoRateLimitError(f"DomoGPT rate limit exceeded (HTTP 429).{suffix}")
        if code >= 500:
            raise DomoServerError(f"DomoGPT upstream server error (HTTP {code}).{suffix}", status_code=code)
        raise DomoGPTError(f"Unexpected DomoGPT HTTP status {code}.{suffix}", status_code=code)

    def _parse_and_validate_response(self, response: httpx.Response, requested_model: str, latency_ms: int) -> DomoGenerationResult:
        try:
            payload = response.json()
        except ValueError as exc:
            raise DomoInvalidResponseError("DomoGPT returned a non-JSON response payload.") from exc

        if not isinstance(payload, dict):
            raise DomoInvalidResponseError("DomoGPT response JSON must be an object.")

        raw_output = payload.get("output")
        if not isinstance(raw_output, str) or not raw_output.strip():
            raise DomoInvalidResponseError(
                "DomoGPT response did not include a valid non-empty 'output' string."
            )

        model_id = payload.get("modelId") or payload.get("model") or requested_model
        session_id = payload.get("sessionId")
        token_usage = _extract_token_usage(payload)

        return DomoGenerationResult(
            output=raw_output.strip(),
            model_id=str(model_id),
            session_id=str(session_id) if session_id is not None else None,
            token_usage=token_usage,
            latency_ms=latency_ms,
        )

    async def generate_text(
        self,
        prompt: str,
        *,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1000,
    ) -> DomoGenerationResult:
        """
        Send an async text generation request to the Domo Text Generation API.
        """
        self.validate_configuration()

        cleaned_prompt = (prompt or "").strip()
        if not cleaned_prompt:
            raise DomoConfigurationError("Prompt input for DomoGPT cannot be empty.")

        target_model = (model or self.config.DOMO_AI_MODEL).strip()
        bounded_temp = max(0.0, min(1.0, float(temperature)))
        bounded_tokens = max(1, min(4096, int(max_tokens)))

        url = self.config.domo_generation_url
        token = (self.config.DOMO_DEVELOPER_TOKEN or "").strip()
        headers = {
            "X-DOMO-Developer-Token": token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        body = {
            "input": cleaned_prompt,
            "model": target_model,
            "temperature": bounded_temp,
            "maxTokens": bounded_tokens,
        }

        max_attempts = 1 + max(0, int(self.config.DOMO_MAX_RETRIES))
        client = await self._get_client()

        for attempt in range(1, max_attempts + 1):
            started = time.perf_counter()
            try:
                response = await client.post(url, headers=headers, json=body)
                latency_ms = int((time.perf_counter() - started) * 1000)

                if response.status_code == 200:
                    result = self._parse_and_validate_response(response, target_model, latency_ms)
                    logger.info(
                        "DomoGPT success endpoint=%s model=%s latency_ms=%d total_tokens=%s",
                        self.config.DOMO_AI_ENDPOINT,
                        result.model_id,
                        latency_ms,
                        result.token_usage.total_tokens if result.token_usage else "n/a",
                    )
                    return result

                if response.status_code in self.RETRYABLE_STATUS_CODES and attempt < max_attempts:
                    retry_after_hdr = response.headers.get("Retry-After")
                    delay = min(5.0, float(retry_after_hdr)) if retry_after_hdr and retry_after_hdr.isdigit() else 0.6 * attempt
                    logger.warning(
                        "DomoGPT transient HTTP %d on attempt %d/%d; retrying in %.1fs",
                        response.status_code,
                        attempt,
                        max_attempts,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    continue

                logger.error(
                    "DomoGPT HTTP error status=%d endpoint=%s model=%s latency_ms=%d",
                    response.status_code,
                    self.config.DOMO_AI_ENDPOINT,
                    target_model,
                    latency_ms,
                )
                self._raise_for_http_error(response)

            except httpx.TimeoutException as exc:
                latency_ms = int((time.perf_counter() - started) * 1000)
                if attempt < max_attempts:
                    logger.warning("DomoGPT timeout on attempt %d/%d; retrying", attempt, max_attempts)
                    await asyncio.sleep(0.5 * attempt)
                    continue
                logger.error("DomoGPT timeout after %d attempts (%dms)", attempt, latency_ms)
                raise DomoTimeoutError() from exc

            except httpx.RequestError as exc:
                latency_ms = int((time.perf_counter() - started) * 1000)
                if attempt < max_attempts:
                    logger.warning("DomoGPT network fault on attempt %d/%d; retrying", attempt, max_attempts)
                    await asyncio.sleep(0.5 * attempt)
                    continue
                safe_type = type(exc).__name__
                logger.error("DomoGPT network error (%s) after %d attempts", safe_type, attempt)
                raise DomoNetworkError(f"Unable to reach DomoGPT endpoint ({safe_type}).") from exc

        raise DomoServerError("DomoGPT failed after maximum retry attempts.")

    async def check_connectivity(self) -> DomoConnectivityResult:
        """
        Execute a lightweight health probe against Domo Text Generation API.
        Never raises or exposes secrets.
        """
        endpoint_display = self.config.domo_generation_url
        if not self.config.is_domo_configured:
            return DomoConnectivityResult(
                configured=False,
                connected=False,
                endpoint=endpoint_display,
                configured_model=self.config.DOMO_AI_MODEL,
                error_code="DOMO_CONFIG_ERROR",
                message="DOMO_DEVELOPER_TOKEN is missing or placeholder in backend/.env.",
            )

        try:
            res = await self.generate_text(
                "Reply briefly with OK to confirm EHS DomoGPT connectivity.",
                temperature=0.0,
                max_tokens=32,
            )
            return DomoConnectivityResult(
                configured=True,
                connected=True,
                endpoint=endpoint_display,
                configured_model=self.config.DOMO_AI_MODEL,
                returned_model_id=res.model_id,
                session_id=res.session_id,
                token_usage=res.token_usage,
                latency_ms=res.latency_ms,
                message="DomoGPT text generation endpoint connected and validated.",
            )
        except DomoGPTError as exc:
            return DomoConnectivityResult(
                configured=True,
                connected=False,
                endpoint=endpoint_display,
                configured_model=self.config.DOMO_AI_MODEL,
                error_code=exc.error_code,
                message=exc.message,
            )


# Shared module-level singleton reused by FastAPI routes, orchestrator, and specialist agents
domogpt_service = DomoGPTService()
