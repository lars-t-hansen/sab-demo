// Asymmetric barrier synchronization.
// 3 December 2014 / lhansen@mozilla.com

// MasterBarrier / WorkerBarrier.
//
// This is a simple master/worker barrier that is mapped to locations
// within a shared integer array.
//
// Overview
// --------
// The master and workers all create private barrier objects, which
// referencesome working locations in shared memory.  When the workers
// have all entered the barrier the master receives a callback.  The
// master must then release the workers again for them to resume
// computing.
//
// Usage
// -----
// The master must create a MasterBarrier, and then ensure that
// Master.dispatch is invoked when a worker's onmessage handler
// receives a message that the workers are all in the barrier.  That
// message is an array of the form ["MasterBarrier.dispatch", ID]
// where ID is the barrier ID.
//
// The workers must each create a WorkerBarrier on the same shared
// locations and with the same ID as the master barrier.  The
// WorkerBarriers must not be created until after the MasterBarrier
// constructor has returned.
//
// The application is responsible for allocating the locations in the
// integer array and communicating those and the ID to the workers.
//
// The number of consecutive array locations needed is given by
// MasterBarrier.NUMLOCS.

"use strict";

// Create the master side of a barrier.
//
// - 'ID' identifies the barrier globally
// - 'numWorkers' is the number of workers that will coordinate
// - 'iab' is a shared Int32Array
// - 'loc' is the first of several consecutive locations within 'iab'
// - 'callback' is the function that is to be called when the workers
//   are all waiting in the barrier with this ID.

function MasterBarrier(ID, numWorkers, iab, loc, callback) {
    this.iab = iab;
    this.counterLoc = loc;
    this.seqLoc = loc+1;
    this.numWorkers = numWorkers;

    iab[this.counterLoc] = numWorkers;
    iab[this.seqLoc] = 0;
    MasterBarrier._callbacks[ID] = callback;
}

// PRIVATE.  Maps barrier IDs to callback functions.

MasterBarrier._callbacks = {};

// The number of consecutive locations in the integer array needed for
// the barrier.

MasterBarrier.NUMLOCS = 2;

// The master's onmessage handler must call dispatch() to invoke the
// callback for the given barrier ID.

MasterBarrier.dispatch =
    function (id) {
	const cb = MasterBarrier._callbacks[id];
	if (!cb)
	    throw new Error("Unknown barrier ID: " + id);
	return cb();
    };

// Return true iff the workers are all waiting in the barrier.
//
// Note that this is racy; if the result is false the workers may all
// in fact be waiting because the last worker could have entered after
// the check was performed but before isQuiescent() returned.

MasterBarrier.prototype.isQuiescent =
    function () {
	return Atomics.load(this.iab, this.counterLoc) == 0;
    };

// If the workers are not all waiting in the barrier then return false.
// Otherwise release them and return true.
//
// Note that if the result is false the workers may all in fact be
// waiting because the last worker could have entered after the check
// was performed but before isQuiescent() returned.

// The barrier is immediately reusable after the workers are released.

MasterBarrier.prototype.release =
    function () {
	if (!this.isQuiescent())
	    return false;
	Atomics.store(this.iab, this.counterLoc, this.numWorkers);
	Atomics.add(this.iab, this.seqLoc, 1);
	Atomics.wake(this.iab, this.seqLoc, this.numWorkers);
	return true;
    };

// Create the worker side of a barrier.
//
// - 'ID' identifies the barrier globally
// - 'iab' is a shared Int32Array
// - 'loc' is the first of several consecutive locations within 'iab'

function WorkerBarrier(ID, iab, loc) {
    this.ID = ID;
    this.iab = iab;
    this.counterLoc = loc;
    this.seqLoc = loc+1;
}

// Enter the barrier.  This call will block until the master releases
// the workers.

WorkerBarrier.prototype.enter =
    function () {
	const seq = Atomics.load(this.iab, this.seqLoc);
	if (Atomics.sub(this.iab, this.counterLoc, 1) == 1)
	    postMessage(["MasterBarrier.dispatch", this.ID]);
	Atomics.wait(this.iab, this.seqLoc, seq, Number.POSITIVE_INFINITY);
    };


