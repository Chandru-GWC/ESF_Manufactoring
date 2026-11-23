"""Offline tests for the cached DomoGPT health probe (stubbed upstream, no network)."""
import asyncio

from app.core.config import Settings
from app.services.domogpt_service import DomoConnectivityResult, DomoGPTService

def _service(**kw):
    s = Settings(DATABASE_URL="sqlite:///./unused.db", DOMO_DEVELOPER_TOKEN=kw.get("token", "real-looking-token"))
    svc = DomoGPTService(config=s)
    svc.calls = 0

    async def fake_probe():
        svc.calls += 1
        await asyncio.sleep(0.02)
        ok = svc.outcome
        return DomoConnectivityResult(
            configured=True, connected=ok, endpoint="e", configured_model="m",
            error_code=None if ok else "DOMO_AUTH_ERROR", message="ok" if ok else "rejected",
        )

    svc.outcome = True
    svc.check_connectivity = fake_probe  # type: ignore[method-assign]
    return svc


def test_health_probe_is_cached_and_coalesced_under_concurrency():
    async def run():
        svc = _service()
        results = await asyncio.gather(*[svc.get_cached_connectivity() for _ in range(8)])
        assert svc.calls == 1 and all(r.connected for r in results)
        await svc.get_cached_connectivity()
        assert svc.calls == 1  # still inside TTL
        await svc.get_cached_connectivity(force=True)
        assert svc.calls == 2  # probe=true bypasses the cache

    asyncio.run(run())


def test_health_reports_real_failure_not_token_presence_and_rechecks_sooner():
    async def run():
        svc = _service()
        svc.outcome = False
        first = await svc.get_cached_connectivity()
        assert first.configured is True and first.connected is False and first.error_code == "DOMO_AUTH_ERROR"
        # failures use a shorter TTL: age the cache past it and confirm a fresh probe happens
        result, stamp = svc.__dict__["_health_cache"]
        svc.__dict__["_health_cache"] = (result, stamp - (svc.HEALTH_TTL_FAIL_SECONDS + 1))
        svc.outcome = True
        again = await svc.get_cached_connectivity()
        assert svc.calls == 2 and again.connected is True

    asyncio.run(run())


def test_health_unconfigured_never_touches_upstream_probe_cache():
    async def run():
        svc = DomoGPTService(config=Settings(DATABASE_URL="sqlite:///./unused.db", DOMO_DEVELOPER_TOKEN=""))
        res = await svc.get_cached_connectivity()
        assert res.configured is False and res.connected is False and res.error_code == "DOMO_CONFIG_ERROR"
        assert "_health_cache" not in svc.__dict__

    asyncio.run(run())
