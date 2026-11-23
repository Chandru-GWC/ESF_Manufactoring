import functools
import importlib.util
import os
import subprocess
import sys
from typing import Dict, Optional, Tuple

BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
WORKSPACE_ROOT = os.path.abspath(os.path.join(BACKEND_ROOT, ".."))

OPENFALL_ROOT = os.path.join(BACKEND_ROOT, "vendor", "OpenFall")
# The CV workers run in the backend's own uv environment (install once: `uv sync --group vision`).
# Set DETECTION_PYTHON to run them in a different interpreter instead.
DETECTION_PYTHON = os.environ.get("DETECTION_PYTHON") or sys.executable
OPENFALL_PYTHON = DETECTION_PYTHON  # name kept for the worker services

REQUIRED_CV_PACKAGES = ("cv2", "numpy", "mediapipe", "torch", "ultralytics", "transformers")


@functools.lru_cache(maxsize=1)
def runtime_problem() -> Optional[str]:
    """None when the CV runtime can really run; otherwise what is missing (checked once, not just 'file exists')."""
    if not os.path.isfile(DETECTION_PYTHON):
        return f"Python interpreter not found ({DETECTION_PYTHON})"
    if os.path.normcase(DETECTION_PYTHON) == os.path.normcase(sys.executable):
        missing = [m for m in REQUIRED_CV_PACKAGES if importlib.util.find_spec(m) is None]
    else:
        probe = "import importlib.util as u, sys; print(','.join(m for m in sys.argv[1:] if u.find_spec(m) is None))"
        try:
            out = subprocess.run(
                [DETECTION_PYTHON, "-c", probe, *REQUIRED_CV_PACKAGES], capture_output=True, text=True, timeout=30
            )
        except Exception as exc:
            return f"CV runtime cannot start: {exc}"
        if out.returncode != 0:
            return "CV runtime cannot start (the interpreter failed to run)"
        missing = [m for m in out.stdout.strip().split(",") if m]
    if missing:
        return f"CV packages not installed ({', '.join(missing)}). Run: uv sync --group vision"
    return None


OPENFALL_DETECTOR_SCRIPT = os.path.join(OPENFALL_ROOT, "src", "detector.py")
OPENFALL_POSE_MODEL = os.path.join(OPENFALL_ROOT, "data", "pose_landmarker_lite.task")

WEIGHTS_DIR = os.path.join(BACKEND_ROOT, "models_cache")
SMOKE_FIRE_WEIGHTS = os.path.join(WEIGHTS_DIR, "fire_smoke_yolov8.pt")
EXIT_OBSTRUCTION_WEIGHTS = os.path.join(WEIGHTS_DIR, "yolov8n.pt")

WORKERS_DIR = os.path.join(os.path.dirname(__file__), "workers")
STORAGE_DIR = os.path.join(BACKEND_ROOT, "storage")
EVIDENCE_DIR = os.path.join(STORAGE_DIR, "evidence")
ANNOTATED_VIDEO_DIR = os.path.join(STORAGE_DIR, "annotated")
TEMP_VIDEO_DIR = os.path.join(STORAGE_DIR, "tmp_uploads")
UPLOADED_VIDEO_DIR = os.path.join(STORAGE_DIR, "uploaded_videos")  # original videos sent by users, kept
VIDEO_LIBRARY_DIR = os.path.join(STORAGE_DIR, "video_library")

SCENARIO_DEFINITIONS: Tuple[Tuple[str, str, str], ...] = (
    (
        "fall_detection",
        "Fall Detection",
        "OpenFall 2D pose and biomechanics monitoring for worker slips, pre-fall instability, and ground-level falls.",
    ),
    (
        "smoke_fire",
        "Smoke & Fire",
        "Frame-level YOLOv8 detection for visible flame ignition, thermal flare-ups, and industrial smoke plumes.",
    ),
    (
        "exit_obstruction",
        "Emergency Exit Obstruction",
        "Egress corridor monitoring using YOLOv8n COCO detection for blocked exit pathways and stationary obstacles.",
    ),
    (
        "forklift_pedestrian",
        "Forklift–Pedestrian Near Miss",
        "Warehouse and plant aisle proximity monitoring between industrial vehicles and pedestrians.",
    ),
    (
        "machinery_proximity",
        "Unsafe Proximity to Moving Machinery",
        "Machine guarding perimeter monitoring for operator entry into active mechanical hazard zones.",
    ),
    (
        "unsafe_climbing",
        "Unsafe Climbing / Working at Height",
        "Elevated platform, ladder posture, and unprotected edge monitoring across mezzanine and racking bays.",
    ),
)

APPROVED_VIDEO_USE_CASES: Dict[str, Tuple[str, str]] = {
    key: (title, desc) for key, title, desc in SCENARIO_DEFINITIONS
}

os.makedirs(WEIGHTS_DIR, exist_ok=True)
os.makedirs(EVIDENCE_DIR, exist_ok=True)
os.makedirs(ANNOTATED_VIDEO_DIR, exist_ok=True)
os.makedirs(TEMP_VIDEO_DIR, exist_ok=True)
os.makedirs(UPLOADED_VIDEO_DIR, exist_ok=True)
os.makedirs(VIDEO_LIBRARY_DIR, exist_ok=True)
for _use_case_key, _, _ in SCENARIO_DEFINITIONS:
    os.makedirs(os.path.join(VIDEO_LIBRARY_DIR, _use_case_key), exist_ok=True)

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm"}
VIDEO_MIME_TYPES: Dict[str, str] = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
}
MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
INFERENCE_TIMEOUT_SECONDS = 600
