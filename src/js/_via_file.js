/**
 * @class
 * @classdesc File record
 */

"use strict";

const _VIA_FILE_TYPE = { IMAGE: 2 };
const _VIA_FILE_LOC = { LOCAL: 1, URIHTTP: 2, URIFILE: 3, INLINE: 4 };

function _via_file(fid, fname, type, loc, src, width, height) {
  this.fid = fid;
  this.fname = fname;
  this.type = type;
  this.loc = loc;
  this.src = src;
  this.width = typeof width === "number" ? width : null;
  this.height = typeof height === "number" ? height : null;
}
