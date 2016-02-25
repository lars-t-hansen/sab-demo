/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var magFactor     = 1.05;       // Magnification factor for each iteration
var maxIterations = 250;        // Set to 1 for a single frame

var workers = [];               // Array of web workers (threads)
var firstTime = true;           // No frame to display the first time the workers check in

var magnification, sync, slices, gridBytes;

function setupMain() {
    initStatus();

    var shmem     = new SharedArrayBuffer(memSize);
    magnification = new Float64Array(shmem, magnification_OFFSET, 1);
    sync          = new Int32Array(shmem, sync_OFFSET, Sync_INTS);
    slices        = new Int32Array(shmem, slices_OFFSET, NumSlices * Slice_INTS);
    gridBytes     = new Uint8Array(shmem, grid_OFFSET, Grid_BYTES);

    initBarrier();

    for ( var i=0 ; i < numWorkers ; i++ ) {
        workers[i] = new Worker("mandel4-worker.js");
        workers[i].onmessage = dispatchMessage;
        workers[i].postMessage(["runWorker", shmem], [shmem]);
    }
}

var magLevel;                   // Current magnification level
var iterations;                 // Iteration counter
var timeBefore;                 // Time stamp before first frame

function startAnimation() {
    magLevel = 1;
    iterations = 0;
    timeBefore = Date.now();
    initStatus();
    firstTime = false;

    // Send these through shared memory to illustrate the principle.
    // The worker could compute the slice from the iteration number.

    var sliceHeight = Math.ceil(height / NumSlices);
    for ( var i=0 ; i < NumSlices ; i++ ) {
        slices[i * Slice_INTS + Slice_ybase] = i * sliceHeight;
        slices[i * Slice_INTS + Slice_ylimit] = Math.min(height, (i+1) * sliceHeight);
    }

    startFrame();
}

function startFrame() {
    magnification[0] = magLevel;
    sync[Sync_next] = 0;
    releaseBarrier();
}

function workersDone(id) {
    // Workers enter the barrier immediately after starting.
    // startAnimation sets firstTime=false.
    if (firstTime)
        return;

    displayFrame()
    if (++iterations < maxIterations) {
        magLevel *= magFactor;
        startFrame();
    }
    else
        finishAnimation();
}

// Barrier

function initBarrier() {
    Atomics.store(sync, Sync_counter, numWorkers);
    Atomics.store(sync, Sync_seq, 0);
}

function releaseBarrier() {
    Atomics.store(sync, Sync_counter, numWorkers);
    Atomics.add(sync, Sync_seq, 1);
    Atomics.futexWake(sync, Sync_seq, numWorkers);
    Atomics.add(sync, Sync_seq, 1);
}

// Plumbing

function finishAnimation() {
    var time = Date.now() - timeBefore;
    status("Computing " + maxIterations + " frames" +
           "  Number of workers: " + numWorkers +
           "  Compute time: " + time + "ms" +
           "  FPS: " + Math.round(maxIterations/(time/1000)*10)/10);
}

function initStatus() {
    status("Computing " + maxIterations + " frames" +
           "  Number of workers: " + numWorkers);
}

var theCanvas, theStats;

function docInit() {
    document.body.onload = setupMain;
    document.getElementById("startButton").onclick = startAnimation;
    theCanvas = document.getElementById("theCanvas");
    theStats = document.getElementById("theStats");
}

function displayFrame() {
    canvasSetFromABGRBytes(theCanvas, gridBytes, height, width);
}

function status(msg) {
    theStats.textContent = msg;
}

docInit();
