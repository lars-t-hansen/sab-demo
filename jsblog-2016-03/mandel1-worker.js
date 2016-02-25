/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("utilities.js", "mandel1-shared.js", "mandelbrot.js");

onmessage = dispatchMessage;

var grid;

function setupWorker(shmem) {
    grid = new Int32Array(shmem, 0, gridInts);
}

function computeStrip(ybase, ylimit, magnification) {
    mandelbrot(grid, ybase, ylimit, magnification);
    postMessage(["stripDone"]);
}
