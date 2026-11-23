"""Unsafe climbing / work-at-height worker: OWLv2 (ladder) + YOLOv8n (worker) + MediaPipe pose posture rules."""
import argparse
import os
from typing import Any, Dict, List, Optional

from risk_logic import (
    ELEVATION_MIN,
    LEAN_DEG,
    OVERREACH_RATIO,
    classify_ladder_sample,
    elevation_ratio,
    feet_y,
    inside_fraction,
    person_on_ladder,
    torso_metrics,
)
from scenario_runner import Decision, Sample, main_guard, run_scenario
from vision_common import ModelNotAvailable, PoseEstimator, detect_persons, load_owlv2, owl_detect

LADDER_QUERY = "a ladder"
LADDER_MIN_SCORE = 0.25
RED, ORANGE, GREEN, BLUE = (40, 40, 220), (0, 140, 255), (60, 160, 60), (200, 120, 30)
AT_HEIGHT = ("WORKING_AT_HEIGHT", "UNSAFE_POSTURE")


class LadderAnalyzer:
    model_label = "OWLv2 ladder detector + YOLOv8n worker detector + MediaPipe pose"

    def __init__(self, models_dir: str, yolo_weights: str, pose_model: str) -> None:
        self.models_dir, self.yolo_weights, self.pose_model = models_dir, yolo_weights, pose_model
        self.processor = self.owl = self.yolo = self.pose = None

    def load(self) -> None:
        from ultralytics import YOLO

        for path, what in ((self.yolo_weights, "YOLOv8n weights"), (self.pose_model, "MediaPipe pose model")):
            if not os.path.isfile(path):
                raise ModelNotAvailable(f"{what} not found: {os.path.basename(path)}")
        self.processor, self.owl = load_owlv2(self.models_dir)
        self.yolo = YOLO(self.yolo_weights)
        self.pose = PoseEstimator(self.pose_model)

    def process(self, frame, t: float, frame_no: int) -> Sample:
        ladders = [d for d in owl_detect(self.processor, self.owl, frame, [LADDER_QUERY], 0.15) if d["score"] >= LADDER_MIN_SCORE]
        persons = detect_persons(self.yolo, frame, conf=0.35)
        draw = []
        if not ladders or not persons:
            draw += [(p["box"], f"worker {p['score']:.2f}", GREEN) for p in persons]
            why = "No ladder detected in this frame." if not ladders else "No worker detected in this frame."
            return Sample(t=t, frame=frame_no, state="NO_SUBJECT", summary=why, draw=draw)

        ladder = ladders[0]
        draw.append((ladder["box"], f"ladder {ladder['score']:.2f}", BLUE))  # only the ladder that is evaluated
        worker = max(persons, key=lambda p: inside_fraction(p["box"], ladder["box"]))
        on = person_on_ladder(worker["box"], ladder["box"])
        lms = self.pose.landmarks(frame, worker["box"])
        fy = feet_y(lms, worker["box"][3]) if lms else worker["box"][3]
        elev = elevation_ratio(fy, ladder["box"])
        metrics = torso_metrics(lms) if lms else None
        state, unsafe = classify_ladder_sample(on, elev, metrics)
        label = {"UNSAFE_POSTURE": "Unsafe posture while working at height on a ladder", "WORKING_AT_HEIGHT": "Worker working at height on a ladder"}.get(state)
        color = RED if state == "UNSAFE_POSTURE" else ORANGE if state == "WORKING_AT_HEIGHT" else GREEN
        draw.append((worker["box"], f"worker {worker['score']:.2f}", color))
        if state == "UNSAFE_POSTURE":
            summary = f"Worker on a ladder shows observable unsafe posture: {', '.join(unsafe)}."
        elif state == "WORKING_AT_HEIGHT":
            summary = "Worker is elevated on a ladder with no unsafe posture measured in this frame."
        else:
            summary = "Worker is not elevated on the ladder in this frame."
        m: Dict[str, Any] = {"elevation_ratio": round(elev, 2), "on_ladder": on, "ladder_score": round(ladder["score"], 3), "worker_score": round(worker["score"], 3), "pose_found": bool(lms)}
        if metrics:
            m.update({"lean_deg": round(metrics["lean_deg"], 1), "overreach_ratio": round(metrics["overreach_ratio"], 2)})
        return Sample(
            t=t, frame=frame_no, state=state, summary=summary, label=label,
            confidence=min(worker["score"], ladder["score"]) if state != "NOT_ELEVATED" else None,
            metrics=m, draw=draw, banner=(label, color) if label else None,
            priority={"UNSAFE_POSTURE": 3, "WORKING_AT_HEIGHT": 2}.get(state, 0),
        )

    def decide(self, samples: List[Sample]) -> Decision:
        model = "OWLv2 (google/owlv2-base-patch16-ensemble, safetensors) + YOLOv8n COCO + MediaPipe pose"
        note = ("Lowest of the ladder (OWLv2) and worker (YOLOv8n) detector scores. Only observable posture is assessed "
                f"(elevation ≥{ELEVATION_MIN:.0%} of ladder height, lateral overreach ≥{OVERREACH_RATIO:.1f}× torso length, torso lean ≥{LEAN_DEG:.0f}°). "
                "Ladder stability, footing and fall-arrest equipment are NOT measured.")
        idx = [i for i, s in enumerate(samples) if s.state in AT_HEIGHT]
        confirmed: Optional[int] = next((i for i in idx if i + 1 < len(samples) and samples[i + 1].state in AT_HEIGHT), None)
        if confirmed is None:
            if idx:
                return Decision(False, None, None, "A worker appeared elevated on a ladder in a single sample only; this does not meet the rule (two consecutive samples).", note, model)
            return Decision(False, None, None, "A worker and ladder were evaluated; the worker was not observed elevated on the ladder.", note, model)
        unsafe_samples = [s for s in samples if s.state == "UNSAFE_POSTURE"]
        ev = unsafe_samples[0] if unsafe_samples else samples[confirmed]
        if unsafe_samples:
            conds = sorted({c for s in unsafe_samples for c in ("overreach" if s.metrics.get("overreach_ratio", 0) >= OVERREACH_RATIO else None, "torso lean" if s.metrics.get("lean_deg", 0) >= LEAN_DEG else None) if c})
            text = (f"Unsafe posture on a ladder at {ev.t:.2f}s ({', '.join(conds)}), observed in {len(unsafe_samples)} sampled frame(s); "
                    f"worker elevated on the ladder in {len(idx)} sampled frame(s). Ladder stability was not assessed.")
            label = "Unsafe posture while working at height on a ladder"
        else:
            text = (f"Worker working at height on a ladder from {ev.t:.2f}s ({len(idx)} sampled frame(s)); no unsafe posture was measured. "
                    "Ladder stability was not assessed.")
            label = "Worker working at height on a ladder"
        return Decision(True, label, ev, text, note, model, confidence=ev.confidence)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--models-dir", required=True)
    ap.add_argument("--yolo-weights", required=True)
    ap.add_argument("--pose-model", required=True)
    ap.add_argument("--evidence-out", required=True)
    ap.add_argument("--annotated-out", default="")
    a = ap.parse_args()
    return run_scenario(a.video, a.evidence_out, a.annotated_out, LadderAnalyzer(a.models_dir, a.yolo_weights, a.pose_model), sample_seconds=1.0)


if __name__ == "__main__":
    raise SystemExit(main_guard(main))
