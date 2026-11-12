"""Isolated YOLOv8 Smoke & Fire inference worker executed in Python 3.12 runtime."""

import argparse
import json
import os
from typing import Any

import cv2
from ultralytics import YOLO

from worker_utils import emit_progress, open_raw_video_writer, transcode_video_to_h264


def main() -> int:
    parser = argparse.ArgumentParser(description="YOLOv8 Smoke & Fire video worker")
    parser.add_argument("--video", required=True)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--evidence-out", required=True)
    parser.add_argument("--annotated-out", default="")
    parser.add_argument("--conf", type=float, default=0.35)
    args = parser.parse_args()

    model = YOLO(args.weights)
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

    stride = max(1, int(round(fps * 0.5)))
    output_fps = max(1.0, fps / stride)

    emit_progress(
        frames_processed=0,
        total_frames=frame_count,
        stage="Initialized YOLOv8 Smoke & Fire detector",
        duration_sec=duration_sec,
    )

    raw_annotated_path = ""
    writer = None
    if args.annotated_out and width > 0 and height > 0:
        raw_annotated_path = f"{args.annotated_out}.raw.mp4"
        writer = open_raw_video_writer(raw_annotated_path, output_fps, width, height)

    best_conf: float | None = None
    best_label: str | None = None
    best_ts: float | None = None
    best_annotated = None
    processed_frames = 0
    total_read = 0
    detection_events: list[dict[str, Any]] = []
    last_event_ts: float = -10.0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            total_read += 1
            if (total_read - 1) % stride != 0:
                continue

            processed_frames += 1
            ts_sec = round((total_read - 1) / fps, 2)
            results = model.predict(frame, conf=args.conf, verbose=False)
            annotated_frame = frame

            if results:
                res = results[0]
                boxes = res.boxes
                if boxes is not None and len(boxes) > 0:
                    annotated_frame = res.plot()
                    confs = boxes.conf.tolist()
                    clss = boxes.cls.tolist()
                    frame_best_conf: float | None = None
                    frame_best_label: str | None = None
                    for conf_val, cls_id in zip(confs, clss):
                        conf_float = float(conf_val)
                        raw_name = str(model.names.get(int(cls_id), f"class_{int(cls_id)}"))
                        label = f"{raw_name.strip().title()} Detected"
                        if frame_best_conf is None or conf_float > frame_best_conf:
                            frame_best_conf = round(conf_float, 4)
                            frame_best_label = label
                        if best_conf is None or conf_float > best_conf:
                            best_conf = round(conf_float, 4)
                            best_label = label
                            best_ts = ts_sec
                            best_annotated = annotated_frame

                    if frame_best_label and (ts_sec - last_event_ts >= 1.0):
                        last_event_ts = ts_sec
                        detection_events.append(
                            {
                                "frame": total_read,
                                "timestamp_sec": ts_sec,
                                "state": "SMOKE_FIRE",
                                "label": frame_best_label,
                                "confidence": frame_best_conf,
                                "summary": (
                                    f"{frame_best_label} ({frame_best_conf * 100:.1f}%) at frame {total_read} ({ts_sec:.2f}s)."
                                ),
                            }
                        )

            if writer is not None:
                writer.write(annotated_frame)

            emit_progress(
                frames_processed=total_read,
                total_frames=frame_count or total_read,
                stage="Scanning frames with YOLOv8 Smoke & Fire",
                duration_sec=duration_sec,
                latest_state=best_label or "CLEAR",
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
        )
        annotated_video_saved = transcode_video_to_h264(raw_annotated_path, args.annotated_out)

    evidence_saved = False
    if best_conf is not None and best_annotated is not None:
        os.makedirs(os.path.dirname(args.evidence_out), exist_ok=True)
        evidence_saved = bool(cv2.imwrite(args.evidence_out, best_annotated))
        summary = (
            f"{best_label} with {best_conf * 100:.1f}% model confidence at {best_ts:.2f}s "
            f"across {processed_frames} sampled frames."
        )
    else:
        summary = f"No smoke or fire detected across {processed_frames} sampled frames."

    payload = {
        "duration_sec": duration_sec,
        "frames_processed": total_read,
        "total_frames": frame_count or total_read,
        "event_detected": best_conf is not None,
        "event_label": best_label,
        "event_timestamp_sec": best_ts,
        "detection_events": detection_events,
        "confidence": best_conf,
        "confidence_note": None,
        "evidence_saved": evidence_saved,
        "annotated_video_saved": annotated_video_saved,
        "model_used": f"YOLOv8 ({os.path.basename(args.weights)})",
        "summary": summary,
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
