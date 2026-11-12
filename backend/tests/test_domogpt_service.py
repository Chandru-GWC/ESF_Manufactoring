import asyncio
import json
import httpx
import pytest

from app.core.config import Settings
from app.services.domogpt_service import (
    DomoAuthenticationError,
    DomoConfigurationError,
    DomoForbiddenError,
    DomoGPTService,
    DomoInvalidResponseError,
    DomoModelUnavailableError,
    DomoRateLimitError,
    DomoServerError,
    DomoTimeoutError,
)


def _make_settings(**overrides) -> Settings:
    defaults = {
        "DATABASE_URL": "sqlite:///./test_unused.db",
        "DOMO_BASE_URL": "https://gwcteq-partner.domo.com",
        "DOMO_AI_ENDPOINT": "/api/ai/v1/text/generation",
        "DOMO_AI_MODEL": "domo.domo_ai.domogpt-large-v2.2:anthropic",
        "DOMO_DEVELOPER_TOKEN": "DDCI_fake_unit_test_secret_value_12345",
        "DOMO_TIMEOUT_SECONDS": 15.0,
        "DOMO_MAX_RETRIES": 0,
    }
    defaults.update(overrides)
    return Settings(**defaults)


def test_domogpt_missing_or_placeholder_token_rejected():
    svc = DomoGPTService(config=_make_settings(DOMO_DEVELOPER_TOKEN="your_domo_developer_token_here"))
    with pytest.raises(DomoConfigurationError):
        asyncio.run(svc.generate_text("Test prompt"))


def test_domogpt_success_payload_headers_and_token_usage():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(
            200,
            json={
                "output": "Critical and electrical hazards require immediate supervisor verification.",
                "modelId": "domo.domo_ai.domogpt-large-v2.2:anthropic",
                "sessionId": "sess-1234",
                "modelProviderUsage": {"inputTokens": 42, "outputTokens": 18, "totalTokens": 60, "reasoningTokens": None},
            },
        )

    transport = httpx.MockTransport(handler)

    async def _run():
        async with httpx.AsyncClient(transport=transport) as client:
            svc = DomoGPTService(config=_make_settings(), http_client=client)
            return await svc.generate_text("Analyze workplace safety information", temperature=0.2, max_tokens=500)

    res = asyncio.run(_run())
    assert captured["method"] == "POST"
    assert captured["url"] == "https://gwcteq-partner.domo.com/api/ai/v1/text/generation"
    assert captured["headers"].get("x-domo-developer-token") == "DDCI_fake_unit_test_secret_value_12345"
    assert captured["body"] == {
        "input": "Analyze workplace safety information",
        "model": "domo.domo_ai.domogpt-large-v2.2:anthropic",
        "temperature": 0.2,
        "maxTokens": 500,
    }
    assert res.output == "Critical and electrical hazards require immediate supervisor verification."
    assert res.model_id == "domo.domo_ai.domogpt-large-v2.2:anthropic"
    assert res.session_id == "sess-1234"
    assert res.token_usage is not None
    assert res.token_usage.total_tokens == 60


@pytest.mark.parametrize(
    "status_code,body,expected_exc",
    [
        (401, {"message": "Invalid token DDCI_fake_unit_test_secret_value_12345"}, DomoAuthenticationError),
        (403, {"message": "Forbidden"}, DomoForbiddenError),
        (404, {"message": "Model unavailable"}, DomoModelUnavailableError),
        (429, {"message": "Rate limit hit"}, DomoRateLimitError),
        (500, {"message": "Upstream error"}, DomoServerError),
    ],
)
def test_domogpt_http_errors_redacted(status_code, body, expected_exc):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json=body)

    async def _run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            svc = DomoGPTService(config=_make_settings(), http_client=client)
            await svc.generate_text("Check risk")

    with pytest.raises(expected_exc) as exc_info:
        asyncio.run(_run())

    # Developer token must never appear in exception strings
    assert "DDCI_fake_unit_test_secret_value_12345" not in str(exc_info.value)


def test_domogpt_invalid_or_empty_output_rejected():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"output": "   ", "modelId": "domo.domo_ai.domogpt-large-v2.2:anthropic"})

    async def _run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            svc = DomoGPTService(config=_make_settings(), http_client=client)
            await svc.generate_text("Check output validation")

    with pytest.raises(DomoInvalidResponseError):
        asyncio.run(_run())


def test_domogpt_timeout_handled():
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Timed out")

    async def _run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            svc = DomoGPTService(config=_make_settings(), http_client=client)
            await svc.generate_text("Check timeout")

    with pytest.raises(DomoTimeoutError):
        asyncio.run(_run())
