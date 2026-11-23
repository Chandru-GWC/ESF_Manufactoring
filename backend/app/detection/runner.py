import asyncio
import json
import os
import subprocess
import sys
import threading
from typing import Any, Awaitable, Callable, Dict, List, Optional

from app.detection.config import INFERENCE_TIMEOUT_SECONDS, OPENFALL_PYTHON


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
    Execute a CV worker in the CV runtime (the backend's uv environment) without blocking FastAPI.
    Streams real PROGRESS lines incrementally and parses the final structured JSON result.

    The worker is started with a plain subprocess inside a thread instead of asyncio's subprocess support:
    on Windows, `uvicorn --reload` runs a selector event loop that cannot start subprocesses
    (create_subprocess_exec raises NotImplementedError), so this works with every event loop.
    """
    if not os.path.exists(OPENFALL_PYTHON):
        raise VideoWorkerError("The CV Python runtime was not found on disk.")
    if not os.path.exists(worker_script):
        raise VideoWorkerError(f"CV worker script missing: {os.path.basename(worker_script)}")

    loop = asyncio.get_running_loop()
    timed_out = threading.Event()

    def _run() -> Dict[str, Any]:
        popen_kwargs: Dict[str, Any] = {}
        if sys.platform == "win32":
            popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
        proc = subprocess.Popen(
            [OPENFALL_PYTHON, "-u", worker_script, *args],
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            **popen_kwargs,
        )

        stderr_data: List[bytes] = []

        def _drain_stderr() -> None:
            assert proc.stderr is not None
            stderr_data.append(proc.stderr.read())

        stderr_thread = threading.Thread(target=_drain_stderr, daemon=True)
        stderr_thread.start()

        def _on_timeout() -> None:
            timed_out.set()
            proc.kill()

        watchdog = threading.Timer(timeout_sec, _on_timeout)
        watchdog.start()

        stdout_lines: List[str] = []
        try:
            assert proc.stdout is not None
            for raw in iter(proc.stdout.readline, b""):
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                stdout_lines.append(line)
                if line.startswith("PROGRESS ") and on_progress is not None:
                    try:
                        payload = json.loads(line[len("PROGRESS "):].strip())
                        asyncio.run_coroutine_threadsafe(on_progress(payload), loop).result(timeout=10)
                    except Exception:
                        pass  # a lost progress update must never fail the analysis
            proc.wait()
        finally:
            watchdog.cancel()
            if proc.poll() is None:
                proc.kill()
        stderr_thread.join(timeout=5)

        if timed_out.is_set():
            raise VideoWorkerError(f"Video analysis timed out after {timeout_sec}s.")
        stderr_text = b"".join(stderr_data).decode("utf-8", errors="replace").strip()
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

    return await asyncio.to_thread(_run)
