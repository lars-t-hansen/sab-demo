// The application must install its functions in Multicore.functions.
// Each function takes an object (the output array), an even number of
// loop bounds, and optionally additional arguments that were passed
// by the master.

const Multicore =
    {
	functions: []
    };

var _Multicore_mem = null;
var _Multicore_barrier = null;
var _Multicore_funcLoc = 0;
var _Multicore_sizeLoc = 0;
var _Multicore_nextLoc = 0;
var _Multicore_limLoc = 0;
var _Multicore_nextArgLoc = 0;
var _Multicore_argLimLoc = 0;
var _Multicore_sab = null;
var _Multicore_knownSAB = [];	// Direct map from ID to SAB

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

	var id = M[_Multicore_funcLoc];
	var fn = Multicore.functions[id];
	if (!fn)
	    throw new Error("No function installed for ID " + id);

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
	case ARG_ARRAY:
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
	}
    }
}
