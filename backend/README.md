# OCR Backend (`PP-OCRv5`)

This service provides local text detection for the image annotator.

## Python and Dependencies

- Python: `3.12`
- Packages:

```bash
uv pip install "paddleocr[all]"
uv pip install paddlepaddle-gpu==3.2.0 --index https://www.paddlepaddle.org.cn/packages/stable/cu126/
uv pip install flask
```

## Run

From repository root:

```bash
uv run backend/ocr_service.py

# or
python backend/ocr_service.py
```

By default, service listens on:

- `http://127.0.0.1:8765`

Optional environment variables:

- `VIA_OCR_HOST` (default `127.0.0.1`)
- `VIA_OCR_PORT` (default `8765`)
- `VIA_OCR_MODEL_NAME` (default `PP-OCRv5_mobile_det`)
- `VIA_OCR_MODEL_DIR` (default `PP-OCRv5_mobile_det_infer`)

Notes:

- The service sets `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` automatically to avoid startup host checks for local-model usage.
- `ccache` warnings from paddle are optional and do not block inference.

## API

### `GET /health`

Response:

```json
{ "status": "ok" }
```

### `POST /detect`

Multipart form field:

- `image`: image file bytes

Response:

```json
{"boxes":[[x1,y1,x2,y2,x3,y3,x4,y4], ...]}
```

## Credit and License

This backend uses PaddleOCR and a bundled `PP-OCRv5_mobile_det_infer` model directory.

- PaddleOCR upstream: https://github.com/PaddlePaddle/PaddleOCR
- Attribution details: [../CREDITS.md](../CREDITS.md)
- PaddleOCR Apache 2.0 license: [../THIRD_PARTY_LICENSES/PaddleOCR-LICENSE](../THIRD_PARTY_LICENSES/PaddleOCR-LICENSE)
