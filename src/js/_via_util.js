/**
 * Utility helpers used by VIA quadrilateral annotator.
 */

"use strict";

var _via_msg_clear_timer;

function _via_util_get_filename_from_uri(uri) {
  if (!uri) {
    return "";
  }
  var tokens = uri.split("/");
  return tokens[tokens.length - 1] || uri;
}

function _via_util_file_ext(filename) {
  var index = filename.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return filename.substr(index + 1);
}

function _via_util_infer_file_loc_from_filename(filename) {
  if (filename.startsWith("http://") || filename.startsWith("https://")) {
    return _VIA_FILE_LOC.URIHTTP;
  }
  if (filename.startsWith("file://") || filename.includes("/")) {
    return _VIA_FILE_LOC.URIFILE;
  }
  return _VIA_FILE_LOC.LOCAL;
}

function _via_util_infer_file_type_from_filename(filename) {
  var ext = _via_util_file_ext(filename).toLowerCase();
  if (
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "png" ||
    ext === "bmp" ||
    ext === "webp"
  ) {
    return _VIA_FILE_TYPE.IMAGE;
  }
  return -1;
}

function _via_util_load_text_file(text_file, callback_function) {
  if (!text_file) {
    callback_function("");
    return;
  }

  var text_reader = new FileReader();
  text_reader.addEventListener(
    "error",
    function () {
      callback_function("");
    },
    false,
  );
  text_reader.addEventListener(
    "load",
    function () {
      callback_function(text_reader.result);
    },
    false,
  );
  text_reader.readAsText(text_file, "utf-8");
}

function _via_util_download_as_file(data, filename) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(data);
  a.download = filename;
  var event = new MouseEvent("click", {
    view: window,
    bubbles: true,
    cancelable: true,
  });
  a.dispatchEvent(event);
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 1000);
}

function _via_util_file_select_local(type, handler, multiple) {
  var fsel = document.createElement("input");
  fsel.setAttribute("type", "file");
  fsel.setAttribute("name", "files[]");

  if (typeof multiple === "undefined" || multiple === true) {
    fsel.setAttribute("multiple", "multiple");
  }

  if (type === _VIA_FILE_SELECT_TYPE.IMAGE) {
    fsel.accept = "image/*";
  } else if (type === _VIA_FILE_SELECT_TYPE.PDF) {
    fsel.accept = ".pdf,application/pdf";
  } else if (type === _VIA_FILE_SELECT_TYPE.JSON) {
    fsel.accept = ".json";
  } else if (type === _VIA_FILE_SELECT_TYPE.PROJECT) {
    fsel.accept = ".json,.zip,application/json,application/zip";
  } else if (type === _VIA_FILE_SELECT_TYPE.TEXT) {
    fsel.accept = ".txt,.csv";
  }

  fsel.onchange = handler;
  fsel.click();
}

function _via_util_load_binary_file(file_obj) {
  return new Promise(function (ok_callback, err_callback) {
    if (!file_obj) {
      err_callback("missing file");
      return;
    }

    if (typeof file_obj.arrayBuffer === "function") {
      file_obj.arrayBuffer().then(
        function (buffer) {
          ok_callback(buffer);
        },
        function (err) {
          err_callback(err);
        },
      );
      return;
    }

    try {
      var file_reader = new FileReader();
      file_reader.addEventListener(
        "error",
        function () {
          err_callback("failed to read file");
        },
        false,
      );
      file_reader.addEventListener(
        "load",
        function () {
          ok_callback(file_reader.result);
        },
        false,
      );
      file_reader.readAsArrayBuffer(file_obj);
    } catch (err) {
      err_callback(err);
    }
  });
}

function _via_util_pdfjs_is_available() {
  return (
    typeof pdfjsLib !== "undefined" &&
    pdfjsLib &&
    typeof pdfjsLib.getDocument === "function"
  );
}

function _via_util_pdfjs_init_worker() {
  if (!_via_util_pdfjs_is_available()) {
    return false;
  }
  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = _VIA_CONFIG.PDFJS_WORKER_URL;
  }
  return true;
}

function _via_util_pdf_name_stem(pdf_filename) {
  var safe_name = _via_util_sanitize_filename(pdf_filename || "document.pdf");
  var dot_index = safe_name.lastIndexOf(".");
  var stem = dot_index > 0 ? safe_name.substr(0, dot_index) : safe_name;
  return stem === "" ? "document" : stem;
}

