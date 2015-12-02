// MasterLock / WorkerLock is a an asymmetric lock data structure.
// 2014-11-28 / lhansen@mozilla.com.
//
// The master will call the asyncLock() method on the lock, and this
// will register a callback to be called with the lock acquired.  The
// master cannot unlock the lock explicitly, it will be unlocked when
// the callback returns.
//
// The worker will call the lock() method on the lock, and this blocks
// until the lock can be acquired.  The worker unlocks the lock
// explicitly.
//
//
// REQUIREMENT ON THE MASTER-SIDE WORKERS' MESSAGE LOOPS:
//
// All message loops installed by the master on workers MUST respond
// to a message of the following form:
//
//   ["MasterLock.dispatch", v]
//
// by calling MasterLock.dispatch(v).
//
//
// TODO:
//
// - It'd be desirable for the callback to be allowed to perform an
//   explicit unlock, thus exiting the critical section early, and
//   equally desirable for it to be allowed to set up a new callback
//   if it's outside the critical section.  (At a guess, we can do
//   something with a sequence number in the lock; unlock would
//   increment it, and if it has changed when the callback exits we
//   can skip the unlock.)
//
//
// LOCK REPRESENTATION:
//
// The lock occupies three consecutive words.
//
//   @0: lock state (0, 1, 2)
//   @1: main thread state (0, 1)
//   @2: global lock ID, set by the master
//
// The lock code is based on http://www.akkadia.org/drepper/futex.pdf.
// Lock state values:
//   0: unlocked
//   1: locked with no waiters
//   2: locked with possible waiters


// Create the Master side of the lock.
//
// iab is a shared Int32Array.
// offset is the first index of a range of MasterLock.NUMLOCS
//   consecutive addresses within iab.
//
// The array locations must be used exclusively by a single
// MasterLock, and any number of WorkerLocks become associated with
// that MasterLock by the use of the same locations on the same array.

function MasterLock(iab, offset) {
    this._id = MasterLock._id++;
    this._iab = iab;
    this._offset = offset;
    this._callback = null;
    iab[offset] = 0;
    iab[offset+1] = 0;
    iab[offset+2] = this._id;
}

// Constant.  Number of consecutive locations that must be allocated
// for the lock data structure.

MasterLock.NUMLOCS = 3;

// PRIVATE.  Uniquely identifies the lock for comm purposes.

MasterLock._id = 1;

// PRIVATE.  Map from ID to lock structure for any locks waiting in
// the master.

MasterLock._waiting = {};

// Process a callback from a worker.  Invoke this in the master from
// the worker's onmessage handler when the message has the form
// ["MasterLock.dispatch", v].
//
// When this is invoked the worker will be holding the lock identified
// by v; invoking this function has the effect of transfering the lock
// to the master.

MasterLock.dispatch =
    function (id) {
	var lock = MasterLock._waiting[id];
	var cb = null;

	delete MasterLock._waiting[id];
	if (lock) {
	    cb = lock._callback;
	    lock._callback = null;
	    if (cb)
		cb(false);
	    lock._unlock();
	}

	if (!cb)
	    throw new Error("Internal error: No callback for " + id);
    };

// asyncLock(cb) registers an interest in the lock with cb being the
//   callback to be invoked once the lock is acquired.  If the lock
//   can be acquired directly then the callback may be invoked directly.
//
//   The callback is passed a flag, which is true if the lock was
//   acquired directly and the callback invoked synchronously.
//
// Returns the value of the flag passed to the callback.

