// numWorkers is defined by the html document, for convenience.
//const numWorkers = ...;
const magFactor = 1.05;
const maxIterations = 250;
const animate = true;

Multicore.init(numWorkers, "mandelbrot-worker.js", doMandelbrot);

const rawmem = new SharedArrayBuffer(height*width*4*2);
const mem1 = new Int32Array(rawmem, 0, height*width);
const mem2 = new Int32Array(rawmem, height*width*4, height*width);

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
    if (animate && iterations < maxIterations) {
	iterations++;
	magnification *= magFactor;
	mem = (memnow == mem1) ? mem2 : mem1;
	// Overlap display of this frame with computation of the next.
	doMandelbrot();
    }
    else {
	var t = Date.now() - timeBefore;
	var fps = Math.round((iterations/(t/1000))*10)/10;
	document.getElementById('myresults').innerHTML = "Number of workers: " + numWorkers + "  Compute time: " + t + "ms  FPS=" + fps;
	display = true;
    }
    if (display)
	canvasSetFromABGRBytes(document.getElementById("mycanvas"),
			       new Uint8Array(rawmem, memnow.byteOffset, height*width*4),
			       height,
			       width);
}
