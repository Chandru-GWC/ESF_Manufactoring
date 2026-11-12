"""
Secure Server-Side Video Library Discovery & Resolution Service.

Discovers authorized video files inside predefined backend/storage/video_library/<use_case>/
directories, extracts real stream metadata via OpenCV, maps each file to an opaque URL-safe
video_id, and strictly enforces filesystem containment inside VIDEO_LIBRARY_DIR.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from app.schemas.video import (
    VideoLibraryGroup,
    VideoLibraryItem,
    VideoLibraryResponse,
    VideoModelAvailability,
    VideoUseCaseType,
)
from app.services.video.config import (
    ALLOWED_VIDEO_EXTENSIONS,
    OPENFALL_PYTHON,
    SCENARIO_DEFINITIONS,
    VIDEO_LIBRARY_DIR,
    VIDEO_MIME_TYPES,
    WORKERS_DIR,
)
from app.services.video.exit_obstruction_service import get_exit_obstruction_model_status
from app.services.video.fall_detection_service import get_fall_model_status
from app.services.video.smoke_fire_service import get_smoke_fire_model_status

_PREFIX_MAP: Dict[str, str] = {
    "fall_detection": "FD",
    "smoke_fire": "SF",
    "exit_obstruction": "EO",
    "forklift_pedestrian": "FP",
    "machinery_proximity": "MP",
    "unsafe_climbing": "UC",
}

_METADATA_SCRIPT = os.path.join(WORKERS_DIR, "inspect_metadata.py")
_METADATA_CACHE: Dict[Tuple[str, int, int], Dict[str, Optional[float | int | bool]]] = {}
_VIDEO_ID_RE = re.compile(r"^LIB-[A-Z]{2}-[A-F0-9]{12}$")


@dataclass(frozen=True)
class ResolvedLibraryVideo:
    video_id: str
    use_case: VideoUseCaseType
    use_case_title: str
    title: str
    filename: str
    extension: str
    mime_type: str
    abs_path: str
    file_size_bytes: int
    duration_sec: Optional[float]
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]
    available: bool


def get_all_model_statuses() -> List[VideoModelAvailability]:
    """Return real backend availability across all 6 safety video scenarios."""
    return [
        get_fall_model_status(),
        get_smoke_fire_model_status(),
        get_exit_obstruction_model_status(),
        VideoModelAvailability(
            use_case="forklift_pedestrian",
            title="Forklift–Pedestrian Near Miss",
            configured=False,
            model_name=None,
            backend_runtime="Unconfigured",
            message="Model not configured — industrial vehicle & pedestrian proximity detector is not yet integrated.",
            confidence_supported=False,
        ),
        VideoModelAvailability(
            use_case="machinery_proximity",
            title="Unsafe Proximity to Moving Machinery",
            configured=False,
            model_name=None,
            backend_runtime="Unconfigured",
            message="Model not configured — moving machinery perimeter detector is not yet integrated.",
            confidence_supported=False,
        ),
        VideoModelAvailability(
            use_case="unsafe_climbing",
            title="Unsafe Climbing / Working at Height",
            configured=False,
            model_name=None,
            backend_runtime="Unconfigured",
            message="Model not configured — elevated ladder & working-at-height detector is not yet integrated.",
            confidence_supported=False,
        ),
    ]


def get_model_status_map() -> Dict[str, VideoModelAvailability]:
    return {item.use_case: item for item in get_all_model_statuses()}


def _build_video_id(use_case: str, filename: str) -> str:
    prefix = _PREFIX_MAP.get(use_case, "VD")
    digest = hashlib.sha256(f"{use_case}/{filename}".encode("utf-8")).hexdigest()[:12].upper()
    return f"LIB-{prefix}-{digest}"


def _humanize_filename(filename: str) -> str:
    stem, _ = os.path.splitext(filename)
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    return re.sub(r"\s+", " ", cleaned) or filename


def _is_safe_library_path(abs_path: str, expected_use_case_dir: str) -> bool:
    root_real = os.path.realpath(VIDEO_LIBRARY_DIR)
    use_case_real = os.path.realpath(expected_use_case_dir)
    target_real = os.path.realpath(abs_path)
    if not use_case_real.startswith(root_real + os.sep):
        return False
    if os.path.dirname(target_real) != use_case_real:
        return False
    return os.path.isfile(target_real)


def _inspect_uncached_batch(paths: List[str]) -> Dict[str, Dict[str, Optional[float | int | bool]]]:
    if not paths or not os.path.exists(OPENFALL_PYTHON) or not os.path.exists(_METADATA_SCRIPT):
        return {}
    try:
        proc = subprocess.run(
            [OPENFALL_PYTHON, _METADATA_SCRIPT, *paths],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            parsed = json.loads(proc.stdout.strip())
            if isinstance(parsed, dict):
                return parsed
    except Exception:
        pass
    return {}


def _discover_all_entries() -> List[ResolvedLibraryVideo]:
    library_root_real = os.path.realpath(VIDEO_LIBRARY_DIR)
    candidates: List[Tuple[str, str, str, str, int, int]] = []
    uncached_paths: List[str] = []

    for use_case_key, title, _ in SCENARIO_DEFINITIONS:
        scenario_dir = os.path.join(library_root_real, use_case_key)
        if not os.path.isdir(scenario_dir):
            continue
        try:
            names = sorted(os.listdir(scenario_dir), key=str.lower)
        except OSError:
            continue

        for name in names:
            if name.startswith("."):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext not in ALLOWED_VIDEO_EXTENSIONS:
                continue
            candidate_path = os.path.join(scenario_dir, name)
            if not _is_safe_library_path(candidate_path, scenario_dir):
                continue
            try:
                st = os.stat(candidate_path)
            except OSError:
                continue
            if st.st_size <= 0:
                continue

            real_file = os.path.realpath(candidate_path)
            cache_key = (real_file, st.st_mtime_ns, st.st_size)
            if cache_key not in _METADATA_CACHE:
                uncached_paths.append(real_file)
            candidates.append((use_case_key, title, name, real_file, st.st_size, st.st_mtime_ns))

    if uncached_paths:
        inspected = _inspect_uncached_batch(uncached_paths)
        for use_case_key, _, _, real_file, size_bytes, mtime_ns in candidates:
            cache_key = (real_file, mtime_ns, size_bytes)
            if cache_key not in _METADATA_CACHE:
                meta = inspected.get(os.path.abspath(real_file)) or {"available": True}
                _METADATA_CACHE[cache_key] = meta

    resolved: List[ResolvedLibraryVideo] = []
    for use_case_key, uc_title, name, real_file, size_bytes, mtime_ns in candidates:
        ext = os.path.splitext(name)[1].lower()
        cache_key = (real_file, mtime_ns, size_bytes)
        meta = _METADATA_CACHE.get(cache_key, {"available": True})
        video_id = _build_video_id(use_case_key, name)
        resolved.append(
            ResolvedLibraryVideo(
                video_id=video_id,
                use_case=use_case_key,  # type: ignore[arg-type]
                use_case_title=uc_title,
                title=_humanize_filename(name),
                filename=name,
                extension=ext,
                mime_type=VIDEO_MIME_TYPES.get(ext, "application/octet-stream"),
                abs_path=real_file,
                file_size_bytes=size_bytes,
                duration_sec=meta.get("duration_sec") if isinstance(meta.get("duration_sec"), (int, float)) else None,
                width=int(meta["width"]) if isinstance(meta.get("width"), int) else None,
                height=int(meta["height"]) if isinstance(meta.get("height"), int) else None,
                fps=float(meta["fps"]) if isinstance(meta.get("fps"), (int, float)) else None,
                available=bool(meta.get("available", True)),
            )
        )
    return resolved


def list_video_library() -> VideoLibraryResponse:
    entries = _discover_all_entries()
    status_map = get_model_status_map()

    grouped: Dict[str, List[VideoLibraryItem]] = {key: [] for key, _, _ in SCENARIO_DEFINITIONS}
    for entry in entries:
        grouped[entry.use_case].append(
            VideoLibraryItem(
                video_id=entry.video_id,
                use_case=entry.use_case,
                use_case_title=entry.use_case_title,
                title=entry.title,
                filename=entry.filename,
                extension=entry.extension,
                duration_sec=entry.duration_sec,
                file_size_bytes=entry.file_size_bytes,
                width=entry.width,
                height=entry.height,
                fps=entry.fps,
                available=entry.available,
                stream_url=f"/api/v1/video/library/{entry.video_id}/stream",
            )
        )

    groups: List[VideoLibraryGroup] = []
    for key, title, desc in SCENARIO_DEFINITIONS:
        groups.append(
            VideoLibraryGroup(
                use_case=key,  # type: ignore[arg-type]
                title=title,
                description=desc,
                model_status=status_map[key],
                videos=grouped[key],
            )
        )

    configured_count = sum(1 for item in status_map.values() if item.configured)
    return VideoLibraryResponse(
        total_videos=len(entries),
        configured_models_count=configured_count,
        total_scenarios_count=len(SCENARIO_DEFINITIONS),
        groups=groups,
    )


def resolve_video_by_id(video_id: str) -> Optional[ResolvedLibraryVideo]:
    cleaned = (video_id or "").strip().upper()
    if not _VIDEO_ID_RE.match(cleaned):
        return None
    for entry in _discover_all_entries():
        if entry.video_id == cleaned:
            return entry
    return None

