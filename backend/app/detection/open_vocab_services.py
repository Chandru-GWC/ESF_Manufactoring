"""
Readiness checks and runners for the three OWLv2-based scenarios:
forklift-pedestrian near miss, moving-machinery proximity, unsafe climbing / work at height.

A scenario is `configured` ONLY when every required artefact exists and the OWLv2 safetensors file
passes its pinned SHA-256 check. Otherwise the status stays MODEL_NOT_CONFIGURED and says what is missing.
"""
from __future__ import annotations

import functools
import hashlib
import os
from typing import Any, Dict, List, Optional

from app.schemas.video import VideoModelAvailability
from app.detection.config import (
    BACKEND_ROOT,
    EXIT_OBSTRUCTION_WEIGHTS,  # YOLOv8n COCO weights (people)
    OPENFALL_POSE_MODEL,
    runtime_problem,
    WEIGHTS_DIR,
    WORKERS_DIR,
)
from app.detection.runner import run_isolated_cv_worker

OWL_DIR = os.path.join(WEIGHTS_DIR, "owlv2-base-patch16-ensemble")
OWL_WEIGHTS = os.path.join(OWL_DIR, "model.safetensors")
OWL_SHA256 = "e1e130b9e404cf91a75ad45644c1da9d7fa5284085eecc864266a6923efb99e7"  # keep in sync with workers/vision_common.py
OWL_LABEL = "OWLv2 (Google, Apache-2.0, safetensors)"


@functools.lru_cache(maxsize=4)
def _sha_ok(path: str, size: int, mtime_ns: int) -> bool:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().lower() == OWL_SHA256


def _owl_problem() -> Optional[str]:
    try:
        if not os.path.isfile(OWL_WEIGHTS):
            return "OWLv2 weights (models_cache/owlv2-base-patch16-ensemble/model.safetensors)"
        st = os.stat(OWL_WEIGHTS)
        if not _sha_ok(OWL_WEIGHTS, st.st_size, st.st_mtime_ns):
            return "OWLv2 weights failed SHA-256 verification"
        for name in ("config.json", "preprocessor_config.json", "vocab.json", "merges.txt"):
            if not os.path.isfile(os.path.join(OWL_DIR, name)):
                return f"OWLv2 file {name}"
        return None
    except Exception as exc:
        return f"OWLv2 verification error: {exc}"


def _runtime_problem(needs_pose: bool) -> Optional[str]:
    issue = runtime_problem()
    if issue:
        return issue
    if not os.path.isfile(EXIT_OBSTRUCTION_WEIGHTS):
        return "YOLOv8n weights (yolov8n.pt)"
    if needs_pose and not os.path.isfile(OPENFALL_POSE_MODEL):
        return "MediaPipe pose model (pose_landmarker_lite.task)"
    return None


def _status(use_case: str, title: str, model_name: str, needs_pose: bool, ok_msg: str) -> VideoModelAvailability:
    problem = _owl_problem() or _runtime_problem(needs_pose)
    if problem:
        return VideoModelAvailability(
            use_case=use_case,
            title=title,
            configured=False,
            model_name=None,
            backend_runtime="Unconfigured",
            message=f"Model not configured. Missing or unverified: {problem}.",
            confidence_supported=False,
        )
    return VideoModelAvailability(
        use_case=use_case,
        title=title,
        configured=True,
        model_name=model_name,
        backend_runtime="OWLv2 + YOLOv8n Subprocess Worker",
        message=ok_msg,
        confidence_supported=True,
    )


def get_forklift_status() -> VideoModelAvailability:
    return _status(
        "forklift_pedestrian",
        "Forklift–Pedestrian Near Miss",
        "OWLv2 forklift detector + YOLOv8n pedestrians",
        False,
        f"{OWL_LABEL} verified (SHA-256) with YOLOv8n pedestrian detection; proximity rules active.",
    )


def get_machinery_status() -> VideoModelAvailability:
    return _status(
        "machinery_proximity",
        "Unsafe Proximity to Moving Machinery",
        "OWLv2 machine detector + YOLOv8n + MediaPipe pose",
        True,
        f"{OWL_LABEL} verified (SHA-256) with YOLOv8n workers and MediaPipe pose; restricted-zone rules active (fixed camera assumed).",
    )


def get_ladder_status() -> VideoModelAvailability:
    return _status(
        "unsafe_climbing",
        "Unsafe Climbing / Working at Height",
        "OWLv2 ladder detector + YOLOv8n + MediaPipe pose",
        True,
        f"{OWL_LABEL} verified (SHA-256) with YOLOv8n workers and MediaPipe pose; observable posture only, ladder stability is not measured.",
    )


async def _run(worker: str, extra: List[str], video_path: str, evidence_out: str, annotated_out: Optional[str], on_progress) -> Dict[str, Any]:
    args = [
        "--video", video_path,
        "--models-dir", WEIGHTS_DIR,
        "--yolo-weights", EXIT_OBSTRUCTION_WEIGHTS,
        "--evidence-out", evidence_out,
        *extra,
    ]
    if annotated_out:
        args += ["--annotated-out", annotated_out]
    return await run_isolated_cv_worker(
        worker_script=os.path.join(WORKERS_DIR, worker),
        args=args,
        cwd=BACKEND_ROOT,
        on_progress=on_progress,
        timeout_sec=900,
    )


async def analyze_forklift_video(video_path, evidence_out_path, annotated_out_path=None, on_progress=None):
    return await _run("forklift_worker.py", [], video_path, evidence_out_path, annotated_out_path, on_progress)


async def analyze_machinery_video(video_path, evidence_out_path, annotated_out_path=None, on_progress=None):
    return await _run("machinery_worker.py", ["--pose-model", OPENFALL_POSE_MODEL], video_path, evidence_out_path, annotated_out_path, on_progress)


async def analyze_ladder_video(video_path, evidence_out_path, annotated_out_path=None, on_progress=None):
    return await _run("ladder_worker.py", ["--pose-model", OPENFALL_POSE_MODEL], video_path, evidence_out_path, annotated_out_path, on_progress)
