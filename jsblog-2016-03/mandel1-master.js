/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var magFactor     = 1.05;       // Magnification factor for each iteration
var maxIterations = 250;        // Set to 1 for a single frame

var workers = [];               // Array of web workers (threads)
var byteArray;                  // For copying the bytes to the canvas

function setupMain() {
    initStatus();

    var shmem = new SharedArrayBuffer(memSize);
    byteArray = new Uint8Array(shmem);

    for ( var i=0 ; i < numWorkers ; i++ ) {
        var worker = new Worker("mandel1-worker.js");
        worker.onmessage = dispatchMessage;
        worker.postMessage(["setupWorker", shmem], [shmem]);
        workers.push(worker);
    }
}

var magnification;              // Current magnification level
var iterations;                 // Iteration counter
var timeBefore;                 // Time stamp before first frame

function startAnimation() {
    magnification = 1;
    iterations = 0;
    timeBefore = Date.now();
    initStatus();
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
                                magnification]);
}

function stripDone() {
    if (--workersWorking == 0) {
        displayFrame()
        if (++iterations < maxIterations) {
            magnification *= magFactor;
            startFrame();
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

function displayFrame() {
    canvasSetFromABGRBytes(theCanvas, byteArray, height, width);
}

function status(msg) {
    theStats.textContent = msg;
}

docInit();
