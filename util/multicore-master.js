// Data-parallel framework on shared memory: Multicore.build() and friends.
// Master side.
// lhansen@mozilla.com / 16 December 2014

// REQUIRE:
//   asymmetric-barrier.js

// A simple data-parallel framework that maintains a worker pool and
// invokes computations in parallel on shared memory.
//
// Load this into your main program, after loading asymmetric-barrier.js.
//
// Call Multicore.init() to set things up, once.
//
// Call Multicore.build() to distribute and perform computation.
//
// Call Multicore.broadcast() to invoke a function on all workers, eg
// to precompute intermediate data or distribute invariant parameters.
//
// Call Multicore.eval() to eval a program in each worker, eg to
// broadcast program code or precomputations.
//
// TODO:
//  - When a callback is null, the full master/worker barrier is not
//    needed, a worker-only barrier is enough and is probably quite a
//    bit faster.  It would be useful to implement that optimization.
//
//    Indeed, when operations are queued, the current implementation
//    still makes use of the master-worker barrier and the callback
//    mechanism, meaning the master must return to the event loop for
//    queued items to be processed, and is actually holding up
//    progress if it does not return to the main loop on a fairly
//    prompt basis.  Using the worker-only barrier would probably help
//    remove that requirement (which is documented).
//
//  - Nested parallelism is desirable, ie, a worker should be allowed
//    to invoke Multicore.build, suspending until that subcomputation
//    is done.  (Broadcast and eval are less obvious.)
//
//  - More data types should be supported for transmission in build()
//    and broadcast(): float32, simd types; also plain objects,
//    arrays, and typedarrays would be very helpful, at least for
//    small non-self-referential objects; we could have an arbitrary
//    cutoff (bleah) or a warning for large ones, and an error for
//    circular ones.
//
//  - There is unnecessary lock overhead in having the single work
//    queue (the pointer for the next item is hotly contended), that
//    might be improved by having per-worker queues with work stealing
//    or some sort of batch refilling.  It should not matter too much
//    if the grain is "right" (see later item on hinting) but it would
//    be useful to know.
//
// API CONCERNS:
//  - Since we don't have memory isolation in this conception of
//    Multicore.build, and the output array can be passed as an
//    argument in any case, it may be that we should move to a
//    Multicore.invoke(cb, name, idx, arg, ...) style, and get rid of
//    build() in its current form.
//
//  - The original conception of Multicore.build would operate on
//    individual index range elements unless an index was SPLIT.  In
//    the conception here, the index is always split.  Is this
//    reasonable, or should we incorporate the non-tiled API as well?
//
//  - The original conception of Multicore.build allowed the index
//    space to contain hints to aid load balancing.  It would be
//    useful to import that idea, probably, or at least experiment
//    with it to see if it really affects performance.

"use strict";

const Multicore =
    {
	init: _Multicore_init,
	build: _Multicore_build,
	broadcast: _Multicore_broadcast,
	eval: _Multicore_eval
    };

var _Multicore_workers = [];
var _Multicore_numWorkers = 0;
var _Multicore_callback = null;
var _Multicore_mem = null;
var _Multicore_alloc = 0;
var _Multicore_barrier = null;
var _Multicore_barrierLoc = null;
var _Multicore_funcLoc = 0;
var _Multicore_sizeLoc = 0;
var _Multicore_nextLoc = 0;
var _Multicore_limLoc = 0;
var _Multicore_nextArgLoc = 0;
var _Multicore_argLimLoc = 0;
var _Multicore_knownSAB = [null];
var _Multicore_queue = [];

// Multicore.init()
//
// numWorkers must be a positive integer.
// workerScript must be a URL.
// readyCallback must be a function, it will be called without arguments
//   when the workers have been set up.
//
// Call this function only once.

