import os
from typing import Any, Awaitable, Callable, Dict, Optional

from app.schemas.video import VideoModelAvailability
from app.detection.config import (
    OPENFALL_DETECTOR_SCRIPT,
    OPENFALL_POSE_MODEL,
    runtime_problem,
    OPENFALL_ROOT,
    WORKERS_DIR,
)
from app.detection.runner import run_isolated_cv_worker


def get_fall_model_status() -> VideoModelAvailability:
    runtime_issue = runtime_problem()
    runtime_ok = runtime_issue is None
    detector_ok = os.path.exists(OPENFALL_DETECTOR_SCRIPT)
    weights_ok = os.path.exists(OPENFALL_POSE_MODEL)
    configured = runtime_ok and detector_ok and weights_ok

    if configured:
        message = "OpenFall FallDetector and MediaPipe pose_landmarker_lite.task verified on disk."
    else:
        missing = []
        if not runtime_ok:
            missing.append(runtime_issue)
        if not detector_ok:
            missing.append("OpenFall/src/detector.py")
        if not weights_ok:
            missing.append("pose_landmarker_lite.task")
        message = f"Model not configured. Missing: {', '.join(missing)}."

    return VideoModelAvailability(
        use_case="fall_detection",
        title="Fall Detection",
        configured=configured,
        model_name="OpenFall + MediaPipe PoseLandmarker Lite" if configured else None,
        backend_runtime="OpenFall Subprocess Worker",
        message=message,
        confidence_supported=False,
    )


async def analyze_fall_video(
    video_path: str,
    evidence_out_path: str,
    annotated_out_path: Optional[str] = None,
    on_progress: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
) -> Dict[str, Any]:
    worker = os.path.join(WORKERS_DIR, "fall_worker.py")
    args = [
        "--video",
        video_path,
        "--evidence-out",
        evidence_out_path,
        "--openfall-root",
        OPENFALL_ROOT,
    ]
    if annotated_out_path:
        args.extend(["--annotated-out", annotated_out_path])
    return await run_isolated_cv_worker(
        worker_script=worker,
        args=args,
        cwd=OPENFALL_ROOT,
        on_progress=on_progress,
    )