function _via_util_pdf_to_png_filelist(pdf_file, render_scale) {
  return new Promise(function (ok_callback, err_callback) {
    if (!_via_util_pdfjs_init_worker()) {
      err_callback("PDF support unavailable (pdf.js failed to load)");
      return;
    }

    var scale =
      typeof render_scale === "number" && render_scale > 0
        ? render_scale
        : _VIA_CONFIG.PDF_RENDER_SCALE;
    var filename_stem = _via_util_pdf_name_stem(
      pdf_file.name || "document.pdf",
    );

    _via_util_load_binary_file(pdf_file)
      .then(function (buffer) {
        var pdf_data =
          buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        return pdfjsLib.getDocument({ data: pdf_data }).promise;
      })
      .then(function (pdf_doc) {
        var out = [];

        var render_page = function (page_index) {
          if (page_index > pdf_doc.numPages) {
            ok_callback(out);
            return;
          }

          pdf_doc
            .getPage(page_index)
            .then(function (page) {
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.ceil(viewport.width));
              canvas.height = Math.max(1, Math.ceil(viewport.height));

              var ctx = canvas.getContext("2d", { alpha: false });
              if (!ctx) {
                err_callback("failed to initialize canvas for PDF page render");
                return;
              }

              page
                .render({
                  canvasContext: ctx,
                  viewport: viewport,
                })
                .promise.then(function () {
                  canvas.toBlob(function (blob) {
                    if (!blob) {
                      err_callback("failed to encode PDF page " + page_index);
                      return;
                    }

                    var page_id = ("0000" + page_index).slice(-4);
                    var image_name = filename_stem + "_p" + page_id + ".png";
                    var image_file;

                    if (typeof File === "function") {
                      image_file = new File([blob], image_name, {
                        type: "image/png",
                      });
                    } else {
                      blob.name = image_name;
                      image_file = blob;
                    }

                    out.push({
                      fname: image_name,
                      type: _VIA_FILE_TYPE.IMAGE,
                      loc: _VIA_FILE_LOC.LOCAL,
                      src: image_file,
                    });

                    render_page(page_index + 1);
                  }, "image/png");
                })
                .catch(function (err) {
                  err_callback(err);
                });
            })
            .catch(function (err) {
              err_callback(err);
            });
        };

        render_page(1);
      })
      .catch(function (err) {
        if (err && err.message) {
          err_callback(err.message);
          return;
        }
        err_callback(err);
      });
  });
}

function _via_util_msg_show(msg, sticky) {
  var container = document.getElementById("_via_message_container");
  var content = document.getElementById("_via_message");
  if (!(container && content)) {
    return;
  }

  if (_via_msg_clear_timer) {
    clearTimeout(_via_msg_clear_timer);
  }

  if (typeof sticky === "undefined" || sticky === false) {
    _via_msg_clear_timer = setTimeout(function () {
      var msg_container = document.getElementById("_via_message_container");
      if (msg_container) {
        msg_container.style.display = "none";
      }
    }, _VIA_CONFIG.MSG_TIMEOUT);
  }

  content.innerHTML =
    msg + '<span class="message_panel_close_button">&times;</span>';
  container.style.display = "block";
}

function _via_util_msg_hide() {
  var container = document.getElementById("_via_message_container");
  if (container) {
    container.style.display = "none";
  }
  if (_via_msg_clear_timer) {
    clearTimeout(_via_msg_clear_timer);
  }
}

function _via_util_pad10(x) {
  if (x < 10) {
    return "0" + x.toString();
  }
  return x.toString();
}

function _via_util_date_to_filename_str(date_str) {
  var t = new Date(date_str);
  var month_list = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return (
    _via_util_pad10(t.getDate()) +
    month_list[t.getMonth()] +
    t.getFullYear() +
    "_" +
    _via_util_pad10(t.getHours()) +
    "h" +
    _via_util_pad10(t.getMinutes()) +
    "m" +
    _via_util_pad10(t.getSeconds()) +
    "s"
  );
}

function _via_util_float_arr_to_fixed(arr, fixed) {
  var farr = [];
  for (var i = 0; i < arr.length; ++i) {
    farr.push(parseFloat(arr[i].toFixed(fixed)));
  }
  return farr;
}

