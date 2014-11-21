// A simple utility that maintains a worker pool and invokes
// computations in parallel on data.
//
// Load this into your main program, then call Multicore.init() to set
// things up.  Then call Multicore.build() to perform work.
//
// Functions are transmitted from the master to the workers as numeric
// IDs; the master and the workers must agree on those IDs, and the
// workers must set up local function tables.  See parinvoke-worker.js
// for more information.

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
var _Multicore_previousOutputMem = null;
var _Multicore_funcLoc = 0;
var _Multicore_sizeLoc = 0;
var _Multicore_nextLoc = 0;
var _Multicore_limLoc = 0;

// Multicore.init()
//
// numWorkers must be a positive integer.
// workerScript must be a URL.
// readyCallback must be a function, it will be called when the workers
//   have been set up.

function _Multicore_init(numWorkers, workerScript, readyCallback) {
    _Multicore_numWorkers = numWorkers;
    _Multicore_mem = new SharedInt32Array(0x10000);
    _Multicore_alloc = 0;
    _Multicore_barrierLoc = _Multicore_alloc;
    _Multicore_barrier = new MasterBarrier(0x1337,
					   _Multicore_numWorkers,
					   _Multicore_mem,
					   _Multicore_barrierLoc,
					   _Multicore_barrierQuiescent);
    _Multicore_alloc += MasterBarrier.NUMLOCS;
    _Multicore_funcLoc = _Multicore_alloc++;
    _Multicore_sizeLoc = _Multicore_alloc++;
    _Multicore_nextLoc = _Multicore_alloc++;
    _Multicore_limLoc = _Multicore_alloc++;
    _Multicore_callback = readyCallback;
    for ( var i=0 ; i < numWorkers ; i++ ) {
	var w = new Worker(workerScript);
	w.onmessage = _Multicore_msg;
	w.postMessage(["start",
		       _Multicore_mem.buffer,
		       _Multicore_barrierLoc, _Multicore_funcLoc, _Multicore_sizeLoc, _Multicore_nextLoc, _Multicore_limLoc],
		      [_Multicore_mem.buffer]);
	_Multicore_workers.push(w);
    }
}

function _Multicore_barrierQuiescent() {
    var fn;
    if (fn = _Multicore_callback) {
	_Multicore_callback = null;
	fn();
    }
    else
	throw new Error("No barrier callback installed!");
}

function _Multicore_msg(ev) {
    switch (ev.data[0]) {
    case "MasterBarrier.dispatch":
	MasterBarrier.dispatch(ev.data[1]);
	break;
    default:
	console.log(ev.data);
	break;
    }
}

// Multicore.build()
//
// doneCallback is a function, it will be invoked in the master once the
//   work is finished.
// fnIdent is the numeric identifier of the remote function to invoke.
//   See top of file for more information.
// outputMem is a SharedTypedArray or SharedArrayBuffer that will receive
//   results of the computation.
// indexSpace is an array of length-2 arrays determining the index space
//   of the computation; workers will be invoked on subvolumes of this
//   space in an unpredictable order.
//
// TODO: this wants to take additional arguments to be passed to the worker.
//
// TODO: really we should take care of transmission in a better way: we should
//   transmit not just the base type, but also byteoffset / byterange!

function _Multicore_build(doneCallback, fnIdent, outputMem, indexSpace) {
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
    var itemSize = indexSpace.length * 2;
    if (outputMem != _Multicore_previousOutputMem) {
	_Multicore_callback =
	    function () {
		_Multicore_callback = doneCallback;
		installItems(fnIdent, itemSize, items);
		_Multicore_barrier.release();
	    };
	_Multicore_mem[_Multicore_funcLoc] = fnIdent;
	_Multicore_mem[_Multicore_nextLoc] = -1000000;
	var value = outputMem instanceof SharedArrayBuffer ? outputMem : outputMem.buffer;
	for ( var w of _Multicore_workers )
	    w.postMessage(["compute", value], [value]);
	_Multicore_previousOutputMem = outputMem;
    }
    else {
	_Multicore_callback = doneCallback;
	installItems(fnIdent, itemSize, items);
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

    function installItems(fn, wordsPerItem, items) {
	// Set up the work queue in shared memory
	var m = _Multicore_mem;
	m[_Multicore_sizeLoc] = wordsPerItem;
	m[_Multicore_funcLoc] = fn;
	m[_Multicore_nextLoc] = _Multicore_alloc;
	m[_Multicore_limLoc] = _Multicore_alloc + wordsPerItem*items.length;
	var p = _Multicore_alloc;
	switch (wordsPerItem) {
	case 2:
	    for ( var i of items )
		for ( var j of i )
		    m[p++] = j;
	    break;
	case 4:
	    for ( var i of items )
		for ( var j of i )
		    for ( var k of j )
			m[p++] = k;
	    break;
	}
    }
}
