from __future__ import annotations

import os
import cv2
import numpy as np

from pathlib import Path
from typing import Any, Iterable
from paddleocr import TextDetection
from flask import Flask, jsonify, request

# Skip network source checks on startup; we use a local model directory.
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")


APP_HOST = os.environ.get("VIA_OCR_HOST", "127.0.0.1")
APP_PORT = int(os.environ.get("VIA_OCR_PORT", "8765"))
MODEL_NAME = os.environ.get("VIA_OCR_MODEL_NAME", "PP-OCRv5_mobile_det")
DEFAULT_MODEL_DIR = (
    Path(__file__).resolve().parent.parent / "PP-OCRv5_mobile_det_infer"
)
MODEL_DIR = Path(os.environ.get("VIA_OCR_MODEL_DIR", str(DEFAULT_MODEL_DIR)))

app = Flask(__name__)

_detector: TextDetection | None = None


def _get_detector() -> TextDetection:
    global _detector
    if _detector is None:
        _detector = TextDetection(
            model_name=MODEL_NAME,
            model_dir=str(MODEL_DIR),
        )
    return _detector


def _as_dict(pred_item: Any) -> dict[str, Any]:
    if isinstance(pred_item, dict):
        return pred_item
    if hasattr(pred_item, "res") and isinstance(pred_item.res, dict):
        return pred_item.res
    if hasattr(pred_item, "to_dict"):
        data = pred_item.to_dict()
        if isinstance(data, dict):
            return data
    return {}


def _extract_polys(prediction: Any) -> Iterable[np.ndarray]:
    if prediction is None:
        return []

    items = prediction if isinstance(prediction, list) else [prediction]
    polys: list[np.ndarray] = []

    for item in items:
        item_dict = _as_dict(item)
        candidate = None

        if "dt_polys" in item_dict:
            candidate = item_dict["dt_polys"]
        elif "polys" in item_dict:
            candidate = item_dict["polys"]
        elif isinstance(item, dict):
            candidate = item.get("dt_polys") or item.get("polys")

        if candidate is None:
            continue

        for poly in candidate:
            arr = np.asarray(poly, dtype=np.float32).reshape(-1, 2)
            if arr.shape[0] >= 4:
                polys.append(arr[:4])

    return polys


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return resp


@app.route("/health", methods=["GET"])
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.route("/detect", methods=["OPTIONS"])
def detect_options() -> tuple[str, int]:
    return "", 204


@app.route("/detect", methods=["POST"])
def detect() -> tuple[Any, int]:
    image_file = request.files.get("image")
    if image_file is None:
        return jsonify({"error": "missing multipart field 'image'"}), 400

    payload = image_file.read()
    if not payload:
        return jsonify({"error": "empty image payload"}), 400

    arr = np.frombuffer(payload, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        return jsonify({"error": "unable to decode image"}), 400

    try:
        detector = _get_detector()
        prediction = detector.predict(input=image)
        polys = _extract_polys(prediction)

        boxes = []
        for poly in polys:
            flat = []
            for i in range(4):
                flat.append(float(poly[i][0]))
                flat.append(float(poly[i][1]))
            boxes.append(flat)

        return jsonify({"boxes": boxes}), 200
    except Exception as exc:  # noqa: BLE001
        app.logger.exception("OCR detection failed")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host=APP_HOST, port=APP_PORT, debug=False)
