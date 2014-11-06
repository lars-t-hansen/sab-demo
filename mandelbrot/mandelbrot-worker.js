// FIXME: a sexier color scheme would be OK.

importScripts("mandelbrot-parameters.js");

// Set this to larger values to zoom in on the center.
const magnification = 1;

var mem;

onmessage =
    function (ev) {
	switch (ev.data[0]) {
	case "start":
	    mem = new SharedInt32Array(ev.data[1]);
	    break;
	case "compute":
	    var [_, ybase, ylimit, coord] = ev.data;
	    mandelbrot(mem, ybase, ylimit, 10);
	    if (Atomics.sub(mem, coord, magnification) == 1)
		postMessage("done");
	    break;
	default:
	    postMessage("Bad tag: " + ev.data[0]);
	    break;
	}
    };

// Maximum iterations per pixel.
const MAXIT = 1000;

// Compute a strip of pixels from ybase <= y < ylimit.
// mem is a SharedInt32Array representing a height*width grid.
function mandelbrot(mem, ybase, ylimit, magnification) {
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
