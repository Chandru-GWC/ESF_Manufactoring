import os
from typing import Any, Awaitable, Callable, Dict, Optional

from app.schemas.video import VideoModelAvailability
from app.detection.config import (
    BACKEND_ROOT,
    runtime_problem,
    SMOKE_FIRE_WEIGHTS,
    WORKERS_DIR,
)
from app.detection.runner import run_isolated_cv_worker


def get_smoke_fire_model_status() -> VideoModelAvailability:
    runtime_issue = runtime_problem()
    runtime_ok = runtime_issue is None
    weights_ok = os.path.exists(SMOKE_FIRE_WEIGHTS)
    configured = runtime_ok and weights_ok

    if configured:
        message = f"YOLOv8 Smoke & Fire weights verified ({os.path.basename(SMOKE_FIRE_WEIGHTS)})."
    else:
        missing = []
        if not runtime_ok:
            missing.append(runtime_issue)
        if not weights_ok:
            missing.append(os.path.basename(SMOKE_FIRE_WEIGHTS))
        message = f"Model not configured. Missing: {', '.join(missing)}."

    return VideoModelAvailability(
        use_case="smoke_fire",
        title="Smoke & Fire Detection",
        configured=configured,
        model_name="YOLOv8 Smoke & Fire" if configured else None,
        backend_runtime="YOLOv8 Subprocess Worker",
        message=message,
        confidence_supported=True,
    )


async def analyze_smoke_fire_video(
    video_path: str,
    evidence_out_path: str,
    annotated_out_path: Optional[str] = None,
    on_progress: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
) -> Dict[str, Any]:
    worker = os.path.join(WORKERS_DIR, "smoke_fire_worker.py")
    args = [
        "--video",
        video_path,
        "--weights",
        SMOKE_FIRE_WEIGHTS,
        "--evidence-out",
        evidence_out_path,
    ]
    if annotated_out_path:
        args.extend(["--annotated-out", annotated_out_path])
    return await run_isolated_cv_worker(
        worker_script=worker,
        args=args,
        cwd=BACKEND_ROOT,
        on_progress=on_progress,
    )

