// Two different types of barriers.

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
//
// MasterBarrier / WorkerBarrier.
//
// This is a simple master/worker barrier that is mapped to locations
// within a shared integer array.
//
// Overview
// --------
// The master and workers all create a private barrier object, which
// references some working locations in shared memory.  When the
// workers have all entered the barrier the master receives a
// callback.  The master must then release the workers again for them
// to resume computing.
//
// Usage
// -----
// The master must create a MasterBarrier, and then ensure that
// Master.dispatch is invoked when its onmessage handler receives a
// message that the workers are all in the barrier.  That message is
// an array of the form ["MasterBarrier.dispatch", ID] where ID is
// the barrier ID.
//
// The workers must each create a WorkerBarrier on the same shared
// locations and with the same ID as the master barrier.
//
// The application is responsible for allotting the locations in the
// integer array and communicating those and the ID to the workers.
//
// The number of consecutive array locations needed is given by
// MasterBarrier.NUMLOCS.

// Create the master side of a barrier.
//
// - 'ID' identifies the barrier globally
// - 'numWorkers' is the number of workers that will coordinate
// - 'iab' is a SharedInt32Array
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

// Return true iff the workers are waiting in the barrier.

MasterBarrier.prototype.isQuiescent =
    function () {
	return Atomics.load(this.iab, this.counterLoc) == 0;
    };

// If the workers are not all waiting in the barrier then return false.
// Otherwise release them and return true.
//
// The barrier is immediately reusable after the workers are released.

MasterBarrier.prototype.release =
    function () {
	if (!this.isQuiescent())
	    return false;
	Atomics.store(this.iab, this.counterLoc, this.numWorkers);
	Atomics.add(this.iab, this.seqLoc, 1);
	Atomics.futexWake(this.iab, this.seqLoc, this.numWorkers);
	return true;
    };

// Create the worker side of a barrier.
//
// - 'ID' identifies the barrier globally
// - 'iab' is a SharedInt32Array
// - 'loc' is the first of several consecutive locations within 'iab'

function WorkerBarrier(ID, iab, loc) {
    this.ID = ID;
    this.iab = iab;
    this.counterLoc = loc;
    this.seqLoc = loc+1;
}

// Enter the barrier.  This will block until the master releases the workers.

WorkerBarrier.prototype.enter =
    function () {
	const seq = Atomics.load(this.iab, this.seqLoc);
	if (Atomics.sub(this.iab, this.counterLoc, 1) == 1)
	    postMessage(["MasterBarrier.dispatch", this.ID]);
	Atomics.futexWait(this.iab, this.seqLoc, seq, Number.POSITIVE_INFINITY);
    };


//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
//
// WorkerOnlyBarrier.
//
// This is a barrier for synchronizing workers without having to
// involve the master.
//
// Somebody allocates locations in the SharedInt32Array.  Information
// about the array and locations must then be broadcast to all
// workers, who must create local WorkerOnlyBarrier objects.
//
// Workers enter the barrier by calling WorkerOnlyBarrier.prototype.enter();
// all workers leave the barrier - which becomes reusable immmediately - once
// the last worker is in.

function WorkerOnlyBarrier(iab, loc) {
    this.iab = iab;
    this.counterLoc = loc;
    this.seqLoc = loc+1;
    this.numWorkersLoc = loc+2;
}

// Initialize the barrier storage globally.  This must be done before
// any calls are made to the WorkerOnlyBarrier constructor.

WorkerOnlyBarrier.initialize =
    function (iab, loc, numWorkers) {
	iab[loc] = numWorkers;		// Counter
	iab[loc+1] = 0;			// Sequence number
	iab[loc+2] = numWorkers;	// Original value of the counter
    };

// Number of locations needed by the barrier.

WorkerOnlyBarrier.NUMLOCS = 3;

// Enter the barrier.  This will block until all workers have entered
// the barrier, at which point all workers are automatically released.

WorkerOnlyBarrier.prototype.enter =
    function () {
	if (Atomics.sub(this.iab, this.counterLoc, 1) == 1) {
	    const numWorkers = this.iab[this.numWorkersLoc];
	    Atomics.store(this.iab, this.counterLoc, numWorkers);
	    Atomics.add(this.iab, this.seqLoc, 1);
	    // The correctness of the wakeup call depends on the
	    // linear-queue behavior of wait and wake.
	    Atomics.futexWake(this.iab, this.seqLoc, numWorkers-1);
	}
	else {
	    const seq = Atomics.load(this.iab, this.seqLoc);
	    Atomics.futexWait(this.iab, this.seqLoc, seq, Number.POSITIVE_INFINITY);
	}
    };
