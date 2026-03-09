/**
 * @class
 * @classdesc Stores files, views and annotations for image-only workflow.
 */

"use strict";

function _via_data() {
  this._ID = "_via_data_";
  this.DATA_FORMAT_VERSION = "4.0.0";

  this.store = this._init_default_project();
  this.file_ref = {};
  this.file_object_uri = {};
  this.cache = { mid_list: {} };

  _via_event.call(this);
}

_via_data.prototype._init_default_project = function () {
  return {
    project: {
      pid: "via" + _via_util_uuid(),
      pname: "Unnamed VIA Project",
      created: Date.now(),
      data_format_version: this.DATA_FORMAT_VERSION,
      vid_list: [],
    },
    config: {
      file: {
        loc_prefix: { 1: "", 2: "", 3: "", 4: "" },
      },
      ocr: {
        endpoint: _VIA_CONFIG.OCR_ENDPOINT,
        timeout_ms: _VIA_CONFIG.OCR_TIMEOUT_MS,
      },
      ui: {},
    },
    file: {},
    view: {},
    metadata: {},
  };
};

_via_data.prototype._cache_update = function () {
  this.cache.mid_list = {};
  for (var mid in this.store.metadata) {
    var vid = this.store.metadata[mid].vid;
    if (!this.cache.mid_list.hasOwnProperty(vid)) {
      this.cache.mid_list[vid] = [];
    }
    this.cache.mid_list[vid].push(mid);
  }
};

_via_data.prototype._file_get_new_id = function () {
  var max_fid = 0;
  for (var fid in this.store.file) {
    max_fid = Math.max(max_fid, parseInt(fid, 10));
  }
  return (max_fid + 1).toString();
};

_via_data.prototype._view_get_new_id = function () {
  var max_vid = 0;
  for (var vid in this.store.view) {
    max_vid = Math.max(max_vid, parseInt(vid, 10));
  }
  return (max_vid + 1).toString();
};

_via_data.prototype._metadata_get_new_id = function (vid) {
  return vid + "_" + _via_util_uid6();
};

_via_data.prototype.view_get_file_vid = function (fid) {
  for (var vid in this.store.view) {
    if (_via_util_array_eq(this.store.view[vid].fid_list, [fid])) {
      return vid;
    }
  }
  return -1;
};

_via_data.prototype.file_set_dimensions = function (fid, width, height) {
  if (this.store.file.hasOwnProperty(fid)) {
    this.store.file[fid].width = width;
    this.store.file[fid].height = height;
  }
};

_via_data.prototype.file_get_uri = function (fid) {
  if (!this.store.file.hasOwnProperty(fid)) {
    return "";
  }
  var f = this.store.file[fid];
  if (this.file_ref.hasOwnProperty(fid)) {
    return this.file_ref[fid].name || f.fname;
  }
  if (f.loc === _VIA_FILE_LOC.LOCAL) {
    return f.fname;
  }
  return this.store.config.file.loc_prefix[f.loc] + f.src;
};

_via_data.prototype.file_get_src = function (fid) {
  if (!this.store.file.hasOwnProperty(fid)) {
    return "";
  }

  if (this.file_ref.hasOwnProperty(fid)) {
    if (this.file_object_uri.hasOwnProperty(fid)) {
      return this.file_object_uri[fid];
    }
    this.file_object_uri[fid] = URL.createObjectURL(this.file_ref[fid]);
    return this.file_object_uri[fid];
  }

  if (this.store.file[fid].loc === _VIA_FILE_LOC.LOCAL) {
    return "";
  }

  return (
    this.store.config.file.loc_prefix[this.store.file[fid].loc] +
    this.store.file[fid].src
  );
};

_via_data.prototype.file_free_resources = function (fid) {
  if (this.file_object_uri.hasOwnProperty(fid)) {
    URL.revokeObjectURL(this.file_object_uri[fid]);
    delete this.file_object_uri[fid];
  }
};

