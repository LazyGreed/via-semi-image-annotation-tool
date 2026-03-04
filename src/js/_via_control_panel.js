/**
 * Image-only control panel.
 */

'use strict';

function _via_control_panel(control_panel_container, via) {
  this._ID = '_via_control_panel_';
  this.c = control_panel_container;
  this.via = via;

  _via_event.call(this);

  this._init();
}

_via_control_panel.prototype._button = function(label, title, onclick, class_name) {
  var b = document.createElement('button');
  b.setAttribute('type', 'button');
  b.innerHTML = label;
  b.title = title;
  b.addEventListener('click', onclick);
  if (class_name) {
    b.classList.add(class_name);
  }
  return b;
};

_via_control_panel.prototype._init = function() {
  this.c.innerHTML = '';

  var logo = document.createElement('div');
  logo.classList.add('logo');
  logo.innerHTML = _VIA_NAME_SHORT;
  this.c.appendChild(logo);

  this.c.appendChild(this.via.vm.c);

  this.c.appendChild(this._button('Add Images', 'Add local images', this.via.vm._on_add_media_local.bind(this.via.vm)));
  this.c.appendChild(this._button('Prev', 'Previous image', this.via.vm._on_prev_view.bind(this.via.vm)));
  this.c.appendChild(this._button('Next', 'Next image', this.via.vm._on_next_view.bind(this.via.vm)));
  this.c.appendChild(this._button('Delete', 'Delete current image', this.via.vm._on_del_view.bind(this.via.vm)));

  this.quad_button = this._button('Quadrilateral', 'Quadrilateral mode', function() {
    this._set_region_shape('QUADRILATERAL');
  }.bind(this), 'selected');
  this.c.appendChild(this.quad_button);

  this.c.appendChild(this._button('Detect', 'Run PP-OCRv5 detection on current image', function() {
    this.via.va.detect_current_image();
  }.bind(this)));

  this.c.appendChild(this._button('Export JSON', 'Export image + quadrilateral boxes as JSON', function() {
    this.via.d.export_quad_json().then(function() {
      _via_util_msg_show('Exported quadrilateral JSON.');
    }, function(err) {
      _via_util_msg_show('Export failed: ' + err, true);
    });
  }.bind(this)));

  this.c.appendChild(this._button('Open Project', 'Load a saved VIA project', function() {
    _via_util_file_select_local(_VIA_FILE_SELECT_TYPE.PROJECT, this._project_load_on_local_file_select.bind(this), false);
  }.bind(this)));

  this.c.appendChild(this._button('Save Project', 'Save current VIA project', function() {
    this.via.d.project_save().then(function(save_info) {
      if (save_info.missing_images.length) {
        _via_util_msg_show('Project saved as ZIP with ' + save_info.embedded_images + '/' + save_info.total_images + ' embedded image(s).', true);
      } else {
        _via_util_msg_show('Project saved as ZIP with all images embedded.');
      }
    }, function(err) {
      _via_util_msg_show('Save failed: ' + err, true);
    });
  }.bind(this)));
};

_via_control_panel.prototype._set_region_shape = function(shape) {
  if (shape === 'QUADRILATERAL') {
    this.quad_button.classList.add('selected');
  }
  this.via.va.set_region_draw_shape(shape);
};

_via_control_panel.prototype._project_load_on_local_file_select = function(e) {
  if (e.target.files.length !== 1) {
    return;
  }
  this.via.d.project_load_file(e.target.files[0]).then(function(load_info) {
    if (load_info && load_info.total_images > 0 && load_info.embedded_images < load_info.total_images) {
      _via_util_msg_show('Project loaded with ' + load_info.embedded_images + '/' + load_info.total_images + ' embedded image(s).', true);
      return;
    }
    _via_util_msg_show('Project loaded.');
  }, function(err) {
    _via_util_msg_show('Failed to load project: ' + err, true);
  });
};
