# Video detection readiness

Readiness is reported live by `GET /api/v1/detection/models/status`. A scenario is `configured` only when
every required artefact exists **and** the OWLv2 weights pass their pinned SHA-256 check. Adding a video
never makes a model ready, and a missing or modified model file turns the scenario back to
`MODEL_NOT_CONFIGURED` (nothing else is substituted).

| # | Scenario | Pipeline | Status |
|---|----------|----------|--------|
| 1 | Fall & Posture | OpenFall + MediaPipe PoseLandmarker | Configured, validated |
| 2 | Smoke & Fire | YOLOv8 smoke/fire weights | Configured, validated |
| 3 | Emergency Exit Obstruction | YOLOv8n COCO egress monitor | Configured, validated |
| 4 | Forklift–Pedestrian Near Miss | OWLv2 (forklift) + YOLOv8n (people) + proximity rules | Configured, validated on the supplied clip |
| 5 | Moving Machinery Proximity | OWLv2 (machine) + YOLOv8n + MediaPipe pose + zone rules | Configured, validated on the supplied clip |
| 6 | Unsafe Climbing / Working at Height | OWLv2 (ladder) + YOLOv8n + MediaPipe pose + posture rules | Configured, validated on the supplied clip |

## Model provenance and safety (scenarios 4–6)

* **Detector:** `google/owlv2-base-patch16-ensemble` (Apache-2.0), revision `cfd3195ba4`. Open-vocabulary
  object detector queried with plain-text names ("a forklift", "a conveyor belt", "an industrial machine", "a ladder").
* **Loading:** from a local `model.safetensors` only (pure tensor data — no pickle, no code execution),
  `local_files_only=True`, `trust_remote_code` never used. SHA-256 pinned in
  `workers/vision_common.py` and `open_vocab_services.py`:
  `e1e130b9e404cf91a75ad45644c1da9d7fa5284085eecc864266a6923efb99e7`. A missing or different file exits with
  `MODEL_NOT_CONFIGURED` (exit code 3) and the readiness status goes false.
* **People:** the YOLOv8n COCO weights already used by the egress pipeline. **Pose:** the existing MediaPipe
  PoseLandmarker Lite model.
* **Rejected:** the community `keremberke/yolov8n-forklift-detection` `.pt` checkpoint (a pickle that executes
  code on load) is not used; OWLv2 detects forklifts from the safetensors file instead.
* Model weights live in `backend/models_cache/` (≈620 MB, not committed).

## What each pipeline reports

| Scenario | Rule (named constants in `workers/risk_logic.py`) | Alert severity |
|---|---|---|
| Forklift–pedestrian | Pedestrian feet within 1.0 person-height (~1.7 m, image-plane estimate) of the forklift footprint while it moves or the gap is closing; or ≤0.5 person-heights; confirmed on 2 consecutive samples or at contact distance. Seated operators are excluded. | CRITICAL |
| Machinery | Worker's hands (pose wrists/fingers) over the detected machine, or the worker's feet inside the machine zone (machine box + 6 % margin) with overlap, confirmed by hands or 2 consecutive samples. Machine movement is inferred from frame changes inside the machine area. | CRITICAL (hands + movement), HIGH, MEDIUM |
| Ladder | Worker's feet ≥12 % of the ladder height above its base on 2 consecutive samples. Unsafe posture = lateral overreach ≥1.1× torso length or torso lean ≥20° (MediaPipe pose). | HIGH (unsafe posture), MEDIUM (at height only) |

Every event carries real timestamps, an evidence frame, an annotated video, and the detector scores
(lowest of the object and person scores — a detection score, **not** the probability of an incident).

## Known limitations (be honest about these)

* **Validated on one clip per scenario.** Thresholds are initial defaults set by inspecting those clips;
  they are not statistically validated. Expect to tune them on your own footage.
* **Ladder stability, footing and fall-arrest equipment are NOT measured and never claimed.** Only observable
  posture is reported.
* Distances are image-plane estimates scaled by the pedestrian's height (1.7 m assumed), not surveyed metres.
* The machinery pipeline assumes a **fixed camera** (the machine is located on the first sampled frames) and
  infers motion from pixel changes, so a stationary or fully occluded machine may read as "movement not confirmed".
* Frames are sampled about once per second (OWLv2 is heavy on CPU: roughly 2–3 minutes for a 10-second clip).
  The annotated video holds the latest detections between samples.
* OWLv2 can produce false positives (e.g. a rack upright scored as a "ladder"); only the evaluated object is drawn,
  and a human reviews every alert.
