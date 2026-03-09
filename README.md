# VIA Image-Only Quadrilateral Annotator

This repository is refactored to a focused image annotation tool with:

- image-only workflow
- quadrilateral-only annotation (`[x1,y1,x2,y2,x3,y3,x4,y4]`)
- semi-annotation using `PP-OCRv5_server_det_infer`
- drag-to-refine vertices after detection
- PDF upload with page rasterization for annotation (`400 DPI`, scale `400/72`)
- image-centric JSON export
- ICDAR 2015-style dataset export
- selected-box transcription and ignore (`###`) editing

## Frontend

Main entry:

- `src/html/_via_image_annotator.html`

Open it in a browser (or serve `src/` with a static server).

Note: PDF import uses `pdf.js` loaded from CDN in `src/html/_via_image_annotator.html`.

Toolbar actions:

- `Add Images`: load local images
- `Add PDF`: load PDF(s), rasterize each page at `400 DPI` (`scale=400/72`), and add pages as PNG images
- `Detect`: run OCR on current image and replace existing boxes
- `Selected Box`: set transcription text or mark ignore (`###`) for the selected quadrilateral
- `Export JSON`: write image-centric quadrilateral JSON
- `Export ICDAR 2015`: write `icdar2015_export_*.zip` with `images/` and `gt/gt_*.txt`
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

`Export ICDAR 2015` outputs a ZIP file with:

- `images/<image_name>`: image bytes
- `gt/gt_<image_stem>.txt`: one annotation file per image

Each ground-truth text line follows ICDAR 2015 text localization format:

```text
x1,y1,x2,y2,x3,y3,x4,y4,transcription
```

Notes:

- Coordinates are integer pixel coordinates, normalized clockwise with top-left as first point.
- If no transcription is available, `###` is used (ICDAR "do not care" token).
- You can set transcription per selected box from the `Selected Box` toolbar editor.
- Use `Ignore (###)` to explicitly mark a region as "do not care".
- Empty annotation files are still created for images without boxes.

## Credit and License

This project includes third-party components from:

- [VIA (VGG Image Annotator)](https://github.com/ox-vgg/via), with VIA-derived source code and local modifications.
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), used by the OCR backend and bundled `PP-OCRv5_server_det_infer` model assets.

- Upstream attribution and credit: [CREDITS.md](CREDITS.md)
- VIA license text used for VIA-derived portions: [LICENSE](LICENSE)
- PaddleOCR license text (Apache 2.0): [THIRD_PARTY_LICENSES/PaddleOCR-LICENSE](THIRD_PARTY_LICENSES/PaddleOCR-LICENSE)
