// MasterChannel / WorkerChannel are a uni-directional one-to-many
// work distribution mechanism: the master can distribute work items
// to workers, which will pick them up as they become available.  The
// channel is bounded but still supports unbounded work and
// non-blocking behavior in the master.

// Programming tricks:
//
// A simple, synchronized broadcast ("doAll") can be performed by
// pumping numWorkers special work items into the channel, each of
// which causes a worker to enter a shared WorkerOnlyBarrier before
// processing the item's payload.
//
// Note: another useful data structure is a worker-to-worker channel,
// which can have a simpler blocking architecture.


// Create the master size of the Channel.
//
// sab is a SharedArrayBuffer.
//
// offset is a byte offset within sab; this must be divisible by 8.
//
// avail is the number of bytes, starting at offset, reserved for the
//   channel; this must be divisible by 8.  It must be at least
//   MasterChannel.NUMBYTES + the size of the largest item to be
//   placed into the channel.  A reliable ceiling on the size of an
//   item is eight bytes per value in the item, plus eight bytes of
//   overhead for the item.  (Normally you want to make the channel
//   quite a lot larger than one item, since there is significant
//   overhead associated with refilling.)
//
// refillCallback is a function that will be invoked when there may be
//   space in the channel for more items.  It should call put() on the
//   channel one or more times to produce items, returning when put()
//   returns false.  refillCallback should return true if there may be
//   more items to be produced later.  It will not be called again
//   after it returns false.

function MasterChannel(sab, offset, avail, refillCallback) {
    this.callbacks = {};
}

MasterChannel.NUMBYTES = 8 + ...;

// MasterChannel.dispatch must be invoked if the message loop receives
// a message that is an array of length 2 where the first value is the
// string "MasterChannel.dispatch"; ID is the second value of that
// array.

// It's probably open whether dispatch should unblock waiters or put
// should do it; if dispatch does it we end up in a start-stop 
// pattern whereas if put does it we may be able to keep pumping.  But if
// put does it we'd like to batch it to avoid the overhead of futexWake.

MasterChannel.dispatch =
    function (ID) {
	Atomics.store(this.iab, this.wantCallbackLoc, 0);
	var cb = this.callbacks[ID];
	if (!cb)
	    return;		// This may happen, if the callback was removed
	// Really have two returns here: whether any were put, and whether 
	// there might be more.
	if (!cb())
	    delete this.callbacks[ID];
	else
	    Atomics.add(this.iab, this.wantCallbackLoc, 1);
	var n;
	if (n = Atomics.load(this.iab, this.workersWaitingLoc)) {
	    Atomics.add(this.iab, this.seqLoc, 1);
	    Atomics.sub(this.iab, this.workersWaitingLoc, n);
	    Atomics.futexWake(this.iab, this.seqLoc, Number.POSITIVE_INFINITY);
	}
    };

// Put an item - comprising zero or more values - into the channel.
//
// Typical use:
//   var ch = new MasterChannel(..., callback)
//   var state = ...;
//   fn callback() { while (ch.put(...)) { update state } }

// TODO: this must have magic so that if there are waiting workers
// they must be woken.  That's basically a barrier that can be reset.
// The reset should only be performed if somebody is waiting, which
// is an interesting problem.

//   if (waitcount > 0) {
//      seq++;
//      waitcount--
//      wake one(?) waiter
//   }

MasterChannel.prototoype.put =
    function (...value) {
	var ncells = 1;		// Descriptor word
	var descriptor = 0;
	var sh = 0;
	for ( var v of values ) {
	    if (isInteger(v)) {
		descriptor |= (1 << sh)
		ncells += 1;
	    }
	    else if (isFloat(v)) {
		descriptor |= (2 << sh);
		ncells += 2 + (ncells & 1);
	    }
	    else
		throw new Error("Can't put this value yet");
	    sh += 2;
	}
	if (ncells > 16)
	    throw new Error("Too many values");
	const iab = this.iab;
	var p;
	// A single alloc loc is all wrong, this is a circular queue
	do {
	    p = Atomics.load(iab, this.allocLoc);
	    if (p+ncells >= this.allocLim)
		return false;
	} while (Atomics.compareExchange(iab, this.allocLoc, p, p+ncells) != p);
	// p will be a multiple of 2
	iab[p++] = descriptor;
	for ( var v of values ) {
	    if ((descriptor & 3) == 1)
		iab[p++] = v;
	    else {
		if (p & 1)
		    p++;
		// store via the float array.
		yyy;
	    }
	    descriptor >>>= 2;
	}
	Atomics.add(iab, this.availLoc, 1); // sync and publish
	return true;
    };

// Create the master size of the Channel.
//
// sab is a SharedArrayBuffer.
//
// offset is a byte offset within sab; this must be divisible by 8.
//
// avail is the number of bytes, starting at offset, reserved for the
//   channel; this must be divisible by 8.
//
function WorkerChannel(sab, offset, avail) {
}

// Extract an item - comprising zero or more values - from the channel. 
//
// Return null if the queue is empty and the master has signaled that
// no more items are coming.
//
// Return null if there is no item (this is not actually safe if there
// are new items coming - that turns into a race).

WorkerChannel.prototype.get =
    function (constructor) {
	if (empty)
	    return null;
	// Extract items.
	switch (nitems) {
	case 1:
	    return constructor(v1);
	case 2:
	    return constructor(v1, v2);
	case 3:
	    return constructor(v1, v2, v3);
	case 4:
	    return constructor(v1, v2, v3, v4);
	default:
	    return constructor.apply(...);
	}
    };