_via_data.prototype.view_bulk_add_from_filelist = function (filelist) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        var added_fid_list = [];
        var added_vid_list = [];

        for (var i = 0; i < filelist.length; ++i) {
          var item = filelist[i];
          if (item.type !== _VIA_FILE_TYPE.IMAGE) {
            continue;
          }

          var fid = this._file_get_new_id();
          var src = item.src;
          if (item.loc === _VIA_FILE_LOC.LOCAL) {
            this.file_ref[fid] = item.src;
            src = "";
          }

          this.store.file[fid] = new _via_file(
            fid,
            item.fname,
            _VIA_FILE_TYPE.IMAGE,
            item.loc,
            src,
            null,
            null,
          );

          var vid = this._view_get_new_id();
          this.store.view[vid] = { fid_list: [fid] };
          this.store.project.vid_list.push(vid);

          added_fid_list.push(fid);
          added_vid_list.push(vid);
        }

        this._cache_update();
        var payload = { vid_list: added_vid_list, fid_list: added_fid_list };
        this.emit_event("view_bulk_add", payload);
        ok_callback(payload);
      } catch (err) {
        err_callback(err);
      }
    }.bind(this),
  );
};

_via_data.prototype.view_del = function (vid) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.view.hasOwnProperty(vid)) {
          err_callback("vid does not exist");
          return;
        }

        var vindex = this.store.project.vid_list.indexOf(vid);
        if (vindex === -1) {
          err_callback("view index missing");
          return;
        }

        var deleted_mid_list = [];
        for (var mid in this.store.metadata) {
          if (this.store.metadata[mid].vid === vid) {
            deleted_mid_list.push(mid);
            delete this.store.metadata[mid];
          }
        }

        var fid_list = this.store.view[vid].fid_list.slice(0);
        for (var i = 0; i < fid_list.length; ++i) {
          var fid = fid_list[i];
          this.file_free_resources(fid);
          delete this.file_ref[fid];
          delete this.store.file[fid];
        }

        delete this.store.view[vid];
        this.store.project.vid_list.splice(vindex, 1);

        this._cache_update();
        this.emit_event("metadata_delete_bulk", {
          vid: vid,
          mid_list: deleted_mid_list,
        });
        this.emit_event("view_del", { vid: vid, vindex: vindex });
        ok_callback({ vid: vid, vindex: vindex });
      } catch (err) {
        err_callback(err);
      }
    }.bind(this),
  );
};

_via_data.prototype.metadata_add = function (vid, z, xy, av) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.view.hasOwnProperty(vid)) {
          err_callback({ vid: vid });
          return;
        }

        var mid = this._metadata_get_new_id(vid);
        var z_fp = _via_util_float_arr_to_fixed(z, _VIA_FLOAT_FIXED_POINT);
        var xy_fp = _via_util_float_arr_to_fixed(xy, _VIA_FLOAT_FIXED_POINT);
        this.store.metadata[mid] = new _via_metadata(
          vid,
          z_fp,
          xy_fp,
          av || {},
        );

        this._cache_update();
        this.emit_event("metadata_add", { vid: vid, mid: mid });
        ok_callback({ vid: vid, mid: mid });
      } catch (ex) {
        err_callback(ex);
      }
    }.bind(this),
  );
};

_via_data.prototype.metadata_add_bulk = function (metadata_list) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        var added_mid_list = [];
        for (var i = 0; i < metadata_list.length; ++i) {
          var m = metadata_list[i];
          if (!this.store.view.hasOwnProperty(m.vid)) {
            continue;
          }
          var mid = this._metadata_get_new_id(m.vid);
          var z_fp = _via_util_float_arr_to_fixed(
            m.z || [],
            _VIA_FLOAT_FIXED_POINT,
          );
          var xy_fp = _via_util_float_arr_to_fixed(
            m.xy || [],
            _VIA_FLOAT_FIXED_POINT,
          );
          this.store.metadata[mid] = new _via_metadata(
            m.vid,
            z_fp,
            xy_fp,
            m.av || {},
          );
          added_mid_list.push(mid);
        }
        this._cache_update();
        this.emit_event("metadata_add_bulk", { mid_list: added_mid_list });
        ok_callback({ mid_list: added_mid_list });
      } catch (ex) {
        err_callback(ex);
      }
    }.bind(this),
  );
};

