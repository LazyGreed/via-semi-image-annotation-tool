/**
 * Image-only view manager.
 */

"use strict";

function _via_view_manager(data, view_annotator, container) {
  this._ID = "_via_view_manager_";
  this.d = data;
  this.va = view_annotator;
  this.c = container;

  this.view_selector_vid_list = [];

  _via_event.call(this);

  this.d.on_event(
    "project_loaded",
    this._ID,
    this._on_event_project_loaded.bind(this),
  );
  this.d.on_event(
    "view_bulk_add",
    this._ID,
    this._on_event_view_bulk_add.bind(this),
  );
  this.d.on_event("view_del", this._ID, this._on_event_view_del.bind(this));
  this.va.on_event("view_show", this._ID, this._on_event_view_show.bind(this));
  this.va.on_event("view_next", this._ID, this._on_event_view_next.bind(this));
  this.va.on_event("view_prev", this._ID, this._on_event_view_prev.bind(this));

  this._init_ui_elements();
}

_via_view_manager.prototype._init = function () {
  this._init_ui_elements();
  this._view_selector_update();
};

_via_view_manager.prototype._init_ui_elements = function () {
  this.pname = document.createElement("input");
  this.pname.setAttribute("type", "text");
  this.pname.setAttribute("id", "via_project_name_input");
  this.pname.setAttribute("value", this.d.store.project.pname);
  this.pname.setAttribute("title", "Project Name");
  this.pname.addEventListener("change", this._on_pname_change.bind(this));

  this.view_selector = document.createElement("select");
  this.view_selector.setAttribute("class", "view_selector");
  this.view_selector.setAttribute("title", "Select an image");
  this.view_selector.addEventListener(
    "change",
    this._on_view_selector_change.bind(this),
  );

  this.c.innerHTML = "";
  this.c.appendChild(this.pname);
  this.c.appendChild(this.view_selector);
};

_via_view_manager.prototype._on_pname_change = function (e) {
  this.d.store.project.pname = e.target.value.trim();
};

_via_view_manager.prototype._on_view_selector_change = function (e) {
  if (e.target.selectedIndex === -1) {
    return;
  }
  var vid = e.target.options[e.target.selectedIndex].value;
  if (vid !== this.va.vid) {
    this.va.view_show(vid);
  }
};

_via_view_manager.prototype._on_event_view_show = function (
  data,
  event_payload,
) {
  var vid = event_payload.vid.toString();
  var n = this.view_selector.options.length;
  this.view_selector.selectedIndex = -1;
  for (var i = 0; i < n; ++i) {
    if (this.view_selector.options[i].value === vid) {
      this.view_selector.selectedIndex = i;
      break;
    }
  }
};

_via_view_manager.prototype._on_event_view_next = function () {
  this._on_next_view();
};

_via_view_manager.prototype._on_event_view_prev = function () {
  this._on_prev_view();
};

_via_view_manager.prototype._view_selector_option_html = function (
  vindex,
  vid,
) {
  var oi = document.createElement("option");
  oi.setAttribute("value", vid);
  var fid = this.d.store.view[vid].fid_list[0];
  oi.innerHTML =
    "[" +
    (parseInt(vindex, 10) + 1) +
    "] " +
    decodeURI(this.d.store.file[fid].fname);
  return oi;
};

_via_view_manager.prototype._view_selector_clear = function () {
  this.view_selector.innerHTML = "";
  this.view_selector_vid_list = [];
};

_via_view_manager.prototype._view_selector_update = function () {
  var existing_vid = "";
  if (
    this.view_selector.selectedIndex !== -1 &&
    this.view_selector.options.length
  ) {
    existing_vid =
      this.view_selector.options[this.view_selector.selectedIndex].value;
  }

  this._view_selector_clear();

  for (
    var vindex = 0;
    vindex < this.d.store.project.vid_list.length;
    ++vindex
  ) {
    var vid = this.d.store.project.vid_list[vindex];
    this.view_selector.appendChild(
      this._view_selector_option_html(vindex, vid),
    );
    this.view_selector_vid_list.push(vid);
  }

  if (existing_vid !== "") {
    var old_index = this.view_selector_vid_list.indexOf(existing_vid);
    this.view_selector.selectedIndex = old_index;
  }
};

_via_view_manager.prototype._file_add_from_filelist = function (filelist) {
  return this.d.view_bulk_add_from_filelist(filelist).then(
    function (ok) {
      if (ok.fid_list.length === 0) {
        _via_util_msg_show("No image files were added.", true);
        return;
      }
      _via_util_msg_show("Added " + ok.fid_list.length + " image(s).");
    },
    function (err) {
      _via_util_msg_show("Failed to add images: " + err, true);
    },
  );
};

_via_view_manager.prototype._on_add_media_local = function () {
  _via_util_file_select_local(
    _VIA_FILE_SELECT_TYPE.IMAGE,
    this._file_add_local.bind(this),
    true,
  );
};

_via_view_manager.prototype._on_add_pdf_local = function () {
  _via_util_file_select_local(
    _VIA_FILE_SELECT_TYPE.PDF,
    this._file_add_pdf_local.bind(this),
    true,
  );
};

