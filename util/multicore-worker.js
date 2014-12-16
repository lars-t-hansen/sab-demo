// Data-parallel framework on shared memory: Multicore.build() and friends.
// Worker side.
// lhansen@mozilla.com / 16 December 2014

// REQUIRE:
//   asymmetric-barrier.js

// A simple data-parallel framework that maintains a worker pool and
// invokes computations in parallel on shared memory.
//
// Load this into your worker code, after loading asymmetric-barrier.js.
//
// Call Multicore.addFunction() to register functions with the
// framework.  The functions will be invoked when work orders are
// received from the master.  (The framework owns the message loop.)
//
// Each worker function takes an object (the output array), an even
// number of loop bounds (lo ... hi, for lo <= index < hi), and any
// additional arguments that were passed by the master.
//
// Call Multicore.msg() to send a message to the console, via the
// master.

"use strict";

const Multicore =
    {
	addFunction: _Multicore_addFunction,
	msg: _Multicore_msg
    };

// Register a worker function.
//
// name is a string; user code will pass this string to Multicore.build()
//   on the master side.
// func is the function to invoke.  It will be called on the output object,
//   an even number of index range values (pairs of lo and hi, lo <= index < hi),
//   and on any other arguments user code passes to Multicore.build().
//
// Returns nothing.

function _Multicore_addFunction(name, func) {
    _Multicore_functions[name] = func;
}

// Print a message on the console.

function _Multicore_msg(msg) {
    postMessage(String(msg));
}

// PRIVATE.

var _Multicore_mem = null;
var _Multicore_barrier = null;
var _Multicore_funcLoc = 0;
var _Multicore_sizeLoc = 0;
var _Multicore_nextLoc = 0;
var _Multicore_limLoc = 0;
var _Multicore_nextArgLoc = 0;
var _Multicore_argLimLoc = 0;
var _Multicore_sab = null;
var _Multicore_knownSAB = [null];	// Direct map from ID to SAB
var _Multicore_functions = {};
var _Multicore_global = this;

Multicore.addFunction("_Multicore_eval", _Multicore_eval);

onmessage =
    function (ev) {
	switch (ev.data[0]) {
	case "start":
	    var [_, sab, barrierLoc, funcLoc, sizeLoc, nextLoc, limLoc, nextArgLoc, argLimLoc] = ev.data;
	    _Multicore_mem = new SharedInt32Array(sab);
	    _Multicore_barrier = new WorkerBarrier(0x1337, _Multicore_mem, barrierLoc);
	    _Multicore_funcLoc = funcLoc;
	    _Multicore_sizeLoc = sizeLoc;
	    _Multicore_nextLoc = nextLoc;
	    _Multicore_limLoc = limLoc;
	    _Multicore_nextArgLoc = nextArgLoc;
	    _Multicore_argLimLoc = argLimLoc;
	    _Multicore_knownSAB[0] = sab;
	    _Multicore_messageLoop();
	    break;

	case "transfer":
	    var info = ev.data;
	    info.shift();
	    for ( var [sab,k] of info )
		_Multicore_knownSAB[k] = sab;
	    _Multicore_messageLoop();
	    break;
	}
    };

function _Multicore_messageLoop() {
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

    for (;;) {
	_Multicore_barrier.enter();
	var size = M[_Multicore_sizeLoc];
	var limit = M[_Multicore_limLoc];
	var nextArg = M[_Multicore_nextArgLoc];
	var argLimit = M[_Multicore_argLimLoc];

	var item = Atomics.add(M, _Multicore_nextLoc, size);
	if (item < 0)
	    break;

	var userMem = parseArg();
	var args = [];
	while (nextArg < argLimit)
	    args.push(parseArg());

	var p = M[_Multicore_funcLoc];
	var l = M[p++];
	var id = "";
	for ( var i=0 ; i < l ; i++ )
	    id += String.fromCharCode(M[p++]);
	var fn = _Multicore_functions[id];
	if (!fn)
	    throw new Error("No function installed for ID '" + id + "'");

	// Passing the private memory as the output buffer is a special signal.
	if (userMem == _Multicore_mem.buffer) {
	    // Broadcast.  Do not expect any work items, just invoke the function and
	    // reenter the barrier.
	    fn.apply(null, args);
	    continue;
	}

	// Can specialize the loop for different values of args.length
	if (args.length > 0) {
	    switch (size) {
	    case 2: args.unshift(userMem, 0, 0); break;
	    case 4: args.unshift(userMem, 0, 0, 0, 0); break;
	    }
	}
	while (item < limit) {
	    switch (size) {
	    case 2:
		switch (args.length) {
		case 0:
		    fn(userMem, M[item], M[item+1]);
		    break;
		default:
		    // Can specialize this for small values of args.length
		    args[1] = M[item];
		    args[2] = M[item+1];
		    fn.apply(null, args);
		    break;
		}
		break;
	    case 4:
		switch (args.length) {
		case 0:
		    fn(userMem, M[item], M[item+1], M[item+2], M[item+3]);
		    break;
		default:
		    // Can specialize this for small values of args.length
		    args[1] = M[item];
		    args[2] = M[item+1];
		    args[3] = M[item+2];
		    args[4] = M[item+3];
		    fn.apply(null, args);
		    break;
		}
		break;
	    default:
		throw new Error("Only 1D and 2D computations supported");
	    }
	    item = Atomics.add(M, _Multicore_nextLoc, size);
	}
    }

    function parseArg() {
	var tag = M[nextArg++];
	switch (tag & 255) {
	case ARG_INT:
	    return M[nextArg++];
	case ARG_FLOAT:
	    if (nextArg & 1)
		nextArg++;
	    itmp[0] = M[nextArg++];
	    itmp[1] = M[nextArg++];
	    return ftmp[0];
	case ARG_SAB:
	    return _Multicore_knownSAB[M[nextArg++]];
	case ARG_STA:
	    var sab = _Multicore_knownSAB[M[nextArg++]];
	    var byteOffset = M[nextArg++];
	    var length = M[nextArg++];
	    switch (tag >> 8) {
	    case TAG_I8: return new SharedInt8Array(sab, byteOffset, length);
	    case TAG_U8: return new SharedUint8Array(sab, byteOffset, length);
	    case TAG_CU8: return new SharedUint8ClampedArray(sab, byteOffset, length);
	    case TAG_I16: return new SharedInt16Array(sab, byteOffset, length);
	    case TAG_U16: return new SharedUint16Array(sab, byteOffset, length);
	    case TAG_I32: return new SharedInt32Array(sab, byteOffset, length);
	    case TAG_U32: return new SharedUint32Array(sab, byteOffset, length);
	    case TAG_F32: return new SharedFloat32Array(sab, byteOffset, length);
	    case TAG_F64: return new SharedFloat64Array(sab, byteOffset, length);
	    default: throw new Error("Bad array typetag: " + tag.toString(16));
	    }
	case ARG_BOOL:
	    return !!(tag >> 8);
	case ARG_UNDEF:
	    return undefined;
	case ARG_NULL:
	    return null;
	case ARG_STRING:
	    var len = (tag >>> 8);
	    var i = 0;
	    var s = "";
	    while (i < len) {
		var w = M[nextArg++];
		s += String.fromCharCode(w & 0xFFFF);
		i++;
		if (i < len) {
		    s += String.fromCharCode(w >>> 16);
		    i++;
		}
	    }
	    return s;
	}
    }
}

function _Multicore_eval(program) {
    _Multicore_global.eval(program);
}