function _Multicore_init(numWorkers, workerScript, readyCallback) {
    _Multicore_numWorkers = numWorkers;
    _Multicore_mem = new SharedInt32Array(0x10000);
    _Multicore_alloc = 0;
    _Multicore_barrierLoc = _Multicore_alloc;
    _Multicore_barrier = new MasterBarrier(0x1337,
					   _Multicore_numWorkers,
					   _Multicore_mem,
					   _Multicore_barrierLoc,
					   barrierQuiescent);
    _Multicore_alloc += MasterBarrier.NUMLOCS;
    _Multicore_funcLoc = _Multicore_alloc++;
    _Multicore_sizeLoc = _Multicore_alloc++;
    _Multicore_nextLoc = _Multicore_alloc++;
    _Multicore_limLoc = _Multicore_alloc++;
    _Multicore_nextArgLoc = _Multicore_alloc++;
    _Multicore_argLimLoc = _Multicore_alloc++;
    _Multicore_callback = readyCallback;
    _Multicore_knownSAB[0] = _Multicore_mem.buffer;
    for ( var i=0 ; i < numWorkers ; i++ ) {
	var w = new Worker(workerScript);
	w.onmessage = messageHandler;
	w.postMessage(["start",
		       _Multicore_mem.buffer,
		       _Multicore_barrierLoc, _Multicore_funcLoc, _Multicore_sizeLoc, _Multicore_nextLoc, _Multicore_limLoc,
		       _Multicore_nextArgLoc, _Multicore_argLimLoc],
		      [_Multicore_mem.buffer]);
	_Multicore_workers.push(w);
    }

    function barrierQuiescent() {
	var fn;
	if (fn = _Multicore_callback) {
	    _Multicore_callback = null;
	    fn();
	}
	else
	    throw new Error("No barrier callback installed!");
    }

    function messageHandler(ev) {
	if (Array.isArray(ev.data) && ev.data.length >= 1) {
	    switch (ev.data[0]) {
	    case "MasterBarrier.dispatch":
		MasterBarrier.dispatch(ev.data[1]);
		break;
	    default:
		console.log(ev.data);
		break;
	    }
	}
	else
	    console.log(ev.data);
    }
}

// Multicore.build()
//
// Invoke a function in parallel on sections of an index space,
// producing output into a predefined shared memory array.
//
// doneCallback is a function or null.  If a function, it will be
//   invoked in the master once the work is finished.
// fnIdent is the string identifier of the remote function to invoke,
//   it names a function in the global scope of the worker.
// outputMem is a SharedTypedArray or SharedArrayBuffer that will (in
//   principle, though it's up to user code) receive the results of
//   the computation.
// indexSpace is an array of length-2 arrays determining the index
//   space of the computation; workers will be invoked on subvolumes
//   of this space in an unpredictable order.
// The ...args can be SharedTypedArray, SharedArrayBuffer, number,
//   bool, string, undefined, or null values and will be marshalled
//   and passed as arguments to the user function on the worker side.
//
// The handler function identified by fnIdent will be invoked on the
// following arguments, in order:
//   outpuMem
//   base and limit values for each element in indexSet, in order
//   any additional ...args
// Thus if the length of indexSet is three and there are four
// additional arguments then the number of arguments is 1+2*3+4.
//
// Serialization of calls: You can call build, broadcast, or eval
// repeatedly without waiting for callbacks.  The calls will be queued
// by the framework and dispatched in order.  All object arguments
// will be retained by reference while a call is queued; beware of
// side effects.
//
// Note, however, that the queueing system currently depends on a
// system-supplied callback, so the master must return to its event
// loop for the dispatching of queued tasks.

function _Multicore_build(doneCallback, fnIdent, outputMem, indexSpace, ...args) {
    if (!Array.isArray(indexSpace) || indexSpace.length < 1)
	throw new Error("Bad indexSpace: " + indexSpace);
    for ( var x of indexSpace )
	if (x.length != 2 || typeof x[0] != 'number' || typeof x[1] != 'number' || (x[0]|0) != x[0] || (x[1]|0) != x[1])
	    throw new Error("Bad indexSpace element " + x)
    // TODO: should check that type of outputMem is SharedArrayBuffer or SharedTypedArray
    if (!outputMem)
	throw new Error("Bad output memory: " + outputmem);
    return _Multicore_comm(doneCallback, fnIdent, outputMem, indexSpace, args);
}

