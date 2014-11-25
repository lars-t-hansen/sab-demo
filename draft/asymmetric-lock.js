// MasterLock / WorkerLock is a an asymmetric lock data structure.
//
// The master will call the requestLock() method on the lock, and this
// will register a callback to be called with the lock acquired.
//
// The worker will call the lock() method on the lock, and this blocks
// until the lock can be acquired.
//
// REQUIREMENT ON WORKERS:
//
// All message loops installed on workers MUST respond to a message of
// the following form:
//
//   ["MasterLock.dispatch", v]
//
// by calling MasterLock.dispatch(v).


// Create the Master side of the lock.
//
// iab is a SharedInt32Array.
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

// @0: lock state (0, 1, 2)
// @1: main thread state (0, 1)
// @2: lock ID
//
// The lock code is based on http://www.akkadia.org/drepper/futex.pdf.
//
// Lock state values:
//   0: unlocked
//   1: locked with no waiters
//   2: locked with possible waiters

MasterLock.NUMLOCS = 3;

MasterLock._id = 1;
MasterLock._waiting = {};

// Callback from a worker.  The lock is still held, ownership is
// transfered to the master.

MasterLock.dispatch =
    function (id) {
	var lock = MasterLock._waiting[id];
	var cb = null;

	delete MasterLock._waiting[id];
	if (lock) {
	    cb = lock._callback;
	    lock._callback = null;
	    if (cb)
		cb();
	    lock._unlock();
	}

	if (!cb)
	    throw new Error("Internal error: No callback for " + id);
    };

// requestLock(cb) registers an interest in the lock with cb being the
//   callback to be invoked once the lock is acquired.  If the lock
//   can be acquired directly then the callback may be invoked directly.
//
// Returns true if the lock was acquired immediately and the callback
// was invoked and hence no callback became registered, and false
// otherwise.

MasterLock.prototype.requestLock =
    function (callback) {
        const iab = this._iab;
        const index = this._offset;
	const master = this._offset+1;
        var c = 0;

	// Register interest in the lock.  The old 'master' value will
	// always be zero here.
	Atomics.store(iab, master, 1);

	while (true) {
            if ((c = Atomics.compareExchange(iab, index, 0, 1)) == 0) {
		// Lock acquired, but maybe a message was sent anyway?
		if (Atomics.compareExchange(iab, master, 1, 0) == 1) {
		    // Nobody dispatched anything and we disinterested ourselves.
		    callback();
		    this._unlock();
		    return true;
		}

		// Bad logic here: if a message was sent then we will
		// not acquire the lock above because the lock was
		// retained for us. 
		//
		// FIXME

		// A message was sent between the setting of the flag
		// and the acquire of the lock (could take multiple
		// iterations of this loop too).  Set up the callback
		// to capture the message.  Retain the lock.
		this._callback = callback;
		MasterLock._waiting[this._id] = this;
		return false;
	    }
	    else {
		// Lock not acquired but we want to acquire it.  Lock
		// could be released by now, so check and redo if so.
		if (Atomics.compareExchange(iab, index, 1, 2) == 0)
		    continue;

		// Lock not held, multiple waiters and the master flag
		// are set, and the callback is registered.
		this._callback = callback;
		MasterLock._waiting[this._id] = this;
		return false;
	    }
        }
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