_via_data.prototype.metadata_update_xy = function (vid, mid, xy) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.view.hasOwnProperty(vid)) {
          err_callback({ vid: vid });
          return;
        }
        if (!this.store.metadata.hasOwnProperty(mid)) {
          err_callback({ mid: mid });
          return;
        }
        this.store.metadata[mid].xy = _via_util_float_arr_to_fixed(
          xy,
          _VIA_FLOAT_FIXED_POINT,
        );
        this.emit_event("metadata_update", { vid: vid, mid: mid });
        ok_callback({ vid: vid, mid: mid });
      } catch (ex) {
        err_callback(ex);
      }
    }.bind(this),
  );
};

_via_data.prototype.metadata_update_av = function (vid, mid, av) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.view.hasOwnProperty(vid)) {
          err_callback({ vid: vid });
          return;
        }
        if (!this.store.metadata.hasOwnProperty(mid)) {
          err_callback({ mid: mid });
          return;
        }
        if (!av || typeof av !== "object") {
          this.store.metadata[mid].av = {};
        } else {
          this.store.metadata[mid].av = JSON.parse(JSON.stringify(av));
        }
        this.emit_event("metadata_update", { vid: vid, mid: mid });
        ok_callback({ vid: vid, mid: mid });
      } catch (ex) {
        err_callback(ex);
      }
    }.bind(this),
  );
};

_via_data.prototype.metadata_delete_bulk = function (vid, mid_list) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.view.hasOwnProperty(vid)) {
          err_callback({ vid: vid });
          return;
        }

        var deleted_mid_list = [];
        for (var i = 0; i < mid_list.length; ++i) {
          var mid = mid_list[i];
          if (this.store.metadata.hasOwnProperty(mid)) {
            delete this.store.metadata[mid];
            deleted_mid_list.push(mid);
          }
        }

        this._cache_update();
        this.emit_event("metadata_delete_bulk", {
          vid: vid,
          mid_list: deleted_mid_list,
        });
        ok_callback({ vid: vid, mid_list: deleted_mid_list });
      } catch (ex) {
        err_callback(ex);
      }
    }.bind(this),
  );
};

_via_data.prototype.metadata_delete_spatial_by_vid = function (vid) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.view.hasOwnProperty(vid)) {
          err_callback({ vid: vid });
          return;
        }

        var mid_list = this.cache.mid_list.hasOwnProperty(vid)
          ? this.cache.mid_list[vid].slice(0)
          : [];
        var spatial_mid_list = [];
        for (var i = 0; i < mid_list.length; ++i) {
          var mid = mid_list[i];
          if (this.store.metadata[mid].xy.length !== 0) {
            spatial_mid_list.push(mid);
          }
        }

        this.metadata_delete_bulk(vid, spatial_mid_list).then(
          function (ok) {
            ok_callback(ok);
          },
          function (err) {
            err_callback(err);
          },
        );
      } catch (ex) {
        err_callback(ex);
      }
    }.bind(this),
  );
};

_via_data.prototype._release_all_file_resources = function () {
  for (var fid in this.file_object_uri) {
    URL.revokeObjectURL(this.file_object_uri[fid]);
  }
  this.file_object_uri = {};
  this.file_ref = {};
};

_via_data.prototype._blob_to_uint8 = function (blob_data) {
  return new Promise(function (ok_callback, err_callback) {
    try {
      if (blob_data && typeof blob_data.arrayBuffer === "function") {
        blob_data.arrayBuffer().then(
          function (buffer) {
            ok_callback(new Uint8Array(buffer));
          },
          function (err) {
            err_callback(err);
          },
        );
        return;
      }

      var file_reader = new FileReader();
      file_reader.addEventListener(
        "error",
        function () {
          err_callback("failed to read file blob");
        },
        false,
      );
      file_reader.addEventListener(
        "load",
        function () {
          ok_callback(new Uint8Array(file_reader.result));
        },
        false,
      );
      file_reader.readAsArrayBuffer(blob_data);
    } catch (err) {
      err_callback(err);
    }
  });
};

_via_data.prototype._project_archive_entry_name = function (fid, filename) {
  var clean_name = _via_util_sanitize_filename(filename || "image_" + fid);
  if (clean_name === "") {
    clean_name = "image_" + fid;
  }
  return ["images/", fid, "_", clean_name].join("");
};

