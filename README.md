# VIA Image-Only Quadrilateral Annotator

This repository is refactored to a focused image annotation tool with:

- image-only workflow
- quadrilateral-only annotation (`[x1,y1,x2,y2,x3,y3,x4,y4]`)
- semi-annotation using `PP-OCRv5_mobile_det_infer`
- drag-to-refine vertices after detection
- image-centric JSON export

## Frontend

Main entry:

- `src/html/_via_image_annotator.html`

Open it in a browser (or serve `src/` with a static server).

Toolbar actions:

- `Add Images`: load local images
- `Detect`: run OCR on current image and replace existing boxes
- `Export JSON`: write image-centric quadrilateral JSON
- `Save Project`: write `via_project_*.zip` with `project.json` + embedded images
- `Open Project`: load project from `.zip` (preferred) or legacy `.json`

## OCR Backend

See [backend/README.md](backend/README.md).

Expected backend endpoint:

- `http://127.0.0.1:8765`

### API

- `GET /health` -> `{"status":"ok"}`
- `POST /detect` (multipart `image`) -> `{"boxes":[[x1,y1,x2,y2,x3,y3,x4,y4], ...]}`

## Dependencies (you install/manage)

- Python: `3.12`
- Python packages:
  - `flask`
  - `paddleocr`
  - `paddlepaddle-gpu`

## Export Format

`Export JSON` outputs:

```json
{
  "version": "via-quad-v1",
  "images": [
    {
      "fid": "1",
      "filename": "image.jpg",
      "width": 1920,
      "height": 1080,
      "boxes": [
        [x1,y1,x2,y2,x3,y3,x4,y4]
      ]
    }
  ]
}
```

Boxes are normalized to deterministic order:

- clockwise order
- first vertex is top-left
