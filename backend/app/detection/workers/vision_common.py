"""
Shared building blocks for the open-vocabulary video workers (forklift, machinery, ladder).

Model security
--------------
* The object detector is Google's OWLv2 (Apache-2.0), loaded ONLY from a local ``model.safetensors``
  file (pure tensor data, no pickle / no code execution) with ``local_files_only=True`` and
  ``trust_remote_code`` never enabled.
* The file's SHA-256 must equal the pinned value before the model is built; a missing or modified
  file raises ``ModelNotAvailable`` — no other model is silently substituted.
* People are detected with the YOLOv8n COCO weights already used by the egress pipeline.
"""
from __future__ import annotations

import hashlib
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np

Box = Tuple[float, float, float, float]

# Pinned model identity (google/owlv2-base-patch16-ensemble, revision cfd3195ba4…, Apache-2.0)
OWL_DIR_NAME = "owlv2-base-patch16-ensemble"
OWL_SAFETENSORS_SHA256 = "e1e130b9e404cf91a75ad45644c1da9d7fa5284085eecc864266a6923efb99e7"


class ModelNotAvailable(RuntimeError):
    """The required model files are missing, unverifiable or the runtime lacks a dependency."""


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_owlv2(models_dir: str):
    """Verify and load OWLv2 from safetensors. Returns (processor, model)."""
    model_dir = os.path.join(models_dir, OWL_DIR_NAME)
    weights = os.path.join(model_dir, "model.safetensors")
    if not os.path.isfile(weights):
        raise ModelNotAvailable(f"OWLv2 weights not found at {weights}.")
    if sha256_file(weights).lower() != OWL_SAFETENSORS_SHA256:
        raise ModelNotAvailable("OWLv2 model.safetensors failed SHA-256 verification; refusing to load it.")
    try:
        from transformers import Owlv2ForObjectDetection, Owlv2Processor
    except Exception as exc:  # pragma: no cover - depends on the CV runtime
        raise ModelNotAvailable(f"transformers is not available in the CV runtime: {exc}") from exc
    processor = Owlv2Processor.from_pretrained(model_dir, local_files_only=True)
    model = Owlv2ForObjectDetection.from_pretrained(model_dir, local_files_only=True, use_safetensors=True).eval()
    return processor, model


def iou(a: Box, b: Box) -> float:
    ix1, iy1, ix2, iy2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def owl_detect(processor, model, frame_bgr: np.ndarray, queries: Sequence[str], threshold: float) -> List[Dict[str, Any]]:
    """Run OWLv2 on one frame. Returns [{label, score, box}] after per-label NMS (scores are raw detector scores)."""
    import torch
    from PIL import Image

    rgb = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
    inputs = processor(text=[list(queries)], images=rgb, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    side = max(rgb.size)  # OWLv2 pads to a square; boxes are relative to the padded image
    res = processor.post_process_grounded_object_detection(
        outputs=outputs, threshold=threshold, target_sizes=torch.tensor([[side, side]]), text_labels=[list(queries)]
    )[0]
    h, w = frame_bgr.shape[:2]
    dets: List[Dict[str, Any]] = []
    for score, label, box in zip(res["scores"], res["labels"], res["boxes"]):
        x1, y1, x2, y2 = [float(v) for v in box.tolist()]
        x1, x2 = max(0.0, min(x1, w)), max(0.0, min(x2, w))
        y1, y2 = max(0.0, min(y1, h)), max(0.0, min(y2, h))
        if x2 - x1 < 4 or y2 - y1 < 4:
            continue
        dets.append({"label": queries[int(label)], "score": float(score), "box": (x1, y1, x2, y2)})
    dets.sort(key=lambda d: -d["score"])
    kept: List[Dict[str, Any]] = []
    for d in dets:  # greedy NMS within each label
        if all(k["label"] != d["label"] or iou(k["box"], d["box"]) < 0.5 for k in kept):
            kept.append(d)
    return kept


def detect_persons(yolo, frame_bgr: np.ndarray, conf: float = 0.35) -> List[Dict[str, Any]]:
    """COCO 'person' boxes from the YOLOv8n weights."""
    result = yolo.predict(frame_bgr, conf=conf, verbose=False)[0]
    out: List[Dict[str, Any]] = []
    if result.boxes is None:
        return out
    for b in result.boxes:
        if str(yolo.names.get(int(b.cls[0]), "")).lower() != "person":
            continue
        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
        out.append({"label": "person", "score": float(b.conf[0]), "box": (x1, y1, x2, y2)})
    return out


class PoseEstimator:
    """MediaPipe PoseLandmarker (Lite) applied to a padded person crop; landmarks mapped to frame pixels."""

    def __init__(self, model_path: str) -> None:
        import mediapipe as mp

        self._mp = mp
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_poses=1,
        )
        self._landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)

    def landmarks(self, frame_bgr: np.ndarray, box: Box, pad: float = 0.15) -> Optional[Dict[int, Tuple[float, float, float]]]:
        h, w = frame_bgr.shape[:2]
        bw, bh = box[2] - box[0], box[3] - box[1]
        x1, y1 = int(max(0, box[0] - pad * bw)), int(max(0, box[1] - pad * bh))
        x2, y2 = int(min(w, box[2] + pad * bw)), int(min(h, box[3] + pad * bh))
        crop = frame_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            return None
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        res = self._landmarker.detect(self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb))
        if not res.pose_landmarks:
            return None
        cw, ch = x2 - x1, y2 - y1
        return {
            i: (x1 + lm.x * cw, y1 + lm.y * ch, float(getattr(lm, "visibility", 1.0) or 0.0))
            for i, lm in enumerate(res.pose_landmarks[0])
        }


def draw_box(frame: np.ndarray, box: Box, label: str, color: Tuple[int, int, int], thickness: int = 2) -> None:
    x1, y1, x2, y2 = [int(v) for v in box]
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
    cv2.rectangle(frame, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), color, -1)
    cv2.putText(frame, label, (x1 + 3, max(10, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)


def banner(frame: np.ndarray, text: str, color: Tuple[int, int, int]) -> None:
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 30), color, -1)
    cv2.putText(frame, text, (10, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
