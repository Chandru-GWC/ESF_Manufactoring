"""Isolated OpenFall inference worker executed in OpenFall Python 3.12 runtime."""

import argparse
import json
import os
import sys
from typing import Any

import cv2

from worker_utils import emit_progress, open_raw_video_writer, transcode_video_to_h264


_STATE_LABELS = {
    "STANDING": "Standing / Normal Posture",
    "PREFALL": "Pre-Fall Instability Detected (PREFALL)",
    "FALLEN": "Worker Fall Detected (FALLEN)",
}


def _safe_metrics(metrics_obj: Any) -> dict[str, Any]:
    if metrics_obj is None:
        return {}
    raw: dict[str, Any] = {}
    if isinstance(metrics_obj, dict):
        raw = metrics_obj
    elif hasattr(metrics_obj, "__dict__"):
        raw = vars(metrics_obj)
    clean: dict[str, Any] = {}
    for k, v in raw.items():
        if isinstance(v, (int, float, bool, str)) or v is None:
            clean[str(k)] = round(v, 4) if isinstance(v, float) else v
    return clean


def main() -> int:
    parser = argparse.ArgumentParser(description="OpenFall standalone video worker")
    parser.add_argument("--video", required=True)
    parser.add_argument("--evidence-out", required=True)
    parser.add_argument("--annotated-out", default="")
    parser.add_argument("--openfall-root", required=True)
    args = parser.parse_args()

    sys.path.insert(0, args.openfall_root)
    from src.detector import FallDetector, FallState  # type: ignore

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError("Unable to open uploaded video stream with OpenCV.")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    if fps <= 0 or fps > 120:
        fps = 24.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration_sec = round(frame_count / fps, 2) if frame_count > 0 else None

    # Use full frame accuracy (stride=1) for standard clips <= 450 frames; cap long videos cleanly
    stride = 1 if frame_count <= 450 else max(1, frame_count // 300)
    output_fps = max(1.0, fps / stride)

    emit_progress(
        frames_processed=0,
        total_frames=frame_count,
        stage="Initialized OpenFall MediaPipe PoseLandmarker runtime",
        duration_sec=duration_sec,
    )

    raw_annotated_path = ""
    writer = None
    if args.annotated_out and width > 0 and height > 0:
        raw_annotated_path = f"{args.annotated_out}.raw.mp4"
        writer = open_raw_video_writer(raw_annotated_path, output_fps, width, height)

    fall_timestamp: float | None = None
    prefall_timestamp: float | None = None
    evidence_saved = False
    processed_frames = 0
    total_read = 0
    last_state_name: str | None = None
    detection_events: list[dict[str, Any]] = []

    try:
        with FallDetector(depth_estimator=None) as det:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                total_read += 1
                if (total_read - 1) % stride != 0:
                    continue

                processed_frames += 1
                ts_sec = round((total_read - 1) / fps, 2)
                annotated, state, metrics = det.process(frame)
                state_name = getattr(state, "name", str(state)).upper()

                if writer is not None:
                    writer.write(annotated)

                if state_name != last_state_name:
                    last_state_name = state_name
                    metric_summary = _safe_metrics(metrics)
                    detection_events.append(
                        {
                            "frame": total_read,
                            "timestamp_sec": ts_sec,
                            "state": state_name,
                            "label": _STATE_LABELS.get(state_name, state_name),
                            "confidence": None,
                            "summary": (
                                f"State transitioned to {state_name} at frame {total_read} ({ts_sec:.2f}s)."
                            ),
                            "metrics": metric_summary or None,
                        }
                    )

                if state == FallState.FALLEN and fall_timestamp is None:
                    fall_timestamp = ts_sec
                    os.makedirs(os.path.dirname(args.evidence_out), exist_ok=True)
                    cv2.imwrite(args.evidence_out, annotated)
                    evidence_saved = True
                elif state == FallState.PREFALL and prefall_timestamp is None:
                    prefall_timestamp = ts_sec
                    if not evidence_saved:
                        os.makedirs(os.path.dirname(args.evidence_out), exist_ok=True)
                        cv2.imwrite(args.evidence_out, annotated)
                        evidence_saved = True

                if processed_frames % 10 == 0 or (frame_count > 0 and total_read >= frame_count):
                    emit_progress(
                        frames_processed=total_read,
                        total_frames=frame_count or total_read,
                        stage=f"Analyzing OpenFall pose & biomechanics ({state_name})",
                        duration_sec=duration_sec,
                        latest_state=state_name,
                    )
    finally:
        cap.release()
        if writer is not None:
            writer.release()

    if duration_sec is None and total_read > 0:
        duration_sec = round(total_read / fps, 2)

    annotated_video_saved = False
    if raw_annotated_path and args.annotated_out:
        emit_progress(
            frames_processed=total_read,
            total_frames=frame_count or total_read,
            stage="Transcoding annotated video output (H.264 MP4)",
            duration_sec=duration_sec,
            latest_state=last_state_name,
        )
        annotated_video_saved = transcode_video_to_h264(raw_annotated_path, args.annotated_out)

    if fall_timestamp is not None:
        result = {
            "duration_sec": duration_sec,
            "frames_processed": total_read,
            "total_frames": frame_count or total_read,
            "event_detected": True,
            "event_label": "Worker Fall Detected (FALLEN)",
            "event_timestamp_sec": fall_timestamp,
            "detection_events": detection_events,
            "confidence": None,
            "confidence_note": "OpenFall biomechanics rule & pose threshold model (no scalar confidence score)",
            "evidence_saved": evidence_saved,
            "annotated_video_saved": annotated_video_saved,
            "model_used": "OpenFall FallDetector + MediaPipe PoseLandmarker Lite",
            "summary": (
                f"OpenFall detected FALLEN state at {fall_timestamp:.2f}s "
                f"across {processed_frames} analyzed frames ({len(detection_events)} state transitions)."
            ),
        }
    elif prefall_timestamp is not None:
        result = {
            "duration_sec": duration_sec,
            "frames_processed": total_read,
            "total_frames": frame_count or total_read,
            "event_detected": True,
            "event_label": "Pre-Fall Instability Detected (PREFALL)",
            "event_timestamp_sec": prefall_timestamp,
            "detection_events": detection_events,
            "confidence": None,
            "confidence_note": "OpenFall biomechanics rule & pose threshold model (no scalar confidence score)",
            "evidence_saved": evidence_saved,
            "annotated_video_saved": annotated_video_saved,
            "model_used": "OpenFall FallDetector + MediaPipe PoseLandmarker Lite",
            "summary": (
                f"OpenFall detected PREFALL postural instability at {prefall_timestamp:.2f}s "
                f"across {processed_frames} analyzed frames; human safety review recommended."
            ),
        }
    else:
        if evidence_saved and os.path.exists(args.evidence_out):
            os.remove(args.evidence_out)
        result = {
            "duration_sec": duration_sec,
            "frames_processed": total_read,
            "total_frames": frame_count or total_read,
            "event_detected": False,
            "event_label": None,
            "event_timestamp_sec": None,
            "detection_events": detection_events,
            "confidence": None,
            "confidence_note": "OpenFall biomechanics rule & pose threshold model (no scalar confidence score)",
            "evidence_saved": False,
            "annotated_video_saved": annotated_video_saved,
            "model_used": "OpenFall FallDetector + MediaPipe PoseLandmarker Lite",
            "summary": f"No fall or pre-fall event detected across {processed_frames} analyzed frames.",
        }

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
