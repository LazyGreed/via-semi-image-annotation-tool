/**
 * @class
 * @classdesc Image quadrilateral annotator with draggable vertices.
 */

"use strict";

function _via_file_annotator(view_annotator, data, vid, file_label, container) {
  this._ID = "_via_file_annotator_" + _via_util_uid6();
  this.va = view_annotator;
  this.d = data;
  this.vid = vid;
  this.file_label = file_label;
  this.c = container;

  this.fid = this.d.store.view[this.vid].fid_list[0];
  this.image_el = null;
  this.overlay = null;
  this.ctx = null;
  this.input = null;

  this.viewport = null; // {left,top,width,height,scale,natural_width,natural_height}

  this.selected_mid = "";
  this.draw_pts = []; // flat image coords (8 values when complete)
  this.hover_img = null; // current mouse image coords while drawing

  this.is_mouse_down = false;
  this.drag = null; // {type,mid,vertex_index,start_x,start_y,orig_pts,current_pts,moved}

  this.conf = {
    LINE_WIDTH: 2,
    POINT_RADIUS: 4,
    POINT_HIT_TOL: 7,
  };

  _via_event.call(this);

  this.d.on_event("metadata_add", this._ID, this._on_data_changed.bind(this));
  this.d.on_event(
    "metadata_add_bulk",
    this._ID,
    this._on_data_changed.bind(this),
  );
  this.d.on_event(
    "metadata_update",
    this._ID,
    this._on_data_changed.bind(this),
  );
  this.d.on_event(
    "metadata_delete_bulk",
    this._ID,
    this._on_data_changed.bind(this),
  );
  this.d.on_event("project_loaded", this._ID, this._on_data_changed.bind(this));
}

_via_file_annotator.prototype.set_draw_mode_quadrilateral = function () {
  // Draw mode is always quadrilateral in this implementation.
  return;
};

_via_file_annotator.prototype._selected_metadata = function () {
  if (this.selected_mid === "") {
    return null;
  }
  if (!this.d.store.metadata.hasOwnProperty(this.selected_mid)) {
    return null;
  }
  return this.d.store.metadata[this.selected_mid];
};

_via_file_annotator.prototype.get_region_selection = function () {
  var md = this._selected_metadata();
  if (!md) {
    return {
      vid: this.vid,
      fid: this.fid,
      mid: "",
      av: {},
    };
  }
  return {
    vid: this.vid,
    fid: this.fid,
    mid: this.selected_mid,
    av: JSON.parse(JSON.stringify(md.av || {})),
  };
};

_via_file_annotator.prototype._emit_region_selection_change = function () {
  this.va.emit_event("region_selection_change", this.get_region_selection());
};

_via_file_annotator.prototype._set_selected_mid = function (mid) {
  var next_mid = mid || "";
  if (next_mid !== "" && !this.d.store.metadata.hasOwnProperty(next_mid)) {
    next_mid = "";
  }

  if (this.selected_mid === next_mid) {
    return false;
  }

  this.selected_mid = next_mid;
  this._emit_region_selection_change();
  return true;
};

