// Mandelbrot computation in asm.js.
//
// Not currently being used.
//
// To use it you want to replace the definition of mandelbrot in mandelbrot-worker.js
// with this:

/*
	    var mandelbrot =
		(function () {
		    var kernel = mandelbrot_asm_module(glob, {}, sab);
		    return function (ybase, ylimit, magnification) {
			return kernel(width, height, g_center_y, g_center_x, ybase, ylimit, magnification);
		    };
		})();
*/

// This is valid asm.js (and does no color lookup yet), but it is
// not any faster than the JS version.
//
// That could be because:
//  - asm.js shared memory operations are slower (less optimized) than
//    plain-js shared memory operations, so we need to investigate that.
//  - there is "overhead", ie, synchronization, that prevents faster
//    times though that's not likely; setting MAXIT to 5 drops the time
//    on 4 cores from 178ms to 18ms, for example (on plain JS) so there
//    is plenty of room to breathe
//  - IonMonkey does a really good job on plain JS because there's a lot
//    of type info; this seems probable, in fact.

function mandelbrot_asm_module(glob, ffi, heap) {
    "use asm";

    var i32 = new glob.SharedInt32Array(heap);
    var imul = glob.Math.imul;

    function mbrot(width, height, g_center_y, g_center_x, ybase, ylimit, magnification) {
	width = width|0;
	height = height|0;
	g_center_y = +g_center_y;
	g_center_x = +g_center_x;
	ybase = ybase|0;
	ylimit = ylimit|0;
	magnification = +magnification;
	var g_top = 0.0;
	var g_bottom = 0.0;
	var g_left = 0.0;
	var g_right = 0.0;
	var Py = 0;
	var Px = 0;
	var x0 = 0.0;
	var y0 = 0.0;
	var x = 0.0;
	var y = 0.0;
	var it = 0;
	var xtemp = 0.0;
	var loc = 0;
	g_top = g_center_y + (1.0/magnification);
	g_bottom = g_center_y - (1.0/magnification);
	g_left = g_center_x - (+(width|0) / +(height|0)) * (1.0/magnification);
	g_right = g_center_x + (+(width|0) / +(height|0))* (1.0/magnification);
	for ( Py=ybase ; (Py|0) < (ylimit|0) ; Py=(Py+1)|0 ) {
	    for ( Px=0 ; (Px|0) < (width|0) ; Px=(Px+1)|0 ) {
		x0 = g_left + (+(Px|0) / +(width|0)) * (g_right - g_left);
		y0 = g_bottom + (+(Py|0) / +(height|0)) * (g_top - g_bottom);
		x = 0.0;
		y = 0.0;
		it = 0;
		while (x*x + y*y < 4.0) {
		    if ((it|0) >= 1000) break;
		    xtemp = x*x - y*y + x0;
		    y = 2.0*x*y + y0;
		    x = xtemp;
		    it=(it+1)|0;
		}
		loc = imul(imul(Py|0, width|0) + Px|0, 4);
		i32[loc>>2] = (it|0) == 1000 ? 0xFF000000 : (0xFF000000 + (it&255)<<16); // FIXME
	    }
	}
    }

    return mbrot;
}