_via_data.prototype._project_get_file_blob = function (fid) {
  return new Promise(
    function (ok_callback, err_callback) {
      if (!this.store.file.hasOwnProperty(fid)) {
        err_callback("missing file record");
        return;
      }

      if (this.file_ref.hasOwnProperty(fid)) {
        ok_callback(this.file_ref[fid]);
        return;
      }

      var file_src = this.file_get_src(fid);
      if (!file_src) {
        err_callback("image source is not available");
        return;
      }

      _via_util_fetch_blob(file_src).then(
        function (image_blob) {
          ok_callback(image_blob);
        },
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_data.prototype.project_save = function () {
  return new Promise(
    function (ok_callback, err_callback) {
      var export_store = JSON.parse(JSON.stringify(this.store));
      export_store._via_image_archive = { version: 1, image_fid_to_path: {} };

      var fid_list = Object.keys(this.store.file);
      var missing_images = [];
      var image_entry_promises = [];

      for (var i = 0; i < fid_list.length; ++i) {
        (function (fid, filename, self) {
          image_entry_promises.push(
            self._project_get_file_blob(fid).then(
              function (blob_data) {
                return self
                  ._blob_to_uint8(blob_data)
                  .then(function (data_uint8) {
                    var archive_name = self._project_archive_entry_name(
                      fid,
                      filename,
                    );
                    export_store._via_image_archive.image_fid_to_path[fid] =
                      archive_name;
                    return { name: archive_name, data: data_uint8 };
                  });
              },
              function (err) {
                missing_images.push({
                  fid: fid,
                  fname: filename,
                  reason: err.toString(),
                });
                return null;
              },
            ),
          );
        })(fid_list[i], this.store.file[fid_list[i]].fname, this);
      }

      Promise.all(image_entry_promises).then(
        function (image_entries) {
          var zip_entries = [];
          zip_entries.push({
            name: "project.json",
            data: _via_util_text_to_uint8(
              JSON.stringify(export_store, null, 2),
            ),
          });

          for (var eindex = 0; eindex < image_entries.length; ++eindex) {
            if (image_entries[eindex] !== null) {
              zip_entries.push(image_entries[eindex]);
            }
          }

          _via_util_zip_create_blob(zip_entries).then(
            function (zip_blob) {
              var filename = [
                "via_project_",
                _via_util_date_to_filename_str(Date.now()),
                ".zip",
              ].join("");
              _via_util_download_as_file(zip_blob, filename);
              ok_callback({
                total_images: fid_list.length,
                embedded_images: fid_list.length - missing_images.length,
                missing_images: missing_images,
              });
            },
            function (err) {
              err_callback(err);
            },
          );
        },
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_data.prototype.project_load = function (project_data_str) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        var project_json_data = JSON.parse(project_data_str);
        this.project_load_json(project_json_data).then(
          function () {
            ok_callback();
          },
          function (err) {
            err_callback(err);
          },
        );
      } catch (err) {
        err_callback(err);
      }
    }.bind(this),
  );
};

_via_data.prototype.project_load_file = function (project_file) {
  return new Promise(
    function (ok_callback, err_callback) {
      if (!project_file) {
        err_callback("missing project file");
        return;
      }

      var file_ext = _via_util_file_ext(project_file.name || "").toLowerCase();
      if (file_ext === "zip" || project_file.type === "application/zip") {
        this.project_load_zip_file(project_file).then(
          function (ok) {
            ok_callback(ok);
          },
          function (err) {
            err_callback(err);
          },
        );
        return;
      }

      _via_util_load_text_file(
        project_file,
        function (project_data_str) {
          this.project_load(project_data_str).then(
            function () {
              ok_callback({
                total_images: Object.keys(this.store.file).length,
                embedded_images: 0,
              });
            }.bind(this),
            function (err) {
              err_callback(err);
            },
          );
        }.bind(this),
      );
    }.bind(this),
  );
};

_via_data.prototype.project_load_zip_file = function (project_zip_file) {
  return new Promise(
    function (ok_callback, err_callback) {
      _via_util_zip_extract(project_zip_file).then(
        function (zip_entries) {
          try {
            var project_entry_name = "project.json";
            if (!zip_entries.hasOwnProperty(project_entry_name)) {
              for (var entry_name in zip_entries) {
                if (_via_util_file_ext(entry_name).toLowerCase() === "json") {
                  project_entry_name = entry_name;
                  break;
                }
              }
            }

            if (!zip_entries.hasOwnProperty(project_entry_name)) {
              err_callback("zip does not contain project json");
              return;
            }

            var project_json_str = _via_util_uint8_to_text(
              zip_entries[project_entry_name],
            );
            var project_json_data = JSON.parse(project_json_str);

            var archive_map = {};
            if (
              project_json_data.hasOwnProperty("_via_image_archive") &&
              project_json_data._via_image_archive &&
              project_json_data._via_image_archive.hasOwnProperty(
                "image_fid_to_path",
              )
            ) {
              archive_map =
                project_json_data._via_image_archive.image_fid_to_path;
            }

            var file_ref_map = {};
            for (var fid in project_json_data.file) {
              var file_record = project_json_data.file[fid];
              var archive_name = "";

              if (archive_map.hasOwnProperty(fid)) {
                archive_name = archive_map[fid];
              } else {
                archive_name = this._project_archive_entry_name(
                  fid,
                  file_record.fname,
                );
              }

              if (!zip_entries.hasOwnProperty(archive_name)) {
                archive_name = "";
                for (var zip_name in zip_entries) {
                  if (
                    _via_util_get_filename_from_uri(zip_name) ===
                    file_record.fname
                  ) {
                    archive_name = zip_name;
                    break;
                  }
                }
              }

              if (
                archive_name === "" ||
                !zip_entries.hasOwnProperty(archive_name)
              ) {
                continue;
              }

              file_ref_map[fid] = _via_util_uint8_to_file(
                zip_entries[archive_name],
                file_record.fname,
                _via_util_infer_mime_type_from_filename(file_record.fname),
              );
            }

            this.project_load_json(project_json_data, file_ref_map).then(
              function () {
                ok_callback({
                  total_images: Object.keys(project_json_data.file).length,
                  embedded_images: Object.keys(file_ref_map).length,
                });
              },
              function (err) {
                err_callback(err);
              },
            );
          } catch (err) {
            err_callback(err);
          }
        }.bind(this),
        function (err) {
          err_callback(err);
        },
      );
    }.bind(this),
  );
};

_via_data.prototype.project_load_json = function (
  project_json_data,
  file_ref_map,
) {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        this._release_all_file_resources();
        this.store = project_json_data;
        if (!this.store.config) {
          this.store.config = {
            file: { loc_prefix: { 1: "", 2: "", 3: "", 4: "" } },
            ocr: {
              endpoint: _VIA_CONFIG.OCR_ENDPOINT,
              timeout_ms: _VIA_CONFIG.OCR_TIMEOUT_MS,
            },
            ui: {},
          };
        }
        if (!this.store.config.file) {
          this.store.config.file = {
            loc_prefix: { 1: "", 2: "", 3: "", 4: "" },
          };
        }
        if (!this.store.config.file.loc_prefix) {
          this.store.config.file.loc_prefix = { 1: "", 2: "", 3: "", 4: "" };
        }
        if (!this.store.config.ocr) {
          this.store.config.ocr = {
            endpoint: _VIA_CONFIG.OCR_ENDPOINT,
            timeout_ms: _VIA_CONFIG.OCR_TIMEOUT_MS,
          };
        }
        if (!this.store.config.ui) {
          this.store.config.ui = {};
        }
        if (file_ref_map && typeof file_ref_map === "object") {
          for (var fid in file_ref_map) {
            this.file_ref[fid] = file_ref_map[fid];
          }
        }

        this._cache_update();
        this.emit_event("project_loaded", { pid: this.store.project.pid });
        ok_callback();
      } catch (err) {
        err_callback(err);
      }
    }.bind(this),
  );
};

_via_data.prototype._icdar2015_split_name = function (filename) {
  var clean_name = _via_util_sanitize_filename(filename || "");
  if (clean_name === "") {
    clean_name = "image";
  }
  var dot_index = clean_name.lastIndexOf(".");
  if (dot_index <= 0 || dot_index === clean_name.length - 1) {
    return { stem: clean_name, ext: "" };
  }
  return {
    stem: clean_name.substr(0, dot_index),
    ext: clean_name.substr(dot_index),
  };
};

_via_data.prototype._icdar2015_get_archive_name_map = function () {
  var name_map = {};
  var used_image_names = {};
  var used_gt_names = {};

  for (var i = 0; i < this.store.project.vid_list.length; ++i) {
    var vid = this.store.project.vid_list[i];
    if (!this.store.view.hasOwnProperty(vid)) {
      continue;
    }

    var fid = this.store.view[vid].fid_list[0];
    if (!this.store.file.hasOwnProperty(fid)) {
      continue;
    }

    var file_record = this.store.file[fid];
    var name_parts = this._icdar2015_split_name(
      file_record.fname || "image_" + fid + ".jpg",
    );
    var image_name = name_parts.stem + name_parts.ext;
    var suffix_index = 1;
    while (used_image_names.hasOwnProperty(image_name)) {
      image_name =
        name_parts.stem + "_" + fid + "_" + suffix_index + name_parts.ext;
      ++suffix_index;
    }
    used_image_names[image_name] = true;

    var image_name_parts = this._icdar2015_split_name(image_name);
    var gt_name = "gt_" + image_name_parts.stem + ".txt";
    var gt_suffix_index = 1;
    while (used_gt_names.hasOwnProperty(gt_name)) {
      gt_name =
        "gt_" +
        image_name_parts.stem +
        "_" +
        fid +
        "_" +
        gt_suffix_index +
        ".txt";
      ++gt_suffix_index;
    }
    used_gt_names[gt_name] = true;

    name_map[fid] = {
      image_name: image_name,
      gt_name: gt_name,
    };
  }

  return name_map;
};

_via_data.prototype._icdar2015_get_transcription = function (av) {
  if (av && typeof av === "object") {
    if (av.dontcare === true || av.ignore === true || av.illegible === true) {
      return "###";
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

      var text = text_value
        .toString()
        .replace(/[\r\n]+/g, " ")
        .trim();
      if (text.length) {
        return text;
      }
    }
  }

  return "###";
};

_via_data.prototype._icdar2015_quad_to_line = function (
  file_record,
  flat_xy,
  transcription,
) {
  var normalized = _via_util_normalize_quad_points(flat_xy);
  if (normalized.length !== 8) {
    return "";
  }

  var max_x = null;
  var max_y = null;
  if (
    file_record &&
    typeof file_record.width === "number" &&
    isFinite(file_record.width) &&
    file_record.width > 0
  ) {
    max_x = file_record.width - 1;
  }
  if (
    file_record &&
    typeof file_record.height === "number" &&
    isFinite(file_record.height) &&
    file_record.height > 0
  ) {
    max_y = file_record.height - 1;
  }

  var out = [];
  for (var i = 0; i < 4; ++i) {
    var x = normalized[2 * i];
    var y = normalized[2 * i + 1];
    if (max_x !== null) {
      x = _via_util_clamp(x, 0, max_x);
    }
    if (max_y !== null) {
      y = _via_util_clamp(y, 0, max_y);
    }
    out.push(Math.round(x), Math.round(y));
  }

  return out.join(",") + "," + transcription;
};

_via_data.prototype.export_icdar2015_zip = function () {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        if (!this.store.project.vid_list.length) {
          err_callback("no images in project");
          return;
        }

        var archive_name_map = this._icdar2015_get_archive_name_map();
        var zip_entries = [];
        var missing_images = [];
        var image_entry_promises = [];
        var total_gt_boxes = 0;

        for (var i = 0; i < this.store.project.vid_list.length; ++i) {
          var vid = this.store.project.vid_list[i];
          if (!this.store.view.hasOwnProperty(vid)) {
            continue;
          }

          var fid = this.store.view[vid].fid_list[0];
          if (
            !this.store.file.hasOwnProperty(fid) ||
            !archive_name_map.hasOwnProperty(fid)
          ) {
            continue;
          }

          var file_record = this.store.file[fid];
          var archive_names = archive_name_map[fid];
          var gt_lines = [];
          var mid_list = this.cache.mid_list.hasOwnProperty(vid)
            ? this.cache.mid_list[vid]
            : [];

          for (var m = 0; m < mid_list.length; ++m) {
            var mid = mid_list[m];
            if (!this.store.metadata.hasOwnProperty(mid)) {
              continue;
            }

            var md = this.store.metadata[mid];
            if (
              !md ||
              !Array.isArray(md.xy) ||
              md.xy.length !== 9 ||
              md.xy[0] !== _VIA_RSHAPE.POLYGON
            ) {
              continue;
            }

            var gt_line = this._icdar2015_quad_to_line(
              file_record,
              md.xy.slice(1),
              this._icdar2015_get_transcription(md.av),
            );
            if (gt_line !== "") {
              gt_lines.push(gt_line);
            }
          }

          total_gt_boxes += gt_lines.length;

          zip_entries.push({
            name: "gt/" + archive_names.gt_name,
            data: _via_util_text_to_uint8(gt_lines.join("\n")),
          });

          (function (bound_fid, bound_filename, bound_archive_names, self) {
            image_entry_promises.push(
              self._project_get_file_blob(bound_fid).then(
                function (blob_data) {
                  return self
                    ._blob_to_uint8(blob_data)
                    .then(function (data_uint8) {
                      return {
                        name: "images/" + bound_archive_names.image_name,
                        data: data_uint8,
                      };
                    });
                },
                function (err) {
                  missing_images.push({
                    fid: bound_fid,
                    fname: bound_filename,
                    reason: err.toString(),
                  });
                  return null;
                },
              ),
            );
          })(fid, file_record.fname, archive_names, this);
        }

        Promise.all(image_entry_promises).then(
          function (image_entries) {
            for (var eindex = 0; eindex < image_entries.length; ++eindex) {
              if (image_entries[eindex] !== null) {
                zip_entries.push(image_entries[eindex]);
              }
            }

            _via_util_zip_create_blob(zip_entries).then(
              function (zip_blob) {
                var filename = [
                  "icdar2015_export_",
                  _via_util_date_to_filename_str(Date.now()),
                  ".zip",
                ].join("");
                _via_util_download_as_file(zip_blob, filename);
                ok_callback({
                  total_images: image_entry_promises.length,
                  exported_images:
                    image_entry_promises.length - missing_images.length,
                  missing_images: missing_images,
                  total_gt_boxes: total_gt_boxes,
                });
              },
              function (err) {
                err_callback(err);
              },
            );
          },
          function (err) {
            err_callback(err);
          },
        );
      } catch (err) {
        err_callback(err);
      }
    }.bind(this),
  );
};

