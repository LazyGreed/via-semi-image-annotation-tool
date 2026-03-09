/**
 * @class
 * @classdesc Metadata
 */

"use strict";

const _VIA_RSHAPE = { POLYGON: 7 };
const _VIA_METADATA_FLAG = { RESERVED_FOR_FUTURE: 1 };

function _via_metadata(vid, z, xy, av) {
  this.vid = vid;
  this.flg = 0;
  this.z = z;
  this.xy = xy;
  this.av = av;
}
