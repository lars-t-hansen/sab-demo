/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var magFactor     = 1.05;       // Magnification factor for each iteration
var maxIterations = 250;        // Set to 1 for a single frame

// Center the image at this location.

var centerX = -0.743643887037158704752191506114774;
var centerY = 0.131825904205311970493132056385139;

// Pixel grid.  (0,0) correspons to (bottom,left).

var height = 480;
var width  = 640;

var grid;                       // Int32Array(height*width)

function setupMain() {
    initStatus();
    grid = new Int32Array(canvasMemory(), 0, height * width);
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

function startFrame() {
    mandelbrot(grid, 0, height, magnification);
    displayFrame();
    if (++iterations < maxIterations) {
        magnification *= magFactor;
        setTimeout(startFrame, 0);
    }
    else
        finishAnimation();
}

// Plumbing

function finishAnimation() {
    var time = Date.now() - timeBefore;
    status("Computing " + maxIterations + " frames" +
           "  Compute time: " + time + "ms" +
           "  FPS: " + Math.round(maxIterations/(time/1000)*10)/10);
}

function initStatus() {
    status("Computing " + maxIterations + " frames");
}

var theCanvas, theStats, canvasCx, canvasMem;

function docInit() {
    document.body.onload = setupMain;
    document.getElementById("startButton").onclick = startAnimation;

    theCanvas = document.getElementById("theCanvas");
    theStats = document.getElementById("theStats");

    theCanvas.height = height;
    theCanvas.width = width;
    canvasCx = theCanvas.getContext('2d');
    canvasMem = canvasCx.createImageData(width, height);
}

function canvasMemory() {
    return canvasMem.data.buffer;
}

function displayFrame() {
    canvasCx.putImageData( canvasMem, 0, 0 );
}

function status(msg) {
    theStats.textContent = msg;
}

docInit();
