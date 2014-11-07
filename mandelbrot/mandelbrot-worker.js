// FIXME: a sexier color scheme would be OK.

importScripts("../util/barrier.js");
importScripts("mandelbrot-parameters.js");

// Set this to larger values to zoom in on the center.
const magnification = 10;

var mem;
var barrier;

onmessage =
    function (ev) {
	var [_, sab, barrierID, barrierLoc, ybase, ylimit] = ev.data;
	mem = new SharedInt32Array(sab);
	barrier = new WorkerBarrier(barrierID, mem, barrierLoc);
	barrier.enter();	// Wait for the goahead
	mandelbrot(ybase, ylimit, magnification);
	barrier.enter();	// Signal completion
    };

// Maximum iterations per pixel.
const MAXIT = 1000;

// Compute a strip of pixels from ybase <= y < ylimit.
function mandelbrot(ybase, ylimit, magnification) {
    const g_top = g_center_y + 1/magnification;
    const g_bottom = g_center_y - 1/magnification;
    const g_left = g_center_x - width/height*1/magnification;
    const g_right = g_center_x + width/height*1/magnification;
    for ( var Py=ybase ; Py < ylimit ; Py++ ) {
	for ( var Px=0 ; Px < width ; Px++ ) {
	    var x0 = g_left+(Px/width)*(g_right-g_left);
	    var y0 = g_bottom+(Py/height)*(g_top-g_bottom);
	    var x = 0.0;
	    var y = 0.0;
	    var it = 0;
	    while (x*x + y*y < 4 && it < MAXIT) {
		var xtemp = x*x - y*y + x0;
		y = 2*x*y + y0;
		x = xtemp;
		it++;
	    }
	    var g = 255 - (it > 255 ? 255 : it);       // Green is my favorite color
	    mem[Py*width+Px] = (255 << 24) | (g << 8); // RGBA, little-endian
	}
    }
}
