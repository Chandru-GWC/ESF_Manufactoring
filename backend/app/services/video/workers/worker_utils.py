"""Shared utilities for isolated CV video inference workers."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any, Optional

import cv2


def emit_progress(
    frames_processed: int,
    total_frames: int,
    stage: str,
    duration_sec: Optional[float] = None,
    latest_state: Optional[str] = None,
) -> None:
    """Emit structured PROGRESS line flushed immediately for async parent tracking."""
    pct = 0
    if total_frames > 0:
        pct = min(99, max(0, int(round((frames_processed / total_frames) * 100))))
    payload: dict[str, Any] = {
        "frames_processed": frames_processed,
        "total_frames": total_frames,
        "progress_pct": pct,
        "stage": stage,
    }
    if duration_sec is not None:
        payload["duration_sec"] = duration_sec
    if latest_state is not None:
        payload["latest_state"] = latest_state
    print(f"PROGRESS {json.dumps(payload)}", flush=True)


def open_raw_video_writer(
    raw_video_path: str,
    fps: float,
    width: int,
    height: int,
) -> cv2.VideoWriter:
    """Create a temporary MP4 VideoWriter matching input stream dimensions."""
    os.makedirs(os.path.dirname(raw_video_path), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    return cv2.VideoWriter(raw_video_path, fourcc, max(1.0, fps), (width, height))


def transcode_video_to_h264(raw_video_path: str, final_video_path: str) -> bool:
    """Transcode OpenCV raw MP4 to browser-playable H.264 MP4 using ffmpeg when available."""
    if not os.path.exists(raw_video_path) or os.path.getsize(raw_video_path) == 0:
        return False

    os.makedirs(os.path.dirname(final_video_path), exist_ok=True)
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        try:
            proc = subprocess.run(
                [
                    ffmpeg_bin,
                    "-y",
                    "-i",
                    raw_video_path,
                    "-c:v",
                    "libx264",
                    "-preset",
                    "fast",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    final_video_path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                timeout=180,
            )
            if (
                proc.returncode == 0
                and os.path.exists(final_video_path)
                and os.path.getsize(final_video_path) > 0
            ):
                return True
        except Exception:
            pass
        finally:
            if os.path.exists(raw_video_path):
                try:
                    os.remove(raw_video_path)
                except OSError:
                    pass
    else:
        try:
            shutil.move(raw_video_path, final_video_path)
            return os.path.exists(final_video_path) and os.path.getsize(final_video_path) > 0
        except OSError:
            pass

    return os.path.exists(final_video_path) and os.path.getsize(final_video_path) > 0

