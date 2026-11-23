"""The CV worker launcher must work with every asyncio event loop, including the selector loop that
`uvicorn --reload` uses on Windows (asyncio's own subprocess support raises NotImplementedError there)."""
import asyncio
import json
import sys

import pytest

from app.detection.runner import VideoWorkerError, run_isolated_cv_worker

WORKER = """
import json, sys
print('PROGRESS ' + json.dumps({'progress_pct': 40, 'stage': 'half way'}), flush=True)
print('PROGRESS ' + json.dumps({'progress_pct': 90, 'stage': 'almost'}), flush=True)
print(json.dumps({'event_detected': False, 'echo': sys.argv[1:]}))
"""


def _policies():
    if sys.platform == "win32":
        return [asyncio.WindowsSelectorEventLoopPolicy(), asyncio.WindowsProactorEventLoopPolicy()]
    return [asyncio.DefaultEventLoopPolicy()]


@pytest.mark.parametrize("policy", _policies(), ids=lambda p: type(p).__name__)
def test_worker_runs_and_streams_progress_on_every_event_loop(tmp_path, policy):
    script = tmp_path / "worker.py"
    script.write_text(WORKER)
    seen = []

    async def on_progress(p):
        seen.append(p["progress_pct"])

    async def go():
        return await run_isolated_cv_worker(str(script), ["a", "b"], str(tmp_path), on_progress=on_progress)

    asyncio.set_event_loop_policy(policy)
    try:
        result = asyncio.run(go())
    finally:
        asyncio.set_event_loop_policy(None)
    assert result == {"event_detected": False, "echo": ["a", "b"]}
    assert seen == [40, 90]


def test_worker_failure_reports_the_real_error_and_timeouts(tmp_path):
    bad = tmp_path / "bad.py"
    bad.write_text("import sys\nsys.exit('boom: model file missing')\n")
    with pytest.raises(VideoWorkerError, match="boom: model file missing"):
        asyncio.run(run_isolated_cv_worker(str(bad), [], str(tmp_path)))

    slow = tmp_path / "slow.py"
    slow.write_text("import time\ntime.sleep(30)\n")
    with pytest.raises(VideoWorkerError, match="timed out"):
        asyncio.run(run_isolated_cv_worker(str(slow), [], str(tmp_path), timeout_sec=1))

    empty = tmp_path / "empty.py"
    empty.write_text("print('no json here')\n")
    with pytest.raises(VideoWorkerError, match="without structured JSON"):
        asyncio.run(run_isolated_cv_worker(str(empty), [], str(tmp_path)))
