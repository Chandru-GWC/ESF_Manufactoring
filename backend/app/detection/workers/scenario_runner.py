"""
Generic runner for sampled-frame analyzers (forklift, machinery, ladder).

An *analyzer* implements:
    model_label: str
    load() -> None                                  (raises vision_common.ModelNotAvailable)
    process(frame_bgr, t_sec, frame_index) -> Sample
    decide(samples) -> Decision

The runner reads the real video, runs the analyzer on one frame every ``sample_seconds``, holds the
latest detections on the frames in between so the annotated video plays at the original frame rate,
saves a real evidence frame and prints the structured JSON result the backend expects.
Nothing in here invents detections: every box / state comes from the analyzer's model output.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import cv2

from vision_common import ModelNotAvailable, banner
from worker_utils import emit_progress, open_raw_video_writer, transcode_video_to_h264

RISK_FREE_STATES = {"CLEAR", "OUTSIDE", "NOT_ELEVATED", "NO_SUBJECT"}


@dataclass
class Sample:
    t: float
    frame: int
    state: str
    summary: str
    confidence: Optional[float] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    draw: List[Tuple[Tuple[float, float, float, float], str, Tuple[int, int, int]]] = field(default_factory=list)
    banner: Optional[Tuple[str, Tuple[int, int, int]]] = None
    label: Optional[str] = None
    priority: float = 0.0  # higher = better evidence frame


@dataclass
class Decision:
    event_detected: bool
    event_label: Optional[str]
    event_sample: Optional[Sample]
    summary: str
    confidence_note: Optional[str]
    model_used: str
    confidence: Optional[float] = None


def run_scenario(video: str, evidence_out: str, annotated_out: str, analyzer, sample_seconds: float = 1.0, max_samples: int = 40) -> int:
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise RuntimeError("Unable to open uploaded video stream with OpenCV.")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    if fps <= 0 or fps > 120:
        fps = 24.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    duration = round(frame_count / fps, 2) if frame_count > 0 else None
    if duration:
        sample_seconds = max(sample_seconds, duration / max_samples)
    stride = max(1, int(round(fps * sample_seconds)))

    emit_progress(frames_processed=0, total_frames=frame_count, stage=f"Loading {analyzer.model_label}", duration_sec=duration)
    analyzer.load()
    emit_progress(frames_processed=0, total_frames=frame_count, stage=f"{analyzer.model_label} ready", duration_sec=duration)

    raw_path = f"{annotated_out}.raw.mp4" if annotated_out else ""
    writer = open_raw_video_writer(raw_path, fps, width, height) if raw_path and width > 0 and height > 0 else None

    samples: List[Sample] = []
    kept_frames: Dict[int, bytes] = {}
    held: Optional[Sample] = None
    idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % stride == 0:
                sample = analyzer.process(frame, round(idx / fps, 2), idx + 1)
                samples.append(sample)
                held = sample
                if sample.state not in RISK_FREE_STATES or sample.priority > 0:
                    drawn = frame.copy()
                    _render(drawn, sample)
                    ok_enc, buf = cv2.imencode(".jpg", drawn, [cv2.IMWRITE_JPEG_QUALITY, 92])
                    if ok_enc:
                        kept_frames[len(samples) - 1] = buf.tobytes()
                emit_progress(
                    frames_processed=idx + 1,
                    total_frames=frame_count or idx + 1,
                    stage=f"Analyzing frame {idx + 1} ({sample.t:.1f}s)",
                    duration_sec=duration,
                    latest_state=sample.state,
                )
            if writer is not None:
                out = frame.copy()
                if held is not None:
                    _render(out, held)
                writer.write(out)
            idx += 1
    finally:
        cap.release()
        if writer is not None:
            writer.release()

    decision: Decision = analyzer.decide(samples)

    annotated_saved = False
    if raw_path and annotated_out:
        emit_progress(frames_processed=idx, total_frames=frame_count or idx, stage="Transcoding annotated video output (H.264 MP4)", duration_sec=duration)
        annotated_saved = transcode_video_to_h264(raw_path, annotated_out)

    evidence_saved = False
    evidence_sample = decision.event_sample
    if evidence_sample is None and samples:
        risky = [s for s in samples if s.state not in RISK_FREE_STATES]
        evidence_sample = max(risky, key=lambda s: s.priority) if risky else None
    if evidence_sample is not None:
        ev_idx = samples.index(evidence_sample)
        data = kept_frames.get(ev_idx)
        if data:
            os.makedirs(os.path.dirname(evidence_out), exist_ok=True)
            with open(evidence_out, "wb") as fh:
                fh.write(data)
            evidence_saved = os.path.getsize(evidence_out) > 0

    events: List[Dict[str, Any]] = []
    for s in samples:
        if s.state in RISK_FREE_STATES:
            continue
        events.append(
            {
                "frame": s.frame,
                "timestamp_sec": s.t,
                "state": s.state,
                "label": s.label,
                "confidence": round(s.confidence, 4) if s.confidence is not None else None,
                "summary": s.summary,
                "metrics": s.metrics or None,
            }
        )

    payload = {
        "duration_sec": duration,
        "frames_processed": idx,
        "total_frames": frame_count or idx,
        "event_detected": decision.event_detected,
        "event_label": decision.event_label,
        "event_timestamp_sec": decision.event_sample.t if decision.event_sample else None,
        "detection_events": events,
        "confidence": round(decision.confidence, 4) if decision.confidence is not None else None,
        "confidence_note": decision.confidence_note,
        "evidence_saved": evidence_saved,
        "annotated_video_saved": annotated_saved,
        "model_used": decision.model_used,
        "summary": decision.summary,
    }
    print(json.dumps(payload))
    return 0


def _render(frame, sample: Sample) -> None:
    from vision_common import draw_box

    for box, label, color in sample.draw:
        draw_box(frame, box, label, color)
    if sample.banner:
        banner(frame, sample.banner[0], sample.banner[1])


def main_guard(fn) -> int:
    """Run a worker main(); turn a missing/unverifiable model into a clear single-line error."""
    try:
        return fn()
    except ModelNotAvailable as exc:
        print(f"MODEL_NOT_CONFIGURED: {exc}", file=sys.stderr)
        return 3
    except Exception:
        traceback.print_exc(file=sys.stderr)
        print(f"{sys.exc_info()[0].__name__}: {sys.exc_info()[1]}", file=sys.stderr)
        return 1
