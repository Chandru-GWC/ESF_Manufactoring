"""Isolated YOLOv8 COCO Emergency Exit Obstruction inference worker executed in Python 3.12 runtime."""

import argparse
import json
import os
from typing import Any

import cv2
from ultralytics import YOLO

from worker_utils import emit_progress, open_raw_video_writer, transcode_video_to_h264

# Physical COCO classes that constitute an egress corridor / exit doorway obstruction when lingering in exit zone
OBSTRUCTION_COCO_CLASSES = {
    "bicycle",
    "car",
    "motorcycle",
    "bus",
    "truck",
    "bench",
    "backpack",
    "umbrella",
    "handbag",
    "suitcase",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "refrigerator",
    "oven",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="YOLOv8 Exit Obstruction video worker")
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
        stage="Initialized YOLOv8n COCO egress monitor",
        duration_sec=duration_sec,
    )

    raw_annotated_path = ""
    writer = None
    if args.annotated_out and width > 0 and height > 0:
        raw_annotated_path = f"{args.annotated_out}.raw.mp4"
        writer = open_raw_video_writer(raw_annotated_path, output_fps, width, height)

    best_conf: float | None = None
    best_labels: list[str] = []
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
            h, w = frame.shape[:2]
            ts_sec = round((total_read - 1) / fps, 2)
            results = model.predict(frame, conf=args.conf, verbose=False)
            annotated_frame = frame

            if results:
                res = results[0]
                boxes = res.boxes
                if boxes is not None and len(boxes) > 0:
                    frame_obstacles: list[tuple[str, float]] = []
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf_float = float(box.conf[0])
                        cls_name = str(model.names.get(cls_id, "")).lower().strip()
                        if cls_name not in OBSTRUCTION_COCO_CLASSES:
                            continue
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        cx = (x1 + x2) / 2.0
                        if (0.10 * w <= cx <= 0.90 * w) and (y2 >= 0.25 * h):
                            frame_obstacles.append((cls_name, conf_float))

                    if frame_obstacles:
                        annotated_frame = res.plot()
                        top_name, top_conf = max(frame_obstacles, key=lambda item: item[1])
                        labels_now = sorted({name for name, _ in frame_obstacles})
                        if best_conf is None or top_conf > best_conf:
                            best_conf = round(top_conf, 4)
                            best_labels = labels_now
                            best_ts = ts_sec
                            best_annotated = annotated_frame
                        if ts_sec - last_event_ts >= 1.0:
                            last_event_ts = ts_sec
                            detection_events.append(
                                {
                                    "frame": total_read,
                                    "timestamp_sec": ts_sec,
                                    "state": "OBSTRUCTED",
                                    "label": f"Egress Obstruction ({', '.join(labels_now)})",
                                    "confidence": round(top_conf, 4),
                                    "summary": (
                                        f"Egress obstruction ({', '.join(labels_now)}, {top_conf * 100:.1f}%) at frame {total_read} ({ts_sec:.2f}s)."
                                    ),
                                }
                            )

            if writer is not None:
                writer.write(annotated_frame)

            emit_progress(
                frames_processed=total_read,
                total_frames=frame_count or total_read,
                stage="Scanning egress zone with YOLOv8n COCO",
                duration_sec=duration_sec,
                latest_state="OBSTRUCTED" if best_conf is not None else "CLEAR",
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
        label_str = ", ".join(best_labels)
        event_label = f"Egress Obstruction ({label_str})"
        summary = (
            f"Detected physical obstruction ({label_str}) in egress corridor zone "
            f"with {best_conf * 100:.1f}% YOLOv8 confidence at {best_ts:.2f}s across {processed_frames} sampled frames."
        )
    else:
        event_label = None
        summary = f"No physical exit obstruction detected across {processed_frames} sampled frames."

    payload = {
        "duration_sec": duration_sec,
        "frames_processed": total_read,
        "total_frames": frame_count or total_read,
        "event_detected": best_conf is not None,
        "event_label": event_label,
        "event_timestamp_sec": best_ts,
        "detection_events": detection_events,
        "confidence": best_conf,
        "confidence_note": None,
        "evidence_saved": evidence_saved,
        "annotated_video_saved": annotated_video_saved,
        "model_used": f"YOLOv8 COCO ({os.path.basename(args.weights)})",
        "summary": summary,
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
