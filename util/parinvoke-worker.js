// The application must install its functions in Multicore.initMemory
// and Multicore.performWork.  The initMemory function takes a
// SharedArrayBuffer and returns an object.  The performWork function
// takes that object, and the subgrid coordinates, and does its thing.

const Multicore =
    {
	initMemory: [],
	performWork: []
    };

var _Multicore_mem = null;
var _Multicore_barrier = null;
var _Multicore_funcLoc = 0;
var _Multicore_sizeLoc = 0;
var _Multicore_nextLoc = 0;
var _Multicore_limLoc = 0;
var _Multicore_sab = null;
var _Multicore_userMem = null;

onmessage =
    function (ev) {
	switch (ev.data[0]) {
	case "start":
	    var [_, sab, barrierLoc, funcLoc, sizeLoc, nextLoc, limLoc] = ev.data;
	    _Multicore_mem = new SharedInt32Array(sab);
	    _Multicore_barrier = new WorkerBarrier(0x1337, _Multicore_mem, barrierLoc);
	    _Multicore_funcLoc = funcLoc;
	    _Multicore_sizeLoc = sizeLoc;
	    _Multicore_nextLoc = nextLoc;
	    _Multicore_limLoc = limLoc;
	    _Multicore_messageLoop();
	    break;

	case "compute":
	    var [_, sab] = ev.data;
	    var id = Atomics.load(_Multicore_mem, _Multicore_funcLoc);
	    var fn = Multicore.initMemory[id];
	    if (!fn)
		throw new Error("No initMemory function installed for ID " + id);
	    _Multicore_sab = sab;
	    _Multicore_userMem = fn(sab);
	    _Multicore_messageLoop();
	    break;
	}
    };

function _Multicore_messageLoop() {
    for (;;) {
	_Multicore_barrier.enter();
	var size = _Multicore_mem[_Multicore_sizeLoc];
	var limit = _Multicore_mem[_Multicore_limLoc];
	var id = _Multicore_mem[_Multicore_funcLoc];
	var fn = Multicore.performWork[id];
	if (!fn)
	    throw new Error("No performWork function installed for ID " + id);
	var item = Atomics.add(_Multicore_mem, _Multicore_nextLoc, size);
	if (item < 0)
	    break;
	while (item < limit) {
	    switch (size) {
	    case 2:
		fn(_Multicore_userMem, _Multicore_mem[item], _Multicore_mem[item+1]);
		break;
	    case 4:
		fn(_Multicore_userMem, _Multicore_mem[item], _Multicore_mem[item+1], _Multicore_mem[item+2], _Multicore_mem[item+3]);
		break;
	    default:
		throw new Error("Only 1D and 2D computations supported");
	    }
	    item = Atomics.add(_Multicore_mem, _Multicore_nextLoc, size);
	}
    }
}
