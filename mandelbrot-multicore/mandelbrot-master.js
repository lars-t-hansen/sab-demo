const numWorkers = 4;

// Set this to larger values to zoom in on the center.
const magnification = 100;

Multicore.init(numWorkers, "mandelbrot-worker.js", doMandelbrot);

const mem = new SharedInt32Array(height*width);
var timeBefore;

function doMandelbrot() {
    timeBefore = Date.now();
    Multicore.build(mandelbrotDone, "mandelbrot", mem, [[0,height], [0,width]], magnification);
}

function mandelbrotDone() {
    console.log("Number of workers: " + numWorkers + "  Compute time: " + (Date.now() - timeBefore) + "ms");
    canvasSetFromABGRBytes(document.getElementById("mycanvas"),
			   new SharedUint8Array(mem.buffer, 0, height*width*4),
			   height,
			   width);
}
