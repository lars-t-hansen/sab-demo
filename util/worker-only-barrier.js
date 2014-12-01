// A barrier for synchronizing among workers (not the master / main thread)
// lhansen@mozilla.com / 1 December 2014
//
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
