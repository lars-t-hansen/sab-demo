// 24 November 2014 / lhansen@mozilla.com

// A simple data-parallel framework that maintains a worker pool and
// invokes computations in parallel on shared memory.
//
// Load this into your main program, after loading barrier.js.
//
// Call Multicore.init() to set things up (see spec below).
//
// Call Multicore.build() to perform work (see spec below).

const Multicore =
    {
	init: _Multicore_init,
	build: _Multicore_build
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
var _Multicore_knownSAB = [];

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
// doneCallback is a function, it will be invoked in the master once
//   the work is finished.
// fnIdent is the string identifier of the remote function to invoke.
//   The worker must register an appropriate handler.
// outputMem is a SharedTypedArray or SharedArrayBuffer that will (in
//   principle, though it's up to user code) receive the results of
//   the computation.
// indexSpace is an array of length-2 arrays determining the index
//   space of the computation; workers will be invoked on subvolumes
//   of this space in an unpredictable order.
// The ...args can be number, SharedTypedArray, or SharedArrayBuffer
//   values and will be marshalled and passed as arguments to the user
//   function on the worker side.
//
// You can call this function repeatedly, but only one call can be
// outstanding: only when the doneCallback has been invoked can
// Multicore.build be called again.

function _Multicore_build(doneCallback, fnIdent, outputMem, indexSpace, ...args) {
    const M = _Multicore_mem;

    const ARG_INT = 1;
    const ARG_FLOAT = 2;
    const ARG_SAB = 3;
    const ARG_ARRAY = 4;

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

    for ( var x of indexSpace )
	if (x.length != 2 || typeof x[0] != 'number' || typeof x[1] != 'number' || (x[0]|0) != x[0] || (x[1]|0) != x[1])
	    throw new Error("Bad indexSpace element " + x)
    var items;
    switch (indexSpace.length) {
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
    if (newSAB.length) {
	_Multicore_callback =
	    function () {
		_Multicore_callback = doneCallback;
		var p = _Multicore_alloc;
		p = installArgs(p, argValues);
		p = installItems(p, fnIdent, itemSize, items);
		if (p >= M.length)
		    throw new Error("Not enough working memory");
		_Multicore_barrier.release();
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
    _Multicore_barrier.release();

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
		return;
	    }

	    if (v instanceof SharedArrayBuffer) {
		argValues.push(ARG_SAB);
		argValues.push(registerSab(v));
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
		throw new Error("Argument must be Number or shared array: " + v);

	    argValues.push(ARG_ARRAY | (tag << 8));
	    argValues.push(registerSab(v.buffer));
	    argValues.push(v.byteOffset);
	    argValues.push(v.length);
	}

	function registerSab(sab) {
	    for ( var i=0 ; i < _Multicore_knownSAB.length ; i++ )
		if (_Multicore_knownSAB[i] === x)
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
  funcLoc     - holds the function identifier for an invocation
  sizeLoc     - holds the number of words in a work item
  nextLoc     - holds the array index of the next work item
  limLoc      - holds the first array index past the last work item
  nextArgLoc  - holds the index of the first argument
  argLimLoc   - holds the first array index past the last argument

The worker creates a barrier on the barrierLoc and then enters that
barrier, and thus we're off.

The master has the following actions it wants to accomplish:

 - transfer new SAB values
 - perform parallel work


Transfer:

The workers are made to exit their message loop by passing a
distinguished value and releasing them from the barrier.  New messages
are then sent to them to transfer the new SAB values; the workers
receive them and register them and re-enter the message loop.


Computation:

One or more "arguments" are passed in the args area.

Suppose nextArgLoc < argLimLoc.  Let A=nextArgLoc and M be the
private working memory.

  the M[A] is a tag: int, float, sab, or array
  if tag==int, then the int follows immediately
  if tag==float, there may be padding and then the float follows immediately
    in native word order
  if tag==sab, then there is one argument word:
    - sab identifier
  if tag==array, then the tag identifies the array type, and there are
    the following three argument words:
    - sab identifier
    - byteoffset, or 0 for 
    - element count

The first argument is always the output array, and it must be a SAB or
array type.

The arguments past the first are passed to the worker as arguments
after the index space arguments.

*/