// Multicore.broadcast()
//
// Invoke a function once on each worker.
//
// doneCallback is a function or null.  If a function, it will be
//   invoked in the master once the work is finished.
// fnIdent is the string identifier of the remote function to invoke,
//   it names a function in the global scope of the worker.
// The ...args can be values of the types as described for build(),
//   and will be marshalled and passed as arguments to the user
//   function on the worker side.
//
// The handler function identified by fnIdent will be invoked on the
// ...args only, no other arguments are passed.
//
// See the note about serialization of calls on the documentation for
// Multicore.build().

function _Multicore_broadcast(doneCallback, fnIdent, ...args) {
    return _Multicore_comm(doneCallback, fnIdent, null, [], args);
}

// Multicore.eval()
//
// Evaluate a program once on each worker.
//
// doneCallback is a function or null.  If a function, it will be
//   invoked in the master once the work is finished.
// program is textual program code, to be evaluated in the global
//   scope of the worker.
//
// See the note about serialization of calls on the documentation for
// Multicore.build().

function _Multicore_eval(doneCallback, program) {
    _Multicore_broadcast(doneCallback, "_Multicore_eval", program);
}

function _Multicore_comm(doneCallback, fnIdent, outputMem, indexSpace, args) {
    const M = _Multicore_mem;

    const ARG_INT = 1;
    const ARG_FLOAT = 2;
    const ARG_SAB = 3;
    const ARG_STA = 4;
    const ARG_BOOL = 5;
    const ARG_UNDEF = 6;
    const ARG_NULL = 7;
    const ARG_STRING = 8;

    const TAG_SAB = 1;
    const TAG_I8 = 2;
    const TAG_U8 = 3;
    const TAG_CU8 = 4;
    const TAG_I16 = 5;
    const TAG_U16 = 6;
    const TAG_I32 = 7;
    const TAG_U32 = 8;
    const TAG_F32 = 9;
    const TAG_F64 = 10;
    const tmp = new ArrayBuffer(8);
    const itmp = new Int32Array(tmp);
    const ftmp = new Float64Array(tmp);

    // Operation in flight?  Just enqueue this one.
    if (_Multicore_callback) {
	_Multicore_queue.push([doneCallback, fnIdent, outputMem, indexSpace, args]);
	return;
    }

    // Broadcast
    if (outputMem === null)
	outputMem = _Multicore_mem.buffer;
    if (!_Multicore_barrier.isQuiescent())
	throw new Error("Do not call Multicore.build until the previous call has completed!");
    var items;
    switch (indexSpace.length) {
    case 0:
	// Broadcast
	items = [];
	break;
    case 1:
	items = sliceSpace(indexSpace[0][0], indexSpace[0][1]);
	break;
    case 2:
	items = cross(sliceSpace(indexSpace[0][0], indexSpace[0][1]), sliceSpace(indexSpace[1][0], indexSpace[1][1]));
	break;
    default:
	throw new Error("Only 1D and 2D supported as of now");
    }
    const itemSize = indexSpace.length * 2;
    var { argValues, newSAB } = processArgs(outputMem, args);
    if (doneCallback === null)
	doneCallback = processQueue;
    else
	doneCallback = (function (doneCallback) {
	    return function () {
		processQueue();
		doneCallback();
	    } })(doneCallback);
    if (newSAB.length) {
	_Multicore_callback =
	    function () {
		_Multicore_callback = doneCallback;
		var p = _Multicore_alloc;
		p = installArgs(p, argValues);
		p = installItems(p, fnIdent, itemSize, items);
		if (p >= M.length)
		    throw new Error("Not enough working memory");
		if (!_Multicore_barrier.release())
		    throw new Error("Internal barrier error @ 1");
	    };
	// Signal message loop exit.
	// Any negative number larger than numWorkers will do.
	M[_Multicore_funcLoc] = -1;
	M[_Multicore_sizeLoc] = 0;
	M[_Multicore_nextLoc] = -1000000;
	// Transmit buffers
	var xfer = [];
	for ( var x of newSAB )
	    xfer.push(x[0]);
	newSAB.unshift("transfer");
	for ( var w of _Multicore_workers )
	    w.postMessage(newSAB, xfer);
    }
    else {
	_Multicore_callback = doneCallback;
	var p = _Multicore_alloc;
	p = installArgs(p, argValues);
	p = installItems(p, fnIdent, itemSize, items);
	if (p >= M.length)
	    throw new Error("Not enough working memory");
    }
    if (!_Multicore_barrier.release())
	throw new Error("Internal barrier error @ 2");

    function processQueue() {
	if (_Multicore_queue.length)
	    _Multicore_comm.apply(Multicore, _Multicore_queue.shift());
    }

    function sliceSpace(lo, lim) {
	var items = [];
	var numItem = (lim - lo);
	var sliceHeight = Math.floor(numItem / (4*_Multicore_numWorkers));
	var extra = numItem % (4*_Multicore_numWorkers);
	while (lo < lim) {
	    var hi = lo + sliceHeight;
	    if (extra) {
		hi++;
		extra--;
	    }
	    items.push([lo, hi]);
	    lo = hi;
	}
	return items;
    }

    function cross(as, bs) {
	var items = [];
	for ( var a of as )
	    for ( var b of bs ) 
		items.push([a, b]);
	return items;
    }

    function installArgs(p, values) {
	M[_Multicore_nextArgLoc] = p;
	for ( var v of values )
	    M[p++] = v;
	M[_Multicore_argLimLoc] = p;
	return p;
    }

    function installItems(p, fn, wordsPerItem, items) {
	M[_Multicore_sizeLoc] = wordsPerItem;
	M[_Multicore_funcLoc] = p;
	M[p++] = fn.length;
	for ( var c of fn )
	    M[p++] = c.charCodeAt(0);
	M[_Multicore_nextLoc] = p;
	switch (wordsPerItem) {
	case 0:
	    break;
	case 2:
	    for ( var i of items )
		for ( var j of i )
		    M[p++] = j;
	    break;
	case 4:
	    for ( var i of items )
		for ( var j of i )
		    for ( var k of j )
			M[p++] = k;
	    break;
	}
	M[_Multicore_limLoc] = p;
	return p;
    }

    function processArgs(outputMem, args) {
	var argValues = [];
	var newSAB = [];
	var vno = 0;

	pushArg(outputMem, true);
	for ( var a of args )
	    pushArg(a);
	return { argValues, newSAB };

	function pushArg(v, isFirst) {
	    if (+v === v) {
		if (isFirst)
		    throw new Error("Output object must be a shared memory array");
		if ((v|0) === v) {
		    argValues.push(ARG_INT);
		    argValues.push(v);
		}
		else {
		    argValues.push(ARG_FLOAT);
		    if (argValues.length & 1)
			argValues.push(0);
		    ftmp[0] = v;
		    argValues.push(itmp[0]);
		    argValues.push(itmp[1]);
		}
		++vno;
		return;
	    }

	    if (v === undefined) {
		argValues.push(ARG_UNDEF);
		++vno;
		return;
	    }

	    if (v === null) {
		argValues.push(ARG_NULL);
		++vno;
		return;
	    }

	    if (v === true || v === false) {
		argValues.push(ARG_BOOL | (v ? 256 : 0));
		++vno;
		return;
	    }

	    if (typeof v == 'string') {
		if (v.length >= 0x1000000)
		    throw new Error("String too long to be marshalled");
		argValues.push(ARG_STRING | (v.length << 8));
		var i = 0;
		while (i < v.length) {
		    var k = v.charCodeAt(i++);
		    if (i < v.length)
			k |= (v.charCodeAt(i++) << 16);
		    argValues.push(k);
		}
		++vno;
		return;
	    }

	    if (v instanceof SharedArrayBuffer) {
		argValues.push(ARG_SAB);
		argValues.push(registerSab(v));
		++vno;
		return;
	    }

	    var tag = 0;
	    if (v instanceof SharedInt8Array)
		tag = TAG_I8;
	    else if (v instanceof SharedUint8Array)
		tag = TAG_U8;
	    else if (v instanceof SharedUint8ClampedArray)
		tag = TAG_CU8;
	    else if (v instanceof SharedInt16Array)
		tag = TAG_I16;
	    else if (v instanceof SharedUint16Array)
		tag = TAG_U16;
	    else if (v instanceof SharedInt32Array)
		tag = TAG_I32;
	    else if (v instanceof SharedUint32Array)
		tag = TAG_U32;
	    else if (v instanceof SharedFloat32Array)
		tag = TAG_F32;
	    else if (v instanceof SharedFloat64Array)
		tag = TAG_F64;
	    else
		throw new Error("Argument #" + vno + " must be Number or shared array: " + v);

	    argValues.push(ARG_STA | (tag << 8));
	    argValues.push(registerSab(v.buffer));
	    argValues.push(v.byteOffset);
	    argValues.push(v.length);
	    ++vno;
	}

	function registerSab(sab) {
	    for ( var i=0 ; i < _Multicore_knownSAB.length ; i++ )
		if (_Multicore_knownSAB[i] === sab)
		    return i;
	    var k = _Multicore_knownSAB.length;
	    _Multicore_knownSAB.push(sab);
	    newSAB.push([sab, k]);
	    return k;
	}
    }
}

