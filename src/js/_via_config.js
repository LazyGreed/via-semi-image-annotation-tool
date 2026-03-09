"use strict";

const _VIA_NAME = "VIA Quadrilateral Annotator";
const _VIA_NAME_SHORT = "VIA-QUAD";
const _VIA_VERSION = "4.0.0";

const _VIA_CONFIG = {
  MSG_TIMEOUT: 3000,
  OCR_ENDPOINT: "http://127.0.0.1:8765",
  OCR_TIMEOUT_MS: 30000,
  PDF_RENDER_DPI: 400,
  PDF_BASE_DPI: 72,
  PDF_RENDER_SCALE: 400 / 72,
  PDFJS_WORKER_URL:
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
};

var _VIA_FLOAT_FIXED_POINT = 3;