MasterLock.prototype.asyncLock =
    function (callback) {
        const iab = this._iab;
        const index = this._offset;
	const master = this._offset+1;

	// Register interest in the lock.  The old 'master' value will
	// always be zero here because asyncLock cannot be called from
	// within a callback.
	Atomics.store(iab, master, 1);

	do {
	    // Try to acquire the lock.  If we did then we can just
	    // unregister interest and go ahead and call the callback,
	    // because if a worker had sent a message then it would
	    // also have retained the lock.
            if (Atomics.compareExchange(iab, index, 0, 1) == 0) {
		if (Atomics.compareExchange(iab, master, 1, 0) == 0)
		    throw new Error("FATAL ERROR: Inconsistent state"); // Nobody should have reset
		callback(true);
		this._unlock();
		return true;
	    }

	    // Register that we want to acquire the lock, which we
	    // found to be held.  It could have been released by its
	    // single owner without a message being sent, so start
	    // over if that seems to be the case.
	} while (Atomics.compareExchange(iab, index, 1, 2) == 0);

	// We have registered interest in the lock, we're not
	// holding it, and the state of the lock will ensure that
	// a release will cause a message to be sent when the lock
	// becomes available.
	this._callback = callback;
	MasterLock._waiting[this._id] = this;
	return false;
    };

// tryLock(cb) attempts to obtain the lock, and if it does then the
//   "callback" cb is invoked directly.  The callback is always
//   passed a flag whose value is true.
//
// Returns true if the lock was acquired immediately and the callback
// was invoked, and false otherwise.

MasterLock.prototype.tryLock =
    function (callback) {
        const iab = this._iab;
        const index = this._offset;

        if (Atomics.compareExchange(iab, index, 0, 1) == 0) {
	    callback(true);
	    this._unlock();
	    return true;
	}

	return false;
    };

// PRIVATE.  Unlock the lock and wake any waiters.  The callback shall
// not have requested the lock again for the master (locks are not
// recursive), so the master is not a candidate for wakeup, contrast
// WorkerLock.prototype.unlock().

MasterLock.prototype._unlock =
    function () {
        const iab = this._iab;
        const index = this._offset;
        var v0 = Atomics.sub(iab, index, 1);
        if (v0 != 1) {
	    Atomics.store(iab, index, 0);
	    Atomics.futexWake(iab, index, 1);
        }
    };


// Create the Worker side of the lock.  iab and offset are as for
// MasterLock.

function WorkerLock(iab, offset) {
    this._iab = iab;
    this._offset = offset;
}

// Acquire the lock, blocking until the lock becomes available.

WorkerLock.prototype.lock =
    function () {
        const iab = this._iab;
        const index = this._offset;
        var c = 0;
        if ((c = Atomics.compareExchange(iab, index, 0, 1)) != 0) {
            do {
                if (c == 2 || Atomics.compareExchange(iab, index, 1, 2) != 0) {
                    Atomics.futexWait(iab, index, 2, Number.POSITIVE_INFINITY);
                }
            } while ((c = Atomics.compareExchange(iab, index, 0, 2)) != 0);
        }
    };

// Attempt to acquire the lock, but do not block.  Return true if the
// lock was acquired, otherwise false.

WorkerLock.prototype.tryLock =
    function () {
        const iab = this._iab;
        const index = this._offset;
        return Atomics.compareExchange(iab, index, 0, 1) == 0;
    };

// Unlock a lock that's held and wake up another agent if there's one
// waiting.
//
// NOTE: The implementation currently prioritizes waking up the
// master, but there should be no correctness issues about choosing a
// worker over the master even if the master is waiting.  As it is,
// there's a risk of starving the workers.

WorkerLock.prototype.unlock =
    function () {
        const iab = this._iab;
        const index = this._offset;
	const master = index+1;
        var v0 = Atomics.sub(iab, index, 1);
        if (v0 != 1) {
	    // State 2 -> State 1: Wake up a waiter.
	    // If the master is waiting then give it priority.
	    if (Atomics.compareExchange(iab, master, 1, 0) == 1) {
		// Hand the lock over to the master.
		postMessage(["MasterLock.dispatch", iab[index+2]]);
	    }
	    else {
		Atomics.store(iab, index, 0);
		Atomics.futexWake(iab, index, 1);
	    }
        }
    };
