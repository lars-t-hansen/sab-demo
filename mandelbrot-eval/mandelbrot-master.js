// Center the image at this location.
const g_center_x = -0.743643887037158704752191506114774;
const g_center_y = 0.131825904205311970493132056385139;

// Pixel grid.  (0,0) correspons to (bottom,left)
const height = 480;
const width = 640;

// Animation control.
const magFactor = 1.05;
const maxIterations = 250;
const animate = true;

// I would have liked for the empty worker to be a data: URL, but in
// that case importScripts becomes illegal.

Multicore.init(numWorkers,
	       "mandelbrot-empty-worker.js",
	       function () {
		   Multicore.eval(doMandelbrot, worker_code);
	       });

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
			       new SharedUint8Array(rawmem, memnow.byteOffset, height*width*4),
			       height,
			       width);
}

const worker_code =
`
const g_center_x = ${g_center_x};
const g_center_y = ${g_center_y};

const height = ${height};
const width = ${width};

Multicore.addFunction("mandelbrot", mandelbrot);

// Maximum iterations per pixel.
const MAXIT = 200;

// Colors are ABGR with A=255.
const colors = [0xFFFF0700, 0xFF2a2aa5, 0xFFFFff00, 0xFFa19eff,
		0xFF00eefd, 0xFF008000, 0xFFFAFEFE, 0xFF00FFBF];

// Compute a square of pixels into mem with y in [ybase, ylimit)
// and x in [xbase, xlimit).

function mandelbrot(mem, ybase, ylimit, xbase, xlimit, magnification) {
    const g_top = g_center_y + 1/magnification;
    const g_bottom = g_center_y - 1/magnification;
    const g_left = g_center_x - width/height*1/magnification;
    const g_right = g_center_x + width/height*1/magnification;
    for ( var Py=ybase ; Py < ylimit ; Py++ ) {
	for ( var Px=xbase ; Px < xlimit ; Px++ ) {
	    var x0 = g_left+(Px/width)*(g_right-g_left);
	    var y0 = g_bottom+(Py/height)*(g_top-g_bottom);
	    var x = 0.0;
	    var y = 0.0;
	    var it = 0;
	    while (x*x + y*y < 4.0 && it < MAXIT) {
		var xtemp = x*x - y*y + x0;
		y = 2.0*x*y + y0;
		x = xtemp;
		it++;
	    }
	    mem[Py*width+Px] = it == MAXIT ? 0xFF000000 : colors[it & 7];
	}
    }
}
`;
