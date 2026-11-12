import asyncio
import json
import os
from typing import Any, Awaitable, Callable, Dict, Optional

from app.services.video.config import INFERENCE_TIMEOUT_SECONDS, OPENFALL_PYTHON


class VideoWorkerError(RuntimeError):
    """Raised when an isolated CV inference worker fails or returns invalid output."""


async def run_isolated_cv_worker(
    worker_script: str,
    args: list[str],
    cwd: str,
    timeout_sec: int = INFERENCE_TIMEOUT_SECONDS,
    on_progress: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
) -> Dict[str, Any]:
    """
    Execute a CV worker in the OpenFall Python 3.12 environment without blocking FastAPI.
    Streams real PROGRESS lines incrementally and parses the final structured JSON result.
    """
    if not os.path.exists(OPENFALL_PYTHON):
        raise VideoWorkerError("Configured OpenFall Python runtime was not found on disk.")
    if not os.path.exists(worker_script):
        raise VideoWorkerError(f"CV worker script missing: {os.path.basename(worker_script)}")

    proc = await asyncio.create_subprocess_exec(
        OPENFALL_PYTHON,
        "-u",
        worker_script,
        *args,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout_lines: list[str] = []

    async def _read_stdout():
        assert proc.stdout is not None
        while True:
            raw = await proc.stdout.readline()
            if not raw:
                break
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            stdout_lines.append(line)
            if line.startswith("PROGRESS ") and on_progress is not None:
                try:
                    payload = json.loads(line[len("PROGRESS "):].strip())
                    await on_progress(payload)
                except Exception:
                    pass

    async def _read_stderr() -> str:
        assert proc.stderr is not None
        data = await proc.stderr.read()
        return data.decode("utf-8", errors="replace").strip()

    try:
        _, stderr_text, _ = await asyncio.wait_for(
            asyncio.gather(_read_stdout(), _read_stderr(), proc.wait()),
            timeout=timeout_sec,
        )
    except asyncio.TimeoutError as exc:
        proc.kill()
        await proc.wait()
        raise VideoWorkerError(f"Video analysis timed out after {timeout_sec}s.") from exc

    if proc.returncode != 0:
        detail = stderr_text.splitlines()[-1] if stderr_text else f"exit code {proc.returncode}"
        raise VideoWorkerError(f"Video worker failed: {detail}")

    for line in reversed(stdout_lines):
        if line.startswith("{") and line.endswith("}"):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue

    raise VideoWorkerError("Video worker exited cleanly without structured JSON output.")
