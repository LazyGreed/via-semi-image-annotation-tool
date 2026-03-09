/**
 * VIA image-only app bootstrap.
 */

"use strict";

function _via(via_container) {
  this._ID = "_via";
  this.via_container = via_container;

  this.d = new _via_data();

  this.control_panel_container = document.createElement("div");
  this.control_panel_container.setAttribute(
    "id",
    "via_control_panel_container",
  );
  this.via_container.appendChild(this.control_panel_container);

  this.view_container = document.createElement("div");
  this.view_container.setAttribute("id", "view_container");
  this.via_container.appendChild(this.view_container);

  this.message_container = document.createElement("div");
  this.message_container.setAttribute("id", "_via_message_container");
  this.message_container.setAttribute("class", "message_container");
  this.message_container.addEventListener("click", _via_util_msg_hide);

  this.message_panel = document.createElement("div");
  this.message_panel.setAttribute("id", "_via_message");
  this.message_container.appendChild(this.message_panel);
  this.via_container.appendChild(this.message_container);

  this.va = new _via_view_annotator(this.d, this.view_container);

  this.view_manager_container = document.createElement("div");
  this.vm = new _via_view_manager(this.d, this.va, this.view_manager_container);
  this.vm._init();

  this.cp = new _via_control_panel(this.control_panel_container, this);
  this.cp._set_region_shape("QUADRILATERAL");

  window.addEventListener("keydown", this._keydown_handler.bind(this));

  _via_util_msg_show(_VIA_NAME + " " + _VIA_VERSION + " ready.");
}

_via.prototype._hook_on_browser_resize = function () {
  this.va.refresh();
};

_via.prototype._keydown_handler = function (e) {
  if (e.target.type !== "text" && e.target.type !== "textarea") {
    this.va._on_event_keydown(e);
  }
};
