/**
 * Image-only view annotator.
 */

"use strict";

const _VIA_VIEW_MODE = {
  UNKNOWN: 0,
  IMAGE1: 1,
};

function _via_view_annotator(data, container) {
  this._ID = "_via_view_annotator_";
  this.d = data;
  this.c = container;
  this.view_mode = _VIA_VIEW_MODE.UNKNOWN;
  this.vid = null;
  this.file_annotator = null;

  _via_event.call(this);

  this._init();
}

_via_view_annotator.prototype._init = function () {
  this._show_start_info();
};

_via_view_annotator.prototype._show_start_info = function () {
  this.c.innerHTML = "";
  var wrapper = document.createElement("div");
  wrapper.setAttribute("class", "via_start_info");
  wrapper.innerHTML =
    "<h2>Image-Only Quadrilateral Annotator</h2>" +
    "<p>Add images or PDF pages from the toolbar, then click to define 4 points for each quadrilateral.</p>" +
    "<p>Use <b>Detect</b> for PP-OCRv5 semi-annotation, then drag corners to refine boxes.</p>";
  this.c.appendChild(wrapper);
};

_via_view_annotator.prototype.view_show = function (vid) {
  this._view_clear_file_annotator();
  this.vid = vid;
  this._view_annotate_single_image(vid);
  this.emit_event("view_show", { vid: vid });
};

_via_view_annotator.prototype._view_annotate_single_image = function (vid) {
  this.view_mode = _VIA_VIEW_MODE.IMAGE1;
  this.c.innerHTML = "";

  var file_container = document.createElement("div");
  file_container.setAttribute("class", "file_container");
  this.c.appendChild(file_container);

  this.file_annotator = new _via_file_annotator(
    this,
    this.d,
    vid,
    "",
    file_container,
  );
  this.file_annotator._file_load().then(
    function () {
      this.file_annotator._emit_region_selection_change();
      _via_util_msg_show(
        "Image ready. Click 4 points to create a quadrilateral.",
      );
    }.bind(this),
    function (err) {
      console.warn(err);
      _via_util_msg_show("Failed to load image.", true);
    },
  );
};

_via_view_annotator.prototype._view_clear_file_annotator = function () {
  if (this.file_annotator) {
    this.d.clear_events(this.file_annotator._ID);
    this.file_annotator = null;
  }
  this.emit_event("region_selection_change", {
    vid: this.vid,
    mid: "",
    fid: "",
    av: {},
  });
};

_via_view_annotator.prototype.get_selected_region = function () {
  if (!this.file_annotator) {
    return {
      vid: this.vid,
      fid: "",
      mid: "",
      av: {},
    };
  }
  return this.file_annotator.get_region_selection();
};

_via_view_annotator.prototype.set_selected_region_transcription = function (
  text,
) {
  return new Promise(
    function (ok_callback, err_callback) {
      if (!this.file_annotator) {
        err_callback("no active image");
        return;
      }
      this.file_annotator.set_selected_region_transcription(text).then(
        function (ok) {
          ok_callback(ok);
        },
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_view_annotator.prototype.set_selected_region_dontcare = function (
  is_dontcare,
) {
  return new Promise(
    function (ok_callback, err_callback) {
      if (!this.file_annotator) {
        err_callback("no active image");
        return;
      }
      this.file_annotator.set_selected_region_dontcare(is_dontcare).then(
        function (ok) {
          ok_callback(ok);
        },
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_view_annotator.prototype.set_region_draw_shape = function (shape) {
  if (shape !== "QUADRILATERAL") {
    return;
  }
  if (this.file_annotator) {
    this.file_annotator.set_draw_mode_quadrilateral();
  }
  _via_util_msg_show(
    "Quadrilateral mode enabled. Click 4 points to create one box.",
  );
};

_via_view_annotator.prototype.detect_current_image = function () {
  if (!this.file_annotator) {
    _via_util_msg_show("Load an image first.", true);
    return;
  }
  this.file_annotator.detect_and_replace();
};

_via_view_annotator.prototype.refresh = function () {
  if (this.file_annotator) {
    this.file_annotator.refresh_layout();
  }
};

_via_view_annotator.prototype._on_event_keydown = function (e) {
  if (!this.file_annotator) {
    return;
  }

  if (e.key === "n") {
    e.preventDefault();
    this.emit_event("view_next", {});
    return;
  }

  if (e.key === "p") {
    e.preventDefault();
    this.emit_event("view_prev", {});
    return;
  }

  this.file_annotator._on_keydown(e);
};