_via_data.prototype.export_quad_json = function () {
  return new Promise(
    function (ok_callback, err_callback) {
      try {
        var out = {
          version: "via-quad-v1",
          images: [],
        };

        for (var i = 0; i < this.store.project.vid_list.length; ++i) {
          var vid = this.store.project.vid_list[i];
          if (!this.store.view.hasOwnProperty(vid)) {
            continue;
          }
          var fid = this.store.view[vid].fid_list[0];
          var file = this.store.file[fid];
          if (!file) {
            continue;
          }

          var image_entry = {
            fid: fid,
            filename: file.fname,
            width: file.width,
            height: file.height,
            boxes: [],
          };

          var mid_list = this.cache.mid_list.hasOwnProperty(vid)
            ? this.cache.mid_list[vid]
            : [];
          for (var m = 0; m < mid_list.length; ++m) {
            var mid = mid_list[m];
            var md = this.store.metadata[mid];
            if (md.xy.length !== 9) {
              continue;
            }
            if (md.xy[0] !== _VIA_RSHAPE.POLYGON) {
              continue;
            }
            image_entry.boxes.push(
              _via_util_normalize_quad_points(md.xy.slice(1)),
            );
          }

          out.images.push(image_entry);
        }

        var data_blob = new Blob([JSON.stringify(out, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        var filename = [
          "via_quad_export_",
          _via_util_date_to_filename_str(Date.now()),
          ".json",
        ].join("");
        _via_util_download_as_file(data_blob, filename);
        ok_callback(out);
      } catch (err) {
        err_callback(err);
      }
    }.bind(this),
  );
};
