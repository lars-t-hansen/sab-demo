// mandelbrot-parameters.js must have been loaded before this.

const numWorkers = 3;

// The memory contains the height*width grid and one extra shared
// variable that is used to coordinate the workers.  Its initial value
// is the number of workers.  When a worker is done it decrements the
// variable; the worker to decrement it to zero signals the master
// that the work is complete.

// FIXME: uncomment when we have a new build
const mem = new SharedInt32Array(0x200000 /*height*width + 1*/);
const sab = mem.buffer;
const coord = height*width;
mem[coord] = numWorkers;

// Split worker creation and initialization from computation to get a
// realistic picture of the parallel speedup.  In Firefox, we must
// return to the event loop before worker creation is completed, hence
// the setTimeout below.

const workers = [];
for ( var i=0 ; i < numWorkers ; i++ ) {
    var w = new Worker("mandelbrot-worker.js"); 
    w.onmessage =
	function (ev) {
	    if (ev.data == "done")
		showResult();
	    else
		console.log(ev.data);
	}
    w.postMessage(["start", sab], [sab]);
    workers.push(w);
    setTimeout(compute, 0);
}

var timeBefore;
function compute() {
    timeBefore = new Date();

    const sliceHeight = height/numWorkers;
    for ( var i=0 ; i < numWorkers ; i++ ) {
	var w = workers[i];
	w.postMessage(["compute", i*sliceHeight, (i == numWorkers-1 ? height : (i+1)*sliceHeight), coord])
    }
}

function showResult() {
    const timeAfter = new Date();

    var mycanvas = document.getElementById("mycanvas");
    var cx = mycanvas.getContext('2d');
    var id  = cx.createImageData(width, height);
    var tmp = new SharedUint8Array(sab, 0, height*width*4); 
    id.data.set(tmp);
    cx.putImageData( id, 0, 0 );

    console.log("Compute time: " + (timeAfter - timeBefore) + "ms");
}