function _via_util_float_to_fixed(value, fixed) {
  return parseFloat(value.toFixed(fixed));
}

function _via_util_array_eq(a, b) {
  if (a == null || b == null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function _via_util_uuid() {
  var temp_url = URL.createObjectURL(new Blob());
  var uuid = temp_url.toString();
  URL.revokeObjectURL(temp_url);
  var slash_index = uuid.lastIndexOf("/");
  if (slash_index !== -1) {
    uuid = uuid.substr(slash_index + 1);
    uuid = uuid.replace(/-/g, "");
  }
  return uuid;
}

function _via_util_uid6() {
  var temp_url = URL.createObjectURL(new Blob());
  var uuid = temp_url.toString();
  URL.revokeObjectURL(temp_url);
  var n = uuid.length;
  var uuid_suffix_str = "";
  for (var i = n - 12; i < n; i = i + 2) {
    uuid_suffix_str += String.fromCharCode(parseInt(uuid.substr(i, 2), 16));
  }
  return btoa(uuid_suffix_str).replace(/[-+/_]/gi, "X");
}

function _via_util_clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function _via_util_fetch_blob(uri, timeout_ms) {
  var timeout =
    typeof timeout_ms === "number" ? timeout_ms : _VIA_CONFIG.OCR_TIMEOUT_MS;
  return new Promise(function (ok_callback, err_callback) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, timeout);

    fetch(uri, { signal: controller.signal })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("Failed to read image: HTTP " + resp.status);
        }
        return resp.blob();
      })
      .then(function (blob) {
        clearTimeout(timer);
        ok_callback(blob);
      })
      .catch(function (err) {
        clearTimeout(timer);
        err_callback(err);
      });
  });
}

function _via_util_ocr_detect(image_blob) {
  return new Promise(function (ok_callback, err_callback) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, _VIA_CONFIG.OCR_TIMEOUT_MS);

    var fd = new FormData();
    fd.append("image", image_blob, "image.png");

    fetch(_VIA_CONFIG.OCR_ENDPOINT + "/detect", {
      method: "POST",
      body: fd,
      signal: controller.signal,
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp
            .json()
            .then(function (err_payload) {
              var detail = "";
              if (
                err_payload &&
                typeof err_payload.error === "string" &&
                err_payload.error.length
              ) {
                detail = ": " + err_payload.error;
              }
              throw new Error(
                "OCR server returned HTTP " + resp.status + detail,
              );
            })
            .catch(function () {
              throw new Error("OCR server returned HTTP " + resp.status);
            });
        }
        return resp.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        ok_callback(data);
      })
      .catch(function (err) {
        clearTimeout(timer);
        err_callback(err);
      });
  });
}

function _via_util_quad_signed_area(flat_points) {
  var area2 = 0;
  for (var i = 0; i < 4; ++i) {
    var x1 = flat_points[2 * i];
    var y1 = flat_points[2 * i + 1];
    var j = (i + 1) % 4;
    var x2 = flat_points[2 * j];
    var y2 = flat_points[2 * j + 1];
    area2 += x1 * y2 - x2 * y1;
  }
  return area2 / 2.0;
}

function _via_util_normalize_quad_points(flat_points) {
  if (!Array.isArray(flat_points) || flat_points.length !== 8) {
    return [];
  }

  var pts = [];
  for (var i = 0; i < 4; ++i) {
    pts.push({ x: flat_points[2 * i], y: flat_points[2 * i + 1] });
  }

  var cx = 0;
  var cy = 0;
  for (var pindex = 0; pindex < 4; ++pindex) {
    cx += pts[pindex].x;
    cy += pts[pindex].y;
  }
  cx = cx / 4.0;
  cy = cy / 4.0;

  pts.sort(function (a, b) {
    var aa = Math.atan2(a.y - cy, a.x - cx);
    var bb = Math.atan2(b.y - cy, b.x - cx);
    return aa - bb;
  });

  var sorted = [];
  for (var sindex = 0; sindex < 4; ++sindex) {
    sorted.push(pts[sindex].x, pts[sindex].y);
  }

  // In image coordinates (y down), positive area implies clockwise order.
  if (_via_util_quad_signed_area(sorted) < 0) {
    var rev = [
      sorted[0],
      sorted[1],
      sorted[6],
      sorted[7],
      sorted[4],
      sorted[5],
      sorted[2],
      sorted[3],
    ];
    sorted = rev;
  }

  // rotate so first point is top-left (min y, then min x)
  var min_index = 0;
  for (var m = 1; m < 4; ++m) {
    var my = sorted[2 * m + 1];
    var mx = sorted[2 * m];
    var cury = sorted[2 * min_index + 1];
    var curx = sorted[2 * min_index];
    if (my < cury || (my === cury && mx < curx)) {
      min_index = m;
    }
  }
  if (min_index !== 0) {
    var rotated = [];
    for (var r = 0; r < 4; ++r) {
      var idx = (min_index + r) % 4;
      rotated.push(sorted[2 * idx], sorted[2 * idx + 1]);
    }
    sorted = rotated;
  }

  return _via_util_float_arr_to_fixed(sorted, _VIA_FLOAT_FIXED_POINT);
}