_via_file_annotator.prototype.set_selected_region_transcription = function (
  text,
) {
  return new Promise(
    function (ok_callback, err_callback) {
      var md = this._selected_metadata();
      if (!md) {
        err_callback("no selected quadrilateral");
        return;
      }

      var av = JSON.parse(JSON.stringify(md.av || {}));
      var safe_text = "";
      if (typeof text !== "undefined" && text !== null) {
        safe_text = text
          .toString()
          .replace(/[\r\n]+/g, " ")
          .trim();
      }

      if (safe_text.length) {
        av.transcription = safe_text;
        if (av.ignore === true) {
          delete av.ignore;
        }
        if (av.illegible === true) {
          delete av.illegible;
        }
        if (av.dontcare === true) {
          delete av.dontcare;
        }
      } else {
        if (av.hasOwnProperty("transcription")) {
          delete av.transcription;
        }
      }

      this.d.metadata_update_av(this.vid, this.selected_mid, av).then(
        function (ok) {
          ok_callback(ok);
        }.bind(this),
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_file_annotator.prototype.set_selected_region_dontcare = function (
  is_dontcare,
) {
  return new Promise(
    function (ok_callback, err_callback) {
      var md = this._selected_metadata();
      if (!md) {
        err_callback("no selected quadrilateral");
        return;
      }

      var av = JSON.parse(JSON.stringify(md.av || {}));
      if (is_dontcare) {
        av.dontcare = true;
      } else if (av.hasOwnProperty("dontcare")) {
        delete av.dontcare;
      }

      this.d.metadata_update_av(this.vid, this.selected_mid, av).then(
        function (ok) {
          ok_callback(ok);
        }.bind(this),
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_file_annotator.prototype._file_load = function () {
  return new Promise(
    function (ok_callback, err_callback) {
      this.c.innerHTML = "";
      this.c.classList.add("annotator_surface");

      this.image_el = document.createElement("img");
      this.image_el.setAttribute("class", "annotator_image");
      this.image_el.setAttribute("alt", this.d.store.file[this.fid].fname);
      this.c.appendChild(this.image_el);

      this.overlay = document.createElement("canvas");
      this.overlay.setAttribute("class", "annotator_overlay");
      this.c.appendChild(this.overlay);
      this.ctx = this.overlay.getContext("2d");

      this.input = document.createElement("div");
      this.input.setAttribute("class", "annotator_input");
      this.input.setAttribute("tabindex", "0");
      this.c.appendChild(this.input);

      this._attach_input_handlers();

      var file_src = this.d.file_get_src(this.fid);
      if (file_src === "") {
        err_callback("image source not available");
        return;
      }

      this.image_el.addEventListener(
        "load",
        function () {
          this.d.file_set_dimensions(
            this.fid,
            this.image_el.naturalWidth,
            this.image_el.naturalHeight,
          );
          this.refresh_layout();
          ok_callback();
        }.bind(this),
      );

      this.image_el.addEventListener("error", function () {
        err_callback("failed to load image");
      });

      this.image_el.src = file_src;
    }.bind(this),
  );
};

_via_file_annotator.prototype.refresh_layout = function () {
  if (
    !this.image_el ||
    !this.image_el.naturalWidth ||
    !this.image_el.naturalHeight
  ) {
    return;
  }

  var cw = this.c.clientWidth;
  var ch = this.c.clientHeight;
  var iw = this.image_el.naturalWidth;
  var ih = this.image_el.naturalHeight;

  if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) {
    return;
  }

  var scale = Math.min(cw / iw, ch / ih);
  var vw = iw * scale;
  var vh = ih * scale;
  var left = (cw - vw) / 2;
  var top = (ch - vh) / 2;

  this.viewport = {
    left: left,
    top: top,
    width: vw,
    height: vh,
    scale: scale,
    natural_width: iw,
    natural_height: ih,
  };

  this.image_el.style.left = left + "px";
  this.image_el.style.top = top + "px";
  this.image_el.style.width = vw + "px";
  this.image_el.style.height = vh + "px";

  this.overlay.width = cw;
  this.overlay.height = ch;

  this._draw();
};

_via_file_annotator.prototype._attach_input_handlers = function () {
  this.input.addEventListener("mousedown", this._on_mousedown.bind(this));
  this.input.addEventListener("mousemove", this._on_mousemove.bind(this));
  this.input.addEventListener("mouseup", this._on_mouseup.bind(this));
  this.input.addEventListener("mouseleave", this._on_mouseleave.bind(this));
};

_via_file_annotator.prototype._on_data_changed = function (
  data,
  event_payload,
) {
  if (
    event_payload &&
    event_payload.hasOwnProperty("vid") &&
    event_payload.vid !== this.vid
  ) {
    return;
  }

  var should_emit_selection = false;
  if (
    this.selected_mid !== "" &&
    !this.d.store.metadata.hasOwnProperty(this.selected_mid)
  ) {
    this.selected_mid = "";
    should_emit_selection = true;
  }

  if (
    this.selected_mid !== "" &&
    event_payload &&
    event_payload.hasOwnProperty("mid") &&
    event_payload.mid === this.selected_mid
  ) {
    should_emit_selection = true;
  }

  if (should_emit_selection) {
    this._emit_region_selection_change();
  }

  this._draw();
};

_via_file_annotator.prototype._on_mousedown = function (e) {
  if (!this.viewport) {
    return;
  }

  this.input.focus();
  this.is_mouse_down = true;

  var cx = e.offsetX;
  var cy = e.offsetY;

  if (this.draw_pts.length > 0) {
    var new_point = this._canvas_to_image(cx, cy, true);
    if (!new_point) {
      return;
    }
    this.draw_pts.push(new_point.x, new_point.y);
    if (this.draw_pts.length === 8) {
      this._finalize_draw_quad();
    }
    this._draw();
    return;
  }

  if (this.selected_mid !== "") {
    var vhit = this._hit_test_vertex(this.selected_mid, cx, cy);
    if (vhit !== -1) {
      var current_pts = this.d.store.metadata[this.selected_mid].xy.slice(1);
      this.drag = {
        type: "vertex",
        mid: this.selected_mid,
        vertex_index: vhit,
        orig_pts: current_pts.slice(0),
        current_pts: current_pts.slice(0),
        moved: false,
      };
      return;
    }
  }

  var mid_hit = this._hit_test_mid(cx, cy);
  if (mid_hit !== "") {
    this._set_selected_mid(mid_hit);
    var p = this._canvas_to_image(cx, cy, false);
    var move_pts = this.d.store.metadata[mid_hit].xy.slice(1);
    this.drag = {
      type: "move",
      mid: mid_hit,
      start_x: p.x,
      start_y: p.y,
      orig_pts: move_pts.slice(0),
      current_pts: move_pts.slice(0),
      moved: false,
    };
    this._draw();
    return;
  }

  var first_point = this._canvas_to_image(cx, cy, true);
  if (!first_point) {
    this._set_selected_mid("");
    this._draw();
    return;
  }

  this._set_selected_mid("");
  this.draw_pts = [first_point.x, first_point.y];
  this.hover_img = first_point;
  _via_util_msg_show("Quadrilateral started. Click 3 more points.");
  this._draw();
};

_via_file_annotator.prototype._on_mousemove = function (e) {
  if (!this.viewport) {
    return;
  }

  var cx = e.offsetX;
  var cy = e.offsetY;

  if (this.draw_pts.length > 0) {
    this.hover_img = this._canvas_to_image(cx, cy, false);
    this._set_cursor(cx, cy);
    this._draw();
    return;
  }

  if (this.drag && this.is_mouse_down) {
    var p = this._canvas_to_image(cx, cy, false);
    if (!p) {
      return;
    }

    if (this.drag.type === "move") {
      var dx = p.x - this.drag.start_x;
      var dy = p.y - this.drag.start_y;
      var moved_pts = [];
      for (var i = 0; i < 4; ++i) {
        var nx = this.drag.orig_pts[2 * i] + dx;
        var ny = this.drag.orig_pts[2 * i + 1] + dy;
        nx = _via_util_clamp(nx, 0, this.viewport.natural_width);
        ny = _via_util_clamp(ny, 0, this.viewport.natural_height);
        moved_pts.push(nx, ny);
      }
      this.drag.current_pts = moved_pts;
      this.drag.moved = true;
    }

    if (this.drag.type === "vertex") {
      var vindex = this.drag.vertex_index;
      var updated_pts = this.drag.orig_pts.slice(0);
      updated_pts[2 * vindex] = _via_util_clamp(
        p.x,
        0,
        this.viewport.natural_width,
      );
      updated_pts[2 * vindex + 1] = _via_util_clamp(
        p.y,
        0,
        this.viewport.natural_height,
      );
      this.drag.current_pts = updated_pts;
      this.drag.moved = true;
    }

    this._draw();
    return;
  }

  this._set_cursor(cx, cy);
};

_via_file_annotator.prototype._on_mouseup = function () {
  this.is_mouse_down = false;

  if (!this.drag) {
    return;
  }

  var drag = this.drag;
  this.drag = null;

  if (drag.moved) {
    this._update_mid_points(drag.mid, drag.current_pts);
  }

  this._draw();
};

_via_file_annotator.prototype._on_mouseleave = function () {
  this.is_mouse_down = false;
};

_via_file_annotator.prototype._on_keydown = function (e) {
  if (!this.viewport) {
    return;
  }

  if (e.key === "Escape") {
    if (this.draw_pts.length > 0) {
      this.draw_pts = [];
      this.hover_img = null;
      _via_util_msg_show("Quadrilateral drawing cancelled.");
    } else {
      this._set_selected_mid("");
      _via_util_msg_show("Selection cleared.");
    }
    this.drag = null;
    this._draw();
    return;
  }

  if (
    (e.key === "Backspace" || e.key === "Delete") &&
    this.selected_mid !== ""
  ) {
    e.preventDefault();
    var mid = this.selected_mid;
    this._set_selected_mid("");
    this.d.metadata_delete_bulk(this.vid, [mid]).then(function () {
      _via_util_msg_show("Quadrilateral deleted.");
    });
    return;
  }

  if (this.selected_mid === "") {
    return;
  }

  if (
    e.key === "ArrowLeft" ||
    e.key === "ArrowRight" ||
    e.key === "ArrowUp" ||
    e.key === "ArrowDown"
  ) {
    e.preventDefault();
    var delta = e.shiftKey ? 10 : 1;
    var dx = 0;
    var dy = 0;
    if (e.key === "ArrowLeft") {
      dx = -delta;
    } else if (e.key === "ArrowRight") {
      dx = delta;
    } else if (e.key === "ArrowUp") {
      dy = -delta;
    } else if (e.key === "ArrowDown") {
      dy = delta;
    }
    this._move_selected(dx, dy);
  }
};

_via_file_annotator.prototype._move_selected = function (dx, dy) {
  if (
    this.selected_mid === "" ||
    !this.d.store.metadata.hasOwnProperty(this.selected_mid)
  ) {
    return;
  }

  var pts = this.d.store.metadata[this.selected_mid].xy.slice(1);
  for (var i = 0; i < 4; ++i) {
    pts[2 * i] = _via_util_clamp(
      pts[2 * i] + dx,
      0,
      this.viewport.natural_width,
    );
    pts[2 * i + 1] = _via_util_clamp(
      pts[2 * i + 1] + dy,
      0,
      this.viewport.natural_height,
    );
  }

  this._update_mid_points(this.selected_mid, pts);
};

_via_file_annotator.prototype._update_mid_points = function (mid, flat_pts) {
  var normalized = _via_util_normalize_quad_points(flat_pts);
  if (normalized.length !== 8) {
    return;
  }

  var xy = [_VIA_RSHAPE.POLYGON].concat(normalized);
  this.d.metadata_update_xy(this.vid, mid, xy).then(
    function () {
      this._draw();
    }.bind(this),
  );
};

_via_file_annotator.prototype._finalize_draw_quad = function () {
  var normalized = _via_util_normalize_quad_points(this.draw_pts);
  this.draw_pts = [];
  this.hover_img = null;

  if (normalized.length !== 8) {
    _via_util_msg_show("Invalid quadrilateral. Try again.", true);
    this._draw();
    return;
  }

  var xy = [_VIA_RSHAPE.POLYGON].concat(normalized);
  this.d.metadata_add(this.vid, [], xy, {}).then(
    function (ok) {
      this._set_selected_mid(ok.mid);
      _via_util_msg_show("Quadrilateral added. Drag corners to refine.");
      this._draw();
    }.bind(this),
  );
};

_via_file_annotator.prototype._spatial_mid_list = function () {
  var out = [];
  var mid_list = this.d.cache.mid_list.hasOwnProperty(this.vid)
    ? this.d.cache.mid_list[this.vid]
    : [];
  for (var i = 0; i < mid_list.length; ++i) {
    var mid = mid_list[i];
    if (!this.d.store.metadata.hasOwnProperty(mid)) {
      continue;
    }
    var xy = this.d.store.metadata[mid].xy;
    if (xy.length === 9 && xy[0] === _VIA_RSHAPE.POLYGON) {
      out.push(mid);
    }
  }
  return out;
};

_via_file_annotator.prototype._image_to_canvas = function (ix, iy) {
  return {
    x: this.viewport.left + ix * this.viewport.scale,
    y: this.viewport.top + iy * this.viewport.scale,
  };
};

_via_file_annotator.prototype._canvas_to_image = function (
  cx,
  cy,
  require_inside,
) {
  var x = (cx - this.viewport.left) / this.viewport.scale;
  var y = (cy - this.viewport.top) / this.viewport.scale;

  var in_bounds =
    x >= 0 &&
    y >= 0 &&
    x <= this.viewport.natural_width &&
    y <= this.viewport.natural_height;

  if (require_inside && !in_bounds) {
    return null;
  }

  return {
    x: _via_util_clamp(x, 0, this.viewport.natural_width),
    y: _via_util_clamp(y, 0, this.viewport.natural_height),
    in_bounds: in_bounds,
  };
};

_via_file_annotator.prototype._quad_canvas_points = function (flat_pts_image) {
  var out = [];
  for (var i = 0; i < 4; ++i) {
    var c = this._image_to_canvas(
      flat_pts_image[2 * i],
      flat_pts_image[2 * i + 1],
    );
    out.push(c.x, c.y);
  }
  return out;
};

_via_file_annotator.prototype._draw_quad = function (
  flat_pts_canvas,
  is_selected,
) {
  this.ctx.beginPath();
  this.ctx.moveTo(flat_pts_canvas[0], flat_pts_canvas[1]);
  for (var i = 1; i < 4; ++i) {
    this.ctx.lineTo(flat_pts_canvas[2 * i], flat_pts_canvas[2 * i + 1]);
  }
  this.ctx.closePath();

  this.ctx.lineWidth = this.conf.LINE_WIDTH;
  this.ctx.strokeStyle = is_selected ? "#00f5ff" : "#ffe500";
  this.ctx.fillStyle = is_selected
    ? "rgba(0, 245, 255, 0.15)"
    : "rgba(255, 229, 0, 0.10)";
  this.ctx.fill();
  this.ctx.stroke();

  if (is_selected) {
    for (var p = 0; p < 4; ++p) {
      this.ctx.beginPath();
      this.ctx.arc(
        flat_pts_canvas[2 * p],
        flat_pts_canvas[2 * p + 1],
        this.conf.POINT_RADIUS,
        0,
        2 * Math.PI,
      );
      this.ctx.fillStyle = "#00f5ff";
      this.ctx.fill();
      this.ctx.strokeStyle = "#003d42";
      this.ctx.stroke();
    }
  }
};

_via_file_annotator.prototype._draw_temp_quad = function () {
  if (this.draw_pts.length === 0) {
    return;
  }

  var draw_canvas = [];
  for (var i = 0; i < this.draw_pts.length / 2; ++i) {
    var c = this._image_to_canvas(
      this.draw_pts[2 * i],
      this.draw_pts[2 * i + 1],
    );
    draw_canvas.push(c.x, c.y);
  }

  if (this.hover_img) {
    var hc = this._image_to_canvas(this.hover_img.x, this.hover_img.y);
    draw_canvas.push(hc.x, hc.y);
  }

  this.ctx.beginPath();
  this.ctx.moveTo(draw_canvas[0], draw_canvas[1]);
  for (var p = 1; p < draw_canvas.length / 2; ++p) {
    this.ctx.lineTo(draw_canvas[2 * p], draw_canvas[2 * p + 1]);
  }
  this.ctx.lineWidth = 2;
  this.ctx.strokeStyle = "#ff6b00";
  this.ctx.stroke();

  for (var v = 0; v < this.draw_pts.length / 2; ++v) {
    this.ctx.beginPath();
    this.ctx.arc(
      draw_canvas[2 * v],
      draw_canvas[2 * v + 1],
      this.conf.POINT_RADIUS,
      0,
      2 * Math.PI,
    );
    this.ctx.fillStyle = "#ff6b00";
    this.ctx.fill();
  }
};

_via_file_annotator.prototype._draw = function () {
  if (!this.ctx || !this.viewport) {
    return;
  }

  this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

  var mids = this._spatial_mid_list();
  for (var i = 0; i < mids.length; ++i) {
    var mid = mids[i];
    var flat_pts = this.d.store.metadata[mid].xy.slice(1);
    if (this.drag && this.drag.mid === mid && this.drag.current_pts) {
      flat_pts = this.drag.current_pts;
    }
    this._draw_quad(
      this._quad_canvas_points(flat_pts),
      mid === this.selected_mid,
    );
  }

  this._draw_temp_quad();
};

_via_file_annotator.prototype._point_in_quad = function (
  px,
  py,
  flat_quad_canvas,
) {
  var inside = false;
  for (var i = 0, j = 3; i < 4; j = i++) {
    var xi = flat_quad_canvas[2 * i];
    var yi = flat_quad_canvas[2 * i + 1];
    var xj = flat_quad_canvas[2 * j];
    var yj = flat_quad_canvas[2 * j + 1];

    var intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-6) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
};

_via_file_annotator.prototype._hit_test_mid = function (cx, cy) {
  var mids = this._spatial_mid_list();
  for (var i = mids.length - 1; i >= 0; --i) {
    var mid = mids[i];
    var quad_canvas = this._quad_canvas_points(
      this.d.store.metadata[mid].xy.slice(1),
    );
    if (this._point_in_quad(cx, cy, quad_canvas)) {
      return mid;
    }
  }
  return "";
};

_via_file_annotator.prototype._hit_test_vertex = function (mid, cx, cy) {
  if (!this.d.store.metadata.hasOwnProperty(mid)) {
    return -1;
  }
  var quad_canvas = this._quad_canvas_points(
    this.d.store.metadata[mid].xy.slice(1),
  );
  for (var i = 0; i < 4; ++i) {
    var dx = quad_canvas[2 * i] - cx;
    var dy = quad_canvas[2 * i + 1] - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= this.conf.POINT_HIT_TOL) {
      return i;
    }
  }
  return -1;
};

_via_file_annotator.prototype._set_cursor = function (cx, cy) {
  if (this.draw_pts.length > 0) {
    this.input.style.cursor = "crosshair";
    return;
  }

  if (
    this.selected_mid !== "" &&
    this._hit_test_vertex(this.selected_mid, cx, cy) !== -1
  ) {
    this.input.style.cursor = "pointer";
    return;
  }

  if (this._hit_test_mid(cx, cy) !== "") {
    this.input.style.cursor = "move";
    return;
  }

  this.input.style.cursor = "crosshair";
};

_via_file_annotator.prototype.detect_and_replace = function () {
  if (!this.viewport) {
    _via_util_msg_show("Load an image first.", true);
    return;
  }

  var src = this.d.file_get_src(this.fid);
  if (!src) {
    _via_util_msg_show("Image source unavailable.", true);
    return;
  }

  _via_util_msg_show("Running PP-OCRv5 detection...", true);

  _via_util_fetch_blob(src, _VIA_CONFIG.OCR_TIMEOUT_MS)
    .then(function (blob) {
      return _via_util_ocr_detect(blob);
    })
    .then(
      function (resp) {
        var boxes = this._parse_detect_response(resp);

        this.d.metadata_delete_spatial_by_vid(this.vid).then(
          function () {
            if (boxes.length === 0) {
              this._set_selected_mid("");
              this.draw_pts = [];
              this.hover_img = null;
              this._draw();
              _via_util_msg_show("Detection completed: 0 boxes.");
              return;
            }

            var metadata_list = [];
            for (var i = 0; i < boxes.length; ++i) {
              metadata_list.push({
                vid: this.vid,
                z: [],
                xy: [_VIA_RSHAPE.POLYGON].concat(boxes[i]),
                av: {},
              });
            }

            this.d.metadata_add_bulk(metadata_list).then(
              function () {
                this._set_selected_mid("");
                this.draw_pts = [];
                this.hover_img = null;
                this._draw();
                _via_util_msg_show(
                  "Detection completed: " + boxes.length + " box(es).",
                );
              }.bind(this),
            );
          }.bind(this),
        );
      }.bind(this),
    )
    .catch(function (err) {
      _via_util_msg_show("Detection failed: " + err, true);
    });
};

_via_file_annotator.prototype._parse_detect_response = function (resp) {
  if (!resp || !Array.isArray(resp.boxes)) {
    return [];
  }

  var out = [];
  for (var i = 0; i < resp.boxes.length; ++i) {
    var box = resp.boxes[i];
    var flat = [];

    if (Array.isArray(box) && box.length === 8 && typeof box[0] === "number") {
      flat = box.slice(0);
    } else if (
      Array.isArray(box) &&
      box.length === 4 &&
      Array.isArray(box[0])
    ) {
      for (var p = 0; p < 4; ++p) {
        flat.push(box[p][0], box[p][1]);
      }
    } else {
      continue;
    }

    for (var c = 0; c < 4; ++c) {
      flat[2 * c] = _via_util_clamp(
        flat[2 * c],
        0,
        this.viewport.natural_width,
      );
      flat[2 * c + 1] = _via_util_clamp(
        flat[2 * c + 1],
        0,
        this.viewport.natural_height,
      );
    }

    var normalized = _via_util_normalize_quad_points(flat);
    if (normalized.length === 8) {
      out.push(normalized);
    }
  }

  return out;
};
