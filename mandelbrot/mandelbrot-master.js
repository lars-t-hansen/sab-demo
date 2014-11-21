const numWorkers = 4;

// The memory contains the height*width grid and extra shared space
// for the barrier that is used to coordinate workers.

const mem = new SharedInt32Array(height*width + MasterBarrier.NUMLOCS);
const sab = mem.buffer;
const barrierLoc = height*width; // Barrier memory follows grid memory
const barrierID = 1337;

// Split worker creation and initialization from computation to get a
// realistic picture of the parallel speedup.  In Firefox, we must
// return to the event loop before worker creation is completed, hence
// the workers enter a barrier before and after the computation to
// start off at the same time in an initialized state.

const barrier = new MasterBarrier(barrierID, numWorkers, mem, barrierLoc, barrierQuiescent);
const sliceHeight = height/numWorkers;

for ( var i=0 ; i < numWorkers ; i++ ) {
    var w = new Worker("mandelbrot-worker.js"); 
    w.onmessage =
	function (ev) {
	    if (ev.data instanceof Array && ev.data.length == 2 && ev.data[0] == "MasterBarrier.dispatch")
		MasterBarrier.dispatch(ev.data[1]);
	    else
		console.log(ev.data);
	}
    w.postMessage(["setup",
		   sab,
		   barrierID,
		   barrierLoc,
		   i*sliceHeight,
		   (i == numWorkers-1 ? height : (i+1)*sliceHeight)], [sab]);
}

var timeBefore;
function barrierQuiescent() {
    if (!timeBefore)
	timeBefore = Date.now();
    else {
	console.log("Number of workers: " + numWorkers + "  Compute time: " + (Date.now() - timeBefore) + "ms");
	canvasSetFromABGRBytes(document.getElementById("mycanvas"),
			       new SharedUint8Array(sab, 0, height*width*4),
			       height,
			       width);
    }
    barrier.release();
}
