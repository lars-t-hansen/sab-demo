/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

importScripts("utilities.js", "mandel4-shared.js", "mandelbrot.js");

onmessage = dispatchMessage;

var magnification, sync, slices, grid;

function runWorker(shmem) {
    // Variables in shared memory
    magnification = new Float64Array(shmem, magnification_OFFSET, 1);
    sync          = new Int32Array(shmem, sync_OFFSET, Sync_INTS);
    slices        = new Int32Array(shmem, slices_OFFSET, NumSlices * Slice_INTS);
    grid          = new Int32Array(shmem, grid_OFFSET, Grid_INTS);

    for (;;) {
	enterBarrier();
	for (;;) {
	    lock();
            var idx = sync[Sync_next];
            if (idx == NumSlices) {
		unlock();
		break;
            }
            sync[Sync_next]++;
            unlock();
            var ybase  = slices[idx * Slice_INTS + Slice_ybase];
            var ylimit = slices[idx * Slice_INTS + Slice_ylimit];
            mandelbrot(grid, ybase, ylimit, magnification[0]);
        }
    }
}

// Barrier

function enterBarrier() {
    var seq = Atomics.load(sync, Sync_seq);
    if (Atomics.sub(sync, Sync_counter, 1) == 1)
	postMessage(["workersDone"]);
    Atomics.wait(sync, Sync_seq, seq);
    while (Atomics.load(sync, Sync_seq) & 1)
	;
}

// Lock

function lock() {
    var c;
    if ((c = Atomics.compareExchange(sync, Sync_lockState, 0, 1)) != 0) {
	do {
            if (c == 2 || Atomics.compareExchange(sync, Sync_lockState, 1, 2) != 0)
		Atomics.wait(sync, Sync_lockState, 2);
	} while ((c = Atomics.compareExchange(sync, Sync_lockState, 0, 2)) != 0);
    }
}

function unlock() {
    var v0 = Atomics.sub(sync, Sync_lockState, 1);
    if (v0 != 1) {
	Atomics.store(sync, Sync_lockState, 0);
	Atomics.wake(sync, Sync_lockState, 1);
    }
}
