/**
 * Image-only control panel.
 */

"use strict";

function _via_control_panel(control_panel_container, via) {
  this._ID = "_via_control_panel_";
  this.c = control_panel_container;
  this.via = via;
  this.region_text_save_timer = null;
  this.region_editor_sync = false;
  this.region_selection = { vid: "", mid: "" };

  _via_event.call(this);

  this._init();

  this.via.va.on_event(
    "region_selection_change",
    this._ID,
    this._on_event_region_selection_change.bind(this),
  );
  this.via.d.on_event(
    "project_loaded",
    this._ID,
    this._on_event_project_loaded.bind(this),
  );
  this._sync_region_editor(this.via.va.get_selected_region());
}

_via_control_panel.prototype._button = function (
  label,
  title,
  onclick,
  class_name,
) {
  var b = document.createElement("button");
  b.setAttribute("type", "button");
  b.innerHTML = label;
  b.title = title;
  b.addEventListener("click", onclick);
  if (class_name) {
    b.classList.add(class_name);
  }
  return b;
};

_via_control_panel.prototype._init = function () {
  this.c.innerHTML = "";

  var logo = document.createElement("div");
  logo.classList.add("logo");
  logo.innerHTML = _VIA_NAME_SHORT;
  this.c.appendChild(logo);

  this.c.appendChild(this.via.vm.c);

  this.c.appendChild(
    this._button(
      "Add Images",
      "Add local images",
      this.via.vm._on_add_media_local.bind(this.via.vm),
    ),
  );
  this.c.appendChild(
    this._button(
      "Add PDF",
      "Convert PDF pages at 400 DPI and add as images",
      this.via.vm._on_add_pdf_local.bind(this.via.vm),
    ),
  );
  this.c.appendChild(
    this._button(
      "Prev",
      "Previous image",
      this.via.vm._on_prev_view.bind(this.via.vm),
    ),
  );
  this.c.appendChild(
    this._button(
      "Next",
      "Next image",
      this.via.vm._on_next_view.bind(this.via.vm),
    ),
  );
  this.c.appendChild(
    this._button(
      "Delete",
      "Delete current image",
      this.via.vm._on_del_view.bind(this.via.vm),
    ),
  );

  this.quad_button = this._button(
    "Quadrilateral",
    "Quadrilateral mode",
    function () {
      this._set_region_shape("QUADRILATERAL");
    }.bind(this),
    "selected",
  );
  this.c.appendChild(this.quad_button);

  this.c.appendChild(
    this._button(
      "Detect",
      "Run PP-OCRv5 detection on current image",
      function () {
        this.via.va.detect_current_image();
      }.bind(this),
    ),
  );

  this.c.appendChild(this._build_region_editor());

  this.c.appendChild(
    this._button(
      "Export JSON",
      "Export image + quadrilateral boxes as JSON",
      function () {
        this.via.d.export_quad_json().then(
          function () {
            _via_util_msg_show("Exported quadrilateral JSON.");
          },
          function (err) {
            _via_util_msg_show("Export failed: " + err, true);
          },
        );
      }.bind(this),
    ),
  );

  this.c.appendChild(
    this._button(
      "Export ICDAR 2015",
      "Export ICDAR 2015-style dataset ZIP",
      function () {
        this.via.d.export_icdar2015_zip().then(
          function (export_info) {
            if (export_info.missing_images.length) {
              _via_util_msg_show(
                "ICDAR export completed with " +
                  export_info.exported_images +
                  "/" +
                  export_info.total_images +
                  " image(s).",
                true,
              );
              return;
            }
            _via_util_msg_show(
              "ICDAR export completed: " +
                export_info.total_images +
                " image(s), " +
                export_info.total_gt_boxes +
                " box(es).",
            );
          },
          function (err) {
            _via_util_msg_show("ICDAR export failed: " + err, true);
          },
        );
      }.bind(this),
    ),
  );

  this.c.appendChild(
    this._button(
      "Open Project",
      "Load a saved VIA project",
      function () {
        _via_util_file_select_local(
          _VIA_FILE_SELECT_TYPE.PROJECT,
          this._project_load_on_local_file_select.bind(this),
          false,
        );
      }.bind(this),
    ),
  );

  this.c.appendChild(
    this._button(
      "Save Project",
      "Save current VIA project",
      function () {
        this.via.d.project_save().then(
          function (save_info) {
            if (save_info.missing_images.length) {
              _via_util_msg_show(
                "Project saved as ZIP with " +
                  save_info.embedded_images +
                  "/" +
                  save_info.total_images +
                  " embedded image(s).",
                true,
              );
            } else {
              _via_util_msg_show(
                "Project saved as ZIP with all images embedded.",
              );
            }
          },
          function (err) {
            _via_util_msg_show("Save failed: " + err, true);
          },
        );
      }.bind(this),
    ),
  );
};

_via_control_panel.prototype._build_region_editor = function () {
  var wrapper = document.createElement("div");
  wrapper.setAttribute("class", "region_editor");

  this.region_editor_title = document.createElement("span");
  this.region_editor_title.setAttribute("class", "region_editor_title");
  this.region_editor_title.innerHTML = "Selected Box";
  wrapper.appendChild(this.region_editor_title);

  this.region_text_input = document.createElement("input");
  this.region_text_input.setAttribute("type", "text");
  this.region_text_input.setAttribute("class", "region_text_input");
  this.region_text_input.setAttribute("placeholder", "Select a quadrilateral");
  this.region_text_input.disabled = true;
  this.region_text_input.addEventListener(
    "input",
    this._on_region_text_input.bind(this),
  );
  this.region_text_input.addEventListener(
    "blur",
    this._on_region_text_blur.bind(this),
  );
  this.region_text_input.addEventListener(
    "keydown",
    this._on_region_text_keydown.bind(this),
  );
  wrapper.appendChild(this.region_text_input);

  this.region_ignore_label = document.createElement("label");
  this.region_ignore_label.setAttribute("class", "region_ignore_label");

  this.region_ignore_checkbox = document.createElement("input");
  this.region_ignore_checkbox.setAttribute("type", "checkbox");
  this.region_ignore_checkbox.disabled = true;
  this.region_ignore_checkbox.addEventListener(
    "change",
    this._on_region_ignore_change.bind(this),
  );
  this.region_ignore_label.appendChild(this.region_ignore_checkbox);

  this.region_ignore_label.appendChild(document.createTextNode("Ignore (###)"));
  wrapper.appendChild(this.region_ignore_label);

  return wrapper;
};

