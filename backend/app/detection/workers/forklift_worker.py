"""Forklift–pedestrian near-miss worker: OWLv2 (forklift) + YOLOv8n COCO (people) + proximity rules."""
import argparse
import os
from typing import Any, Dict, List, Optional

from risk_logic import (
    CLOSE_PROXIMITY_PH,
    FORKLIFT_MOVING_WIDTHS_PER_S,
    NEAR_MISS_PH,
    centre,
    classify_forklift_sample,
    estimated_metres,
    forklift_speed_widths_per_s,
    ground_distance_ph,
    is_operator,
    near_miss_confirmed,
)
from scenario_runner import Decision, Sample, main_guard, run_scenario
from vision_common import ModelNotAvailable, detect_persons, load_owlv2, owl_detect

FORKLIFT_QUERY = "a forklift"
FORKLIFT_MIN_SCORE = 0.35
RED, ORANGE, GREEN, BLUE = (40, 40, 220), (0, 140, 255), (60, 160, 60), (200, 120, 30)


class ForkliftAnalyzer:
    model_label = "OWLv2 forklift detector + YOLOv8n pedestrian detector"

    def __init__(self, models_dir: str, yolo_weights: str) -> None:
        self.models_dir, self.yolo_weights = models_dir, yolo_weights
        self.processor = self.owl = self.yolo = None
        self.prev_forklifts: List[Any] = []
        self.prev_distance: Optional[float] = None
        self.prev_t: Optional[float] = None

    def load(self) -> None:
        from ultralytics import YOLO

        if not os.path.isfile(self.yolo_weights):
            raise ModelNotAvailable(f"YOLOv8n weights not found: {os.path.basename(self.yolo_weights)}")
        self.processor, self.owl = load_owlv2(self.models_dir)
        self.yolo = YOLO(self.yolo_weights)

    def process(self, frame, t: float, frame_no: int) -> Sample:
        forklifts = [d for d in owl_detect(self.processor, self.owl, frame, [FORKLIFT_QUERY], 0.2) if d["score"] >= FORKLIFT_MIN_SCORE]
        persons = detect_persons(self.yolo, frame, conf=0.35)
        draw = [(f["box"], f"forklift {f['score']:.2f}", BLUE) for f in forklifts]
        if not forklifts:
            self.prev_forklifts, self.prev_distance, self.prev_t = [], None, t
            draw += [(p["box"], f"person {p['score']:.2f}", GREEN) for p in persons]
            return Sample(t=t, frame=frame_no, state="CLEAR", summary="No forklift detected in this frame.", draw=draw)

        pedestrians = [p for p in persons if not any(is_operator(p["box"], f["box"]) for f in forklifts)]
        operators = [p for p in persons if p not in pedestrians]
        draw += [(p["box"], f"operator {p['score']:.2f}", GREEN) for p in operators]

        best: Optional[Dict[str, Any]] = None
        for p in pedestrians:
            for f in forklifts:
                d = ground_distance_ph(p["box"], f["box"])
                if best is None or d < best["d"]:
                    best = {"d": d, "p": p, "f": f}
        if best is None:
            self.prev_forklifts, self.prev_distance, self.prev_t = forklifts, None, t
            return Sample(t=t, frame=frame_no, state="CLEAR", summary="Forklift present; no pedestrian detected.", draw=draw)

        # forklift motion from the nearest previous forklift (centre distance), per second
        speed = None
        if self.prev_forklifts and self.prev_t is not None:
            fc = centre(best["f"]["box"])
            prev = min(self.prev_forklifts, key=lambda g: (centre(g["box"])[0] - fc[0]) ** 2 + (centre(g["box"])[1] - fc[1]) ** 2)
            speed = forklift_speed_widths_per_s(prev["box"], best["f"]["box"], t - self.prev_t)
        moving = bool(speed is not None and speed >= FORKLIFT_MOVING_WIDTHS_PER_S)
        closing = bool(self.prev_distance is not None and best["d"] < 0.85 * self.prev_distance)
        state = classify_forklift_sample(best["d"], moving, closing)
        self.prev_forklifts, self.prev_distance, self.prev_t = forklifts, best["d"], t

        color = RED if state == "NEAR_MISS" else ORANGE if state == "CLOSE_PROXIMITY" else GREEN
        draw += [(p["box"], f"pedestrian {p['score']:.2f}", ORANGE if p is best["p"] else GREEN) for p in pedestrians]
        conf = min(best["p"]["score"], best["f"]["score"])
        label = {"NEAR_MISS": "Forklift–Pedestrian Near Miss", "CLOSE_PROXIMITY": "Pedestrian close to forklift"}.get(state)
        approx = estimated_metres(best["d"])
        summary = (
            f"Pedestrian ≈{approx:.1f} m (est.) from the forklift footprint; forklift "
            f"{'moving' if moving else 'not clearly moving'}{', distance closing' if closing else ''}."
        )
        return Sample(
            t=t, frame=frame_no, state=state, summary=summary, confidence=conf, label=label,
            metrics={"distance_person_heights": round(best["d"], 2), "estimated_distance_m": round(approx, 2), "forklift_moving": moving,
                     "forklift_speed_widths_per_s": round(speed, 2) if speed is not None else None, "closing": closing,
                     "forklift_score": round(best["f"]["score"], 3), "pedestrian_score": round(best["p"]["score"], 3)},
            draw=draw, banner=(f"{state.replace('_', ' ')}  ~{approx:.1f} m", color) if state != "CLEAR" else None,
            priority=(3 - min(best["d"], 3)) + (1 if state == "NEAR_MISS" else 0),
        )

    def decide(self, samples: List[Sample]) -> Decision:
        seq = [s for s in samples if "distance_person_heights" in s.metrics]
        states = [s.state for s in seq]
        dists = [s.metrics["distance_person_heights"] for s in seq]
        model = "OWLv2 (google/owlv2-base-patch16-ensemble, safetensors) + YOLOv8n COCO"
        note = ("Lowest of the forklift (OWLv2) and pedestrian (YOLOv8n) detector scores; a detection score, not the probability of an incident. "
                "Distances are image-plane estimates scaled by pedestrian height (1.7 m assumed).")
        if near_miss_confirmed(states, dists):
            first = next(i for i, s in enumerate(states) if s == "NEAR_MISS")
            ev = seq[first]
            nm = [s for s in seq if s.state == "NEAR_MISS"]
            tightest = min(nm, key=lambda s: s.metrics["distance_person_heights"])
            return Decision(
                True, "Forklift–Pedestrian Near Miss", ev,
                f"Near miss detected at {ev.t:.2f}s: a pedestrian came within ≈{tightest.metrics['estimated_distance_m']:.1f} m (estimated) of a moving forklift "
                f"across {len(nm)} sampled frame(s). Detector scores: forklift {tightest.metrics['forklift_score']:.2f}, pedestrian {tightest.metrics['pedestrian_score']:.2f}.",
                note, model, confidence=ev.confidence,
            )
        close = [s for s in seq if s.state in ("CLOSE_PROXIMITY", "NEAR_MISS")]
        if close:
            m = min(s.metrics["distance_person_heights"] for s in close)
            return Decision(False, None, None, f"Forklift and pedestrian were detected; closest approach ≈{estimated_metres(m):.1f} m (estimated), which does not meet the near-miss rule "
                            f"(≤{NEAR_MISS_PH:.1f} person-heights with a moving forklift, on consecutive samples).", note, model)
        if any("forklift_score" in s.metrics for s in seq):
            return Decision(False, None, None, "Forklift and pedestrian were detected but never came within the proximity thresholds.", note, model)
        return Decision(False, None, None, "No forklift and pedestrian pair was detected in the sampled frames.", note, model)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--models-dir", required=True)
    ap.add_argument("--yolo-weights", required=True)
    ap.add_argument("--evidence-out", required=True)
    ap.add_argument("--annotated-out", default="")
    a = ap.parse_args()
    return run_scenario(a.video, a.evidence_out, a.annotated_out, ForkliftAnalyzer(a.models_dir, a.yolo_weights), sample_seconds=1.0)


if __name__ == "__main__":
    raise SystemExit(main_guard(main))
