const numWorkers = 8;
const maxIterations = 120;
const animate = true;

Multicore.init(numWorkers, "mandelbrot-worker.js", doMandelbrot);

const rawmem = new SharedArrayBuffer(height*width*4*2);
const mem1 = new SharedInt32Array(rawmem, 0, height*width);
const mem2 = new SharedInt32Array(rawmem, height*width*4, height*width);

var magnification = 1;
var iterations = 0;
var mem = mem1;
var timeBefore;

function doMandelbrot() {
    Multicore.build(showMandelbrot, "mandelbrot", mem, [[0,height], [0,width]], magnification);
}

function showMandelbrot() {
    var memnow = mem;
    var display = animate;
    if (iterations == 0)
	timeBefore = Date.now();
    if (iterations < maxIterations) {
	iterations++;
	magnification *= 1.1;
	mem = (memnow == mem1) ? mem2 : mem1;
	// Overlap display of this frame with computation of the next.
	doMandelbrot();
    }
    else {
	var t = Date.now() - timeBefore;
	console.log("Number of workers: " + numWorkers + "  Compute time: " + t + "ms  FPS=" + (iterations/(t/1000)));
	display = true;
    }
    if (display) 
	canvasSetFromABGRBytes(document.getElementById("mycanvas"),
			       new SharedUint8Array(rawmem, memnow.byteOffset, height*width*4),
			       height,
			       width);
}