_via_view_manager.prototype._file_add_local = function (e) {
  var files = e.target.files;
  var filelist = [];
  for (var i = 0; i < files.length; ++i) {
    filelist.push({
      fname: files[i].name,
      type: _VIA_FILE_TYPE.IMAGE,
      loc: _VIA_FILE_LOC.LOCAL,
      src: files[i],
    });
  }
  this._file_add_from_filelist(filelist);
};

_via_view_manager.prototype._file_add_pdf_local = function (e) {
  var files = e.target.files;
  var pdf_file_list = [];

  for (var i = 0; i < files.length; ++i) {
    var filename = files[i].name || "";
    var ext = _via_util_file_ext(filename).toLowerCase();
    if (ext === "pdf" || files[i].type === "application/pdf") {
      pdf_file_list.push(files[i]);
    }
  }

  if (!pdf_file_list.length) {
    _via_util_msg_show("No PDF files were selected.", true);
    return;
  }

  var converted_image_filelist = [];
  var failed_pdf_list = [];
  var total_pdf_count = pdf_file_list.length;

  var convert_pdf = function (file_index) {
    if (file_index >= total_pdf_count) {
      if (!converted_image_filelist.length) {
        if (failed_pdf_list.length) {
          _via_util_msg_show(
            "PDF conversion failed for all selected files.",
            true,
          );
        } else {
          _via_util_msg_show(
            "No pages were extracted from selected PDF files.",
            true,
          );
        }
        return;
      }

      this._file_add_from_filelist(converted_image_filelist).then(function () {
        if (failed_pdf_list.length) {
          _via_util_msg_show(
            "Added " +
              converted_image_filelist.length +
              " page image(s); failed " +
              failed_pdf_list.length +
              "/" +
              total_pdf_count +
              " PDF file(s).",
            true,
          );
        }
      });
      return;
    }

    var pdf_file = pdf_file_list[file_index];
    _via_util_msg_show(
      "Converting PDF " +
        (file_index + 1) +
        "/" +
        total_pdf_count +
        " at 400 DPI...",
      true,
    );

    _via_util_pdf_to_png_filelist(pdf_file, _VIA_CONFIG.PDF_RENDER_SCALE).then(
      function (image_filelist) {
        converted_image_filelist =
          converted_image_filelist.concat(image_filelist);
        convert_pdf(file_index + 1);
      },
      function (err) {
        failed_pdf_list.push({
          filename: pdf_file.name || "file_" + file_index + ".pdf",
          reason: err,
        });
        convert_pdf(file_index + 1);
      },
    );
  }.bind(this);

  convert_pdf(0);
};

_via_view_manager.prototype._on_next_view = function () {
  if (
    !this.view_selector.options.length ||
    this.view_selector.selectedIndex === -1
  ) {
    return;
  }

  var vid = this.view_selector.options[this.view_selector.selectedIndex].value;
  var vindex = this.view_selector_vid_list.indexOf(vid);
  if (vindex === -1) {
    return;
  }

  var next_vindex = vindex + 1;
  if (next_vindex >= this.view_selector_vid_list.length) {
    next_vindex = 0;
  }
  this.va.view_show(this.view_selector_vid_list[next_vindex]);
};

_via_view_manager.prototype._on_prev_view = function () {
  if (
    !this.view_selector.options.length ||
    this.view_selector.selectedIndex === -1
  ) {
    return;
  }

  var vid = this.view_selector.options[this.view_selector.selectedIndex].value;
  var vindex = this.view_selector_vid_list.indexOf(vid);
  if (vindex === -1) {
    return;
  }

  var prev_vindex = vindex - 1;
  if (prev_vindex < 0) {
    prev_vindex = this.view_selector_vid_list.length - 1;
  }
  this.va.view_show(this.view_selector_vid_list[prev_vindex]);
};

_via_view_manager.prototype._on_del_view = function () {
  if (!this.va.vid) {
    _via_util_msg_show("No active image to delete.", true);
    return;
  }

  this.d.view_del(this.va.vid).then(
    function (ok) {
      _via_util_msg_show("Deleted image " + (parseInt(ok.vindex, 10) + 1));
    },
    function (err) {
      _via_util_msg_show("Delete failed: " + err, true);
    },
  );
};

_via_view_manager.prototype._on_event_project_loaded = function () {
  this._init_ui_elements();
  this._view_selector_update();
  if (this.d.store.project.vid_list.length) {
    this.va.view_show(this.d.store.project.vid_list[0]);
  } else {
    this.va._init();
  }
};

_via_view_manager.prototype._on_event_view_bulk_add = function (
  data,
  event_payload,
) {
  this._view_selector_update();
  if (event_payload.vid_list.length) {
    this.va.view_show(event_payload.vid_list[0]);
  }
};

_via_view_manager.prototype._on_event_view_del = function (
  data,
  event_payload,
) {
  this._view_selector_update();
  if (this.d.store.project.vid_list.length) {
    var vindex = event_payload.vindex;
    if (vindex < this.d.store.project.vid_list.length) {
      this.va.view_show(this.d.store.project.vid_list[vindex]);
    } else {
      this.va.view_show(
        this.d.store.project.vid_list[this.d.store.project.vid_list.length - 1],
      );
    }
  } else {
    this.va._init();
  }
};