/*
Master/worker protocol.

There are seven distinguished locations in the private working memory
that are distributed to the workers on startup:

  barrierLoc  - the first location for the shared barrier sync
  funcLoc     - holds the index of the function name representation
  sizeLoc     - holds the number of words in a work item
  nextLoc     - holds the array index of the next work item
  limLoc      - holds the first array index past the last work item
  nextArgLoc  - holds the index of the first argument
  argLimLoc   - holds the first array index past the last argument

The function name is a sequence of values: the first value is the
number of characters in the name, then follows one character per
element.

The worker creates a barrier on the barrierLoc and then enters that
barrier, and thus we're off.

The master has the following actions it wants to accomplish:

 - transfer new SAB values
 - perform parallel work
 - broadcast something


Transfer:

The workers are made to exit their message loop by passing a
distinguished value and releasing them from the barrier.  New messages
are then sent to them to transfer the new SAB values; the workers
receive them and register them and re-enter the message loop.


Computation:

One or more "arguments" are passed in the args area.

Suppose nextArgLoc < argLimLoc.  Let A=nextArgLoc and M be the
private working memory.

  the M[A] is a tag: int, float, bool, null, undefined, sab, or sta
  if tag==null or tag==undefined then there's no data
  if tag==bool then the eighth bit of the tag is 1 or 0
  if tag==int, then the int follows immediately
  if tag==float, there may be padding and then the float follows immediately
    in native word order
  if tag==string, the high 24 bits of the tag are the string's length,
    and the following ceil(length/2) words are characters, in order,
    packed (hi << 16)|lo to each word
  if tag==sab, then there is one argument word:
    - sab identifier
  if tag==sta, then the tag identifies the array type, and there are
    the following three argument words:
    - sab identifier
    - byteoffset, or 0 for 
    - element count

The first argument is always the output array, and it must be a SAB or
array type.

The arguments past the first are passed to the worker as arguments
after the index space arguments.


Broadcast:

This is exactly as for computation, except that the output array
argument is always the Multicore system's private metadata SAB, and
there are no work items.  The worker side recognizes the array as a
signal and calls the target function once on each worker.

*/
