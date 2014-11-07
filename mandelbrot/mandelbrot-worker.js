importScripts("../util/barrier.js");
importScripts("mandelbrot-parameters.js");

// Set this to larger values to zoom in on the center.
const magnification = 100;

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

// Maximum iterations per pixel.  It's possible this should be scaled by
// magnification.
const MAXIT = 1000;

// Colors from http://en.wikipedia.org/wiki/List_of_colors:_A%E2%80%93F,
// reversed for little-endian RGBA, with A=255.  Not pleasing to the eye.
// But vivid!
const colors = [0xFFFF0700, 0xFF2a2aa5, 0xFFFFff00, 0xFFa19eff,
		0xFF00eefd, 0xFF008000, 0xFFFAFEFE, 0xFF00FFBF];

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
	    mem[Py*width+Px] = it == MAXIT ? 0xFF000000 : colors[it & 7];
	}
    }
}
