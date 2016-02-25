/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var magFactor     = 1.05;       // Magnification factor for each iteration
var maxIterations = 250;        // Set to 1 for a single frame

var workers = [];               // Array of web workers (threads)
var byteArrays;

function setupMain() {
    initStatus();

    var shmem = new SharedArrayBuffer(memSize);
    byteArrays = [new Uint8Array(shmem, offset[0], gridBytes),
                  new Uint8Array(shmem, offset[1], gridBytes)];

    for ( var i=0 ; i < numWorkers ; i++ ) {
        var worker = new Worker("mandel2-worker.js");
        worker.onmessage = dispatchMessage;
        worker.postMessage(["setupWorker", shmem], [shmem]);
        workers.push(worker);
    }
}

var magnification;              // Current magnification level
var iterations;                 // Iteration counter
var timeBefore;                 // Time stamp before first frame
var gridNo;                     // Current grid

function startAnimation() {
    magnification = 1;
    iterations = 0;
    timeBefore = Date.now();
    initStatus();
    gridNo = 0;
    startFrame();
}

var workersWorking;             // Number of workers still working

function startFrame() {
    workersWorking = numWorkers;
    var sliceHeight = Math.ceil(height / numWorkers);
    for ( var i=0 ; i < numWorkers ; i++ )
        workers[i].postMessage(["computeStrip",
                                i * sliceHeight,
                                Math.min(height, (i + 1) * sliceHeight),
                                magnification,
                                gridNo]);
}

function stripDone() {
    if (--workersWorking == 0) {
        if (++iterations < maxIterations) {
            magnification *= magFactor;
            var oldGrid = gridNo;
            gridNo = (gridNo + 1) % 2;
            startFrame();
            displayFrame(oldGrid);
        }
        else
            finishAnimation();
    }
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

function displayFrame(oldGrid) {
    canvasSetFromABGRBytes(theCanvas, byteArrays[oldGrid], height, width);
}

function status(msg) {
    theStats.textContent = msg;
}

docInit();
