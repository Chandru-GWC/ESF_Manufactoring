import os
from typing import Any, Awaitable, Callable, Dict, Optional

from app.schemas.video import VideoModelAvailability
from app.services.video.config import (
    BACKEND_ROOT,
    EXIT_OBSTRUCTION_WEIGHTS,
    OPENFALL_PYTHON,
    WORKERS_DIR,
)
from app.services.video.runner import run_isolated_cv_worker


def get_exit_obstruction_model_status() -> VideoModelAvailability:
    runtime_ok = os.path.exists(OPENFALL_PYTHON)
    weights_ok = os.path.exists(EXIT_OBSTRUCTION_WEIGHTS)
    configured = runtime_ok and weights_ok

    if configured:
        message = f"YOLOv8n COCO egress obstruction weights verified ({os.path.basename(EXIT_OBSTRUCTION_WEIGHTS)})."
    else:
        missing = []
        if not runtime_ok:
            missing.append("Python 3.12 CV runtime")
        if not weights_ok:
            missing.append(os.path.basename(EXIT_OBSTRUCTION_WEIGHTS))
        message = f"Model not configured. Missing: {', '.join(missing)}."

    return VideoModelAvailability(
        use_case="exit_obstruction",
        title="Emergency Exit Obstruction Detection",
        configured=configured,
        model_name="YOLOv8n COCO Egress Monitor" if configured else None,
        backend_runtime="YOLOv8 Python 3.12 Subprocess Worker",
        message=message,
        confidence_supported=True,
    )


async def analyze_exit_obstruction_video(
    video_path: str,
    evidence_out_path: str,
    annotated_out_path: Optional[str] = None,
    on_progress: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
) -> Dict[str, Any]:
    worker = os.path.join(WORKERS_DIR, "exit_obstruction_worker.py")
    args = [
        "--video",
        video_path,
        "--weights",
        EXIT_OBSTRUCTION_WEIGHTS,
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