function _via_util_sanitize_filename(filename) {
  if (!filename) {
    return "";
  }
  return filename.replace(/[\\/:*?"<>|]/g, "_");
}

function _via_util_infer_mime_type_from_filename(filename) {
  var ext = _via_util_file_ext(filename).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }
  if (ext === "png") {
    return "image/png";
  }
  if (ext === "bmp") {
    return "image/bmp";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  if (ext === "gif") {
    return "image/gif";
  }
  if (ext === "json") {
    return "application/json";
  }
  return "application/octet-stream";
}

function _via_util_uint8_to_text(data) {
  if (!data || !data.length) {
    return "";
  }
  var decoder = new TextDecoder("utf-8");
  return decoder.decode(data);
}

function _via_util_text_to_uint8(text) {
  var encoder = new TextEncoder();
  return encoder.encode(text || "");
}

function _via_util_uint8_to_file(data, filename, mime_type) {
  var blob = new Blob([data], {
    type: mime_type || _via_util_infer_mime_type_from_filename(filename),
  });
  if (typeof File === "function") {
    return new File([blob], filename, { type: blob.type });
  }
  blob.name = filename;
  return blob;
}

function _via_util_arraybuffer_to_uint8(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(data);
}

var _via_util_crc32_lut = null;

function _via_util_crc32(data) {
  if (_via_util_crc32_lut === null) {
    _via_util_crc32_lut = [];
    for (var n = 0; n < 256; ++n) {
      var c = n;
      for (var k = 0; k < 8; ++k) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1);
        } else {
          c = c >>> 1;
        }
      }
      _via_util_crc32_lut[n] = c >>> 0;
    }
  }

  var bytes = _via_util_arraybuffer_to_uint8(data);
  var crc = 0 ^ -1;
  for (var i = 0; i < bytes.length; ++i) {
    crc = (crc >>> 8) ^ _via_util_crc32_lut[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function _via_util_u16le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function _via_util_u32le(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function _via_util_zip_extract(zip_file_or_buffer) {
  return new Promise(function (ok_callback, err_callback) {
    var read_promise;
    if (zip_file_or_buffer instanceof ArrayBuffer) {
      read_promise = Promise.resolve(zip_file_or_buffer);
    } else if (
      zip_file_or_buffer &&
      typeof zip_file_or_buffer.arrayBuffer === "function"
    ) {
      read_promise = zip_file_or_buffer.arrayBuffer();
    } else {
      err_callback("invalid zip input");
      return;
    }

    read_promise.then(
      function (buffer) {
        try {
          var bytes = new Uint8Array(buffer);
          var decoder = new TextDecoder("utf-8");
          var entries = {};
          var offset = 0;

          while (offset + 4 <= bytes.length) {
            var signature = _via_util_u32le(bytes, offset);
            if (signature === 0x04034b50) {
              if (offset + 30 > bytes.length) {
                throw new Error("invalid zip local header");
              }

              var flags = _via_util_u16le(bytes, offset + 6);
              var method = _via_util_u16le(bytes, offset + 8);
              var comp_size = _via_util_u32le(bytes, offset + 18);
              var name_len = _via_util_u16le(bytes, offset + 26);
              var extra_len = _via_util_u16le(bytes, offset + 28);

              if (flags & 0x08) {
                throw new Error("unsupported zip (data descriptor)");
              }
              if (method !== 0) {
                throw new Error("unsupported zip compression method");
              }

              var name_start = offset + 30;
              var name_end = name_start + name_len;
              var data_start = name_end + extra_len;
              var data_end = data_start + comp_size;

              if (data_end > bytes.length) {
                throw new Error("invalid zip entry size");
              }

              var entry_name = decoder.decode(
                bytes.slice(name_start, name_end),
              );
              entries[entry_name] = bytes.slice(data_start, data_end);
              offset = data_end;
              continue;
            }

            if (signature === 0x02014b50 || signature === 0x06054b50) {
              break;
            }

            throw new Error("unsupported zip format");
          }

          ok_callback(entries);
        } catch (err) {
          err_callback(err);
        }
      },
      function (err) {
        err_callback(err);
      },
    );
  });
}

function _via_util_zip_create_blob(file_entries) {
  return new Promise(function (ok_callback, err_callback) {
    try {
      var utf8 = new TextEncoder();
      var local_chunks = [];
      var central_chunks = [];
      var local_offset = 0;
      var central_size = 0;

      for (var i = 0; i < file_entries.length; ++i) {
        var entry = file_entries[i];
        var entry_name_bytes = utf8.encode(entry.name);
        var entry_data = _via_util_arraybuffer_to_uint8(entry.data);
        var crc32 = _via_util_crc32(entry_data);
        var entry_size = entry_data.length;

        var local_header = new Uint8Array(30 + entry_name_bytes.length);
        var local_header_view = new DataView(local_header.buffer);
        local_header_view.setUint32(0, 0x04034b50, true);
        local_header_view.setUint16(4, 20, true);
        local_header_view.setUint16(6, 0x0800, true); // UTF-8 file name
        local_header_view.setUint16(8, 0, true); // store (no compression)
        local_header_view.setUint16(10, 0, true); // time
        local_header_view.setUint16(12, 0, true); // date
        local_header_view.setUint32(14, crc32, true);
        local_header_view.setUint32(18, entry_size, true);
        local_header_view.setUint32(22, entry_size, true);
        local_header_view.setUint16(26, entry_name_bytes.length, true);
        local_header_view.setUint16(28, 0, true);
        local_header.set(entry_name_bytes, 30);

        local_chunks.push(local_header);
        local_chunks.push(entry_data);

        var central_header = new Uint8Array(46 + entry_name_bytes.length);
        var central_header_view = new DataView(central_header.buffer);
        central_header_view.setUint32(0, 0x02014b50, true);
        central_header_view.setUint16(4, 20, true);
        central_header_view.setUint16(6, 20, true);
        central_header_view.setUint16(8, 0x0800, true);
        central_header_view.setUint16(10, 0, true);
        central_header_view.setUint16(12, 0, true);
        central_header_view.setUint16(14, 0, true);
        central_header_view.setUint32(16, crc32, true);
        central_header_view.setUint32(20, entry_size, true);
        central_header_view.setUint32(24, entry_size, true);
        central_header_view.setUint16(28, entry_name_bytes.length, true);
        central_header_view.setUint16(30, 0, true);
        central_header_view.setUint16(32, 0, true);
        central_header_view.setUint16(34, 0, true);
        central_header_view.setUint16(36, 0, true);
        central_header_view.setUint32(38, 0, true);
        central_header_view.setUint32(42, local_offset, true);
        central_header.set(entry_name_bytes, 46);

        central_chunks.push(central_header);
        central_size += central_header.length;
        local_offset += local_header.length + entry_data.length;
      }

      var eocd = new Uint8Array(22);
      var eocd_view = new DataView(eocd.buffer);
      eocd_view.setUint32(0, 0x06054b50, true);
      eocd_view.setUint16(4, 0, true);
      eocd_view.setUint16(6, 0, true);
      eocd_view.setUint16(8, file_entries.length, true);
      eocd_view.setUint16(10, file_entries.length, true);
      eocd_view.setUint32(12, central_size, true);
      eocd_view.setUint32(16, local_offset, true);
      eocd_view.setUint16(20, 0, true);

      var zip_chunks = local_chunks.concat(central_chunks);
      zip_chunks.push(eocd);
      ok_callback(new Blob(zip_chunks, { type: "application/zip" }));
    } catch (err) {
      err_callback(err);
    }
  });
}
