"""Moving-machinery proximity worker: OWLv2 (machine) + YOLOv8n (workers) + MediaPipe pose (hands) + zone rules."""
import argparse
import os
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from risk_logic import (
    MOTION_MIN_MEAN_DIFF,
    ZONE_MARGIN_FRACTION,
    classify_machinery_sample,
    expand,
    point_in,
)
from scenario_runner import Decision, Sample, main_guard, run_scenario
from vision_common import ModelNotAvailable, PoseEstimator, detect_persons, load_owlv2, owl_detect

MACHINE_QUERIES = ["a conveyor belt", "an industrial machine"]
MACHINE_MIN_SCORE = 0.25
MACHINE_FRAMES = 3  # the camera is treated as fixed: the machine is located on the first sampled frames
RED, ORANGE, GREEN, BLUE = (40, 40, 220), (0, 140, 255), (60, 160, 60), (200, 120, 30)
ACTIVE = ("ZONE_INTRUSION", "HANDS_IN_MACHINE_AREA")


class MachineryAnalyzer:
    model_label = "OWLv2 machine detector + YOLOv8n worker detector + MediaPipe pose"

    def __init__(self, models_dir: str, yolo_weights: str, pose_model: str) -> None:
        self.models_dir, self.yolo_weights, self.pose_model = models_dir, yolo_weights, pose_model
        self.processor = self.owl = self.yolo = self.pose = None
        self.machine_candidates: List[Dict[str, Any]] = []
        self.machine: Optional[Tuple[float, float, float, float]] = None
        self.machine_score: Optional[float] = None
        self.prev_gray: Optional[np.ndarray] = None

    def load(self) -> None:
        from ultralytics import YOLO

        for path, what in ((self.yolo_weights, "YOLOv8n weights"), (self.pose_model, "MediaPipe pose model")):
            if not os.path.isfile(path):
                raise ModelNotAvailable(f"{what} not found: {os.path.basename(path)}")
        self.processor, self.owl = load_owlv2(self.models_dir)
        self.yolo = YOLO(self.yolo_weights)
        self.pose = PoseEstimator(self.pose_model)

    def _locate_machine(self, frame) -> None:
        dets = [d for d in owl_detect(self.processor, self.owl, frame, MACHINE_QUERIES, 0.15) if d["score"] >= MACHINE_MIN_SCORE]
        h, w = frame.shape[:2]
        # ignore detections that are essentially the whole frame (background), keep the best remaining
        dets = [d for d in dets if (d["box"][2] - d["box"][0]) * (d["box"][3] - d["box"][1]) < 0.7 * w * h]
        if dets:
            self.machine_candidates.append(max(dets, key=lambda d: d["score"]))
        if len(self.machine_candidates) >= 1 and self.machine is None:
            boxes = np.array([c["box"] for c in self.machine_candidates])
            self.machine = tuple(float(v) for v in np.median(boxes, axis=0))
            self.machine_score = float(np.mean([c["score"] for c in self.machine_candidates]))

    def process(self, frame, t: float, frame_no: int) -> Sample:
        h, w = frame.shape[:2]
        if self.machine is None or len(self.machine_candidates) < MACHINE_FRAMES:
            self._locate_machine(frame)
        persons = detect_persons(self.yolo, frame, conf=0.35)
        draw = []
        if self.machine is None:
            draw += [(p["box"], f"person {p['score']:.2f}", GREEN) for p in persons]
            return Sample(t=t, frame=frame_no, state="NO_SUBJECT", summary="No machine detected yet.", draw=draw)

        zone = expand(self.machine, ZONE_MARGIN_FRACTION * w, w, h)
        draw.append((zone, "restricted zone", ORANGE))
        draw.append((self.machine, f"machine {self.machine_score:.2f}", BLUE))

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        motion = None
        if self.prev_gray is not None:
            mask = np.ones(gray.shape, dtype=np.uint8)
            for p in persons:  # ignore people so that only the machine's own movement counts
                x1, y1, x2, y2 = [int(v) for v in p["box"]]
                mask[max(0, y1):y2, max(0, x1):x2] = 0
            mx1, my1, mx2, my2 = [int(v) for v in self.machine]
            roi_mask = mask[my1:my2, mx1:mx2]
            diff = cv2.absdiff(gray, self.prev_gray)[my1:my2, mx1:mx2]
            if roi_mask.sum() > 100:
                motion = float(diff[roi_mask == 1].mean())
        self.prev_gray = gray
        machine_moving = bool(motion is not None and motion >= MOTION_MIN_MEAN_DIFF)

        worst: Optional[Dict[str, Any]] = None
        rank = {"OUTSIDE": 0, "ZONE_INTRUSION": 1, "HANDS_IN_MACHINE_AREA": 2}
        for p in persons:
            lms = self.pose.landmarks(frame, p["box"])
            hands = False
            if lms:
                for idx in (15, 16, 19, 20):  # wrists and index fingers
                    pt = lms.get(idx)
                    if pt and pt[2] >= 0.3 and point_in(self.machine, pt[0], pt[1]):
                        hands = True
            st = classify_machinery_sample(p["box"], self.machine, zone, hands)
            color = RED if st == "HANDS_IN_MACHINE_AREA" else ORANGE if st == "ZONE_INTRUSION" else GREEN
            draw.append((p["box"], f"worker {p['score']:.2f}" + (" hands" if hands else ""), color))
            if worst is None or rank[st] > rank[worst["st"]]:
                worst = {"st": st, "p": p, "hands": hands}

        if worst is None:
            return Sample(t=t, frame=frame_no, state="OUTSIDE", summary="Machine located; no worker detected.", draw=draw,
                          metrics={"machine_motion_score": round(motion, 2) if motion is not None else None, "machine_moving": machine_moving})
        st = worst["st"]
        label = {"HANDS_IN_MACHINE_AREA": "Worker reaching into machinery", "ZONE_INTRUSION": "Worker in restricted machinery zone"}.get(st)
        summary = {
            "HANDS_IN_MACHINE_AREA": "A worker's hands are over the machine" + (" while machine movement is detected." if machine_moving else "; machine movement not confirmed."),
            "ZONE_INTRUSION": "A worker is inside the restricted zone around the machine" + (" while machine movement is detected." if machine_moving else "; machine movement not confirmed."),
            "OUTSIDE": "Worker is outside the restricted machinery zone.",
        }[st]
        color = RED if st == "HANDS_IN_MACHINE_AREA" else ORANGE if st == "ZONE_INTRUSION" else GREEN
        return Sample(
            t=t, frame=frame_no, state=st, summary=summary, label=label,
            confidence=min(worst["p"]["score"], self.machine_score or 1.0) if st != "OUTSIDE" else None,
            metrics={"machine_moving": machine_moving, "machine_motion_score": round(motion, 2) if motion is not None else None,
                     "hands_in_machine": worst["hands"], "worker_score": round(worst["p"]["score"], 3), "machine_score": round(self.machine_score or 0, 3)},
            draw=draw, banner=(label, color) if st != "OUTSIDE" else None,
            priority={"HANDS_IN_MACHINE_AREA": 3, "ZONE_INTRUSION": 2}.get(st, 0) + (1 if machine_moving else 0),
        )

    def decide(self, samples: List[Sample]) -> Decision:
        model = "OWLv2 (google/owlv2-base-patch16-ensemble, safetensors) + YOLOv8n COCO + MediaPipe pose"
        note = ("Lowest of the machine (OWLv2) and worker (YOLOv8n) detector scores; a detection score, not the probability of an injury. "
                "Assumes a fixed camera; the restricted zone is the detected machine area plus a margin; machine movement is inferred from frame changes.")
        if self.machine is None:
            return Decision(False, None, None, "No conveyor or machine was detected, so worker proximity could not be evaluated.", note, model)
        active = [i for i, s in enumerate(samples) if s.state in ACTIVE]
        confirmed: Optional[int] = None
        for i in active:
            if samples[i].state == "HANDS_IN_MACHINE_AREA" or (i + 1 < len(samples) and samples[i + 1].state in ACTIVE):
                confirmed = i
                break
        if confirmed is None:
            if active:
                return Decision(False, None, None, "A worker briefly entered the machine zone in a single sample; this does not meet the rule (hands over the machine, or two consecutive samples in the zone).", note, model)
            return Decision(False, None, None, "A machine and workers were detected; no worker entered the restricted zone.", note, model)
        ev = samples[confirmed]
        n_hands = sum(1 for s in samples if s.state == "HANDS_IN_MACHINE_AREA")
        moving = any(s.metrics.get("machine_moving") for s in samples if s.state in ACTIVE)
        return Decision(
            True, ev.label, ev,
            f"{ev.label} at {ev.t:.2f}s: {'hands over the machine in ' + str(n_hands) + ' sampled frame(s); ' if n_hands else ''}"
            f"worker inside the restricted zone across {len(active)} sampled frame(s). "
            f"{'Machine movement was detected in the zone.' if moving else 'Machine movement could not be confirmed from the footage.'}",
            note, model, confidence=ev.confidence,
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--models-dir", required=True)
    ap.add_argument("--yolo-weights", required=True)
    ap.add_argument("--pose-model", required=True)
    ap.add_argument("--evidence-out", required=True)
    ap.add_argument("--annotated-out", default="")
    a = ap.parse_args()
    return run_scenario(a.video, a.evidence_out, a.annotated_out, MachineryAnalyzer(a.models_dir, a.yolo_weights, a.pose_model), sample_seconds=1.0)


if __name__ == "__main__":
    raise SystemExit(main_guard(main))
