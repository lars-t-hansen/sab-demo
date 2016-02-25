/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("utilities.js", "mandel2-shared.js", "mandelbrot.js");

onmessage = dispatchMessage;

var grids;

function setupWorker(shmem) {
    grids = [new Int32Array(shmem, offset[0], gridInts),
             new Int32Array(shmem, offset[1], gridInts)];
}

function computeStrip(ybase, ylimit, magnification, gridNo) {
    mandelbrot(grids[gridNo], ybase, ylimit, magnification);
    postMessage(["stripDone"]);
}