_via_control_panel.prototype._clear_region_text_save_timer = function () {
  if (this.region_text_save_timer !== null) {
    clearTimeout(this.region_text_save_timer);
    this.region_text_save_timer = null;
  }
};

_via_control_panel.prototype._region_editor_is_dontcare = function (av) {
  if (!av || typeof av !== "object") {
    return false;
  }
  return av.dontcare === true || av.ignore === true || av.illegible === true;
};

_via_control_panel.prototype._region_editor_get_transcription = function (av) {
  if (!av || typeof av !== "object") {
    return "";
  }
  var key_list = ["transcription", "text", "label"];
  for (var i = 0; i < key_list.length; ++i) {
    var key = key_list[i];
    if (
      !av.hasOwnProperty(key) ||
      av[key] === null ||
      typeof av[key] === "undefined"
    ) {
      continue;
    }
    var text_value = av[key];
    if (Array.isArray(text_value)) {
      text_value = text_value.join(" ");
    }
    var safe_text = text_value
      .toString()
      .replace(/[\r\n]+/g, " ")
      .trim();
    if (safe_text.length) {
      return safe_text;
    }
  }
  return "";
};

_via_control_panel.prototype._sync_region_editor = function (selection) {
  var region = selection || { vid: "", mid: "", av: {} };
  this.region_selection = {
    vid: (region.vid || "").toString(),
    mid: (region.mid || "").toString(),
  };

  var has_selection = this.region_selection.mid !== "";
  var av = region.av || {};
  var is_dontcare = this._region_editor_is_dontcare(av);
  var transcription = this._region_editor_get_transcription(av);

  this.region_editor_sync = true;
  this.region_ignore_checkbox.checked = is_dontcare;
  this.region_ignore_checkbox.disabled = !has_selection;
  this.region_text_input.value = transcription;
  if (!has_selection) {
    this.region_text_input.disabled = true;
    this.region_text_input.placeholder = "Select a quadrilateral";
  } else if (is_dontcare) {
    this.region_text_input.disabled = true;
    this.region_text_input.placeholder = "Ignored region (###)";
  } else {
    this.region_text_input.disabled = false;
    this.region_text_input.placeholder = "Type transcription...";
  }
  this.region_editor_sync = false;
};

_via_control_panel.prototype._on_event_region_selection_change = function (
  data,
  event_payload,
) {
  this._clear_region_text_save_timer();
  this._sync_region_editor(event_payload);
};

_via_control_panel.prototype._on_event_project_loaded = function () {
  this._clear_region_text_save_timer();
  this._sync_region_editor(this.via.va.get_selected_region());
};

_via_control_panel.prototype._commit_region_text_input = function () {
  if (this.region_editor_sync || this.region_selection.mid === "") {
    return;
  }

  this._clear_region_text_save_timer();
  this.via.va
    .set_selected_region_transcription(this.region_text_input.value)
    .then(
      function () {
        // no-op
      },
      function (err) {
        _via_util_msg_show("Failed to save transcription: " + err, true);
      },
    );
};

_via_control_panel.prototype._on_region_text_input = function () {
  if (this.region_editor_sync || this.region_text_input.disabled) {
    return;
  }
  this._clear_region_text_save_timer();
  this.region_text_save_timer = setTimeout(
    function () {
      this._commit_region_text_input();
    }.bind(this),
    250,
  );
};

_via_control_panel.prototype._on_region_text_blur = function () {
  this._commit_region_text_input();
};

_via_control_panel.prototype._on_region_text_keydown = function (e) {
  if (e.key !== "Enter") {
    return;
  }
  e.preventDefault();
  this._commit_region_text_input();
};

_via_control_panel.prototype._on_region_ignore_change = function () {
  if (this.region_editor_sync || this.region_selection.mid === "") {
    return;
  }
  this._clear_region_text_save_timer();
  this.via.va
    .set_selected_region_dontcare(this.region_ignore_checkbox.checked)
    .then(
      function () {
        // no-op
      },
      function (err) {
        _via_util_msg_show("Failed to update ignore flag: " + err, true);
      },
    );
};

_via_control_panel.prototype._set_region_shape = function (shape) {
  if (shape === "QUADRILATERAL") {
    this.quad_button.classList.add("selected");
  }
  this.via.va.set_region_draw_shape(shape);
};

_via_control_panel.prototype._project_load_on_local_file_select = function (e) {
  if (e.target.files.length !== 1) {
    return;
  }
  this.via.d.project_load_file(e.target.files[0]).then(
    function (load_info) {
      if (
        load_info &&
        load_info.total_images > 0 &&
        load_info.embedded_images < load_info.total_images
      ) {
        _via_util_msg_show(
          "Project loaded with " +
            load_info.embedded_images +
            "/" +
            load_info.total_images +
            " embedded image(s).",
          true,
        );
        return;
      }
      _via_util_msg_show("Project loaded.");
    },
    function (err) {
      _via_util_msg_show("Failed to load project: " + err, true);
    },
  );
};
