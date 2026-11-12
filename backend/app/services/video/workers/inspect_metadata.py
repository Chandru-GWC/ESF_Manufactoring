"""Inspect real video stream metadata using OpenCV inside the Python 3.12 CV runtime."""

import argparse
import json
import os
import sys

import cv2


def inspect_file(path: str) -> dict:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return {"available": False, "error": "Unable to open video stream"}
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration_sec = round(frame_count / fps, 2) if fps > 0 and frame_count > 0 else None
        return {
            "available": True,
            "fps": round(fps, 2) if fps > 0 else None,
            "total_frames": frame_count if frame_count > 0 else None,
            "width": width if width > 0 else None,
            "height": height if height > 0 else None,
            "duration_sec": duration_sec,
        }
    finally:
        cap.release()


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect video metadata")
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()

    results = {}
    for p in args.paths:
        abs_p = os.path.abspath(p)
        results[abs_p] = inspect_file(abs_p) if os.path.isfile(abs_p) else {"available": False}
    sys.stdout.write(json.dumps(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

