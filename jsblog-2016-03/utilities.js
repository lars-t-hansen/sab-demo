/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Caching is not all that important I think, and of course we're
// holding on to stuff here, but it helps when doing animations and
// for that case it's realistic to cache things.

var cache = { element: null, cx: null, id: null, height: 0, width: 0 };

function canvasSetFromABGRBytes(canvasElt, bytes, height, width) {
    if (cache.element != canvasElt || cache.height != height || cache.width != width) {
        canvasElt.height = height;
        canvasElt.width = width;
        cache.element = canvasElt;
        cache.height = height;
        cache.width = width;
        cache.cx = canvasElt.getContext('2d');
        cache.id = cache.cx.createImageData(width, height);
    }
    cache.id.data.set(bytes);
    cache.cx.putImageData( cache.id, 0, 0 );
}

// When we receive a message [name, ...], find the function called
// "name" and call it on the remaining arguments.

var _global = this;

function dispatchMessage(ev) {
    _global[ev.data[0]].apply(null, ev.data.slice(1));
}

// Determine the number of workers from the document.location.

var defaultNumWorkers = 4;

var numWorkers =
  (function () {
      if (!this.document || !document.location)
          return defaultNumWorkers;
      var param=String(document.location).match(/numWorkers=(\d+)/);
      if (!param)
          return defaultNumWorkers;
      var n=parseInt(param[1]);
      if (n <= 0)
          return defaultNumWorkers;
      return n;
  })();

function roundToAsmLength(x) {
    // Round to 16MB.  Actually it's more complicated than this.
    return (x + 16*1024*1024 - 1) & ~(16*1024*1024-1);
}
