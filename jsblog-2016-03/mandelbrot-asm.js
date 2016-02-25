/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function mandelbrot_asm_simd_module(glob, ffi, heap) {
    "use asm";

    const i32 = new glob.Int32Array(heap);
    const b8 = new glob.Uint8Array(heap);
    const aload = glob.Atomics.load; // Declare shared memory
    const imul = glob.Math.imul;
    const toF = glob.Math.fround;
    const b4 = glob.SIMD.Bool32x4;
    const i4 = glob.SIMD.Int32x4;
    const f4 = glob.SIMD.Float32x4;
    const i4add = i4.add;
    const i4and = i4.and;
    const i4lane = i4.extractLane;
    const f4add = f4.add;
    const f4sub = f4.sub;
    const f4mul = f4.mul;
    const f4lessThan = f4.lessThan;
    const f4splat = f4.splat;
    const b4Any = b4.anyTrue;
    const i4select = i4.select;
    const zero4 = i4(0,0,0,0);
    const one4 = i4(1,1,1,1);
    const two4 = f4(2,2,2,2);
    const four4 = f4(4,4,4,4);
    const MAXIT = ffi.MAXIT|0;
    const width = ffi.width|0;
    const height = ffi.height|0;
    const centerY = toF(ffi.centerY);
    const centerX = toF(ffi.centerX);
    const colbase = ffi.colbase|0;

    function mbrot(ybase, ylimit, membase, magnification) {
	ybase = ybase|0;
	ylimit = ylimit|0;
	membase = membase|0;
	magnification = toF(magnification);

	var g_top = toF(0);
	var g_bottom = toF(0);
	var g_left = toF(0);
	var g_right = toF(0);
	var Py = 0;
	var Px = 0;
	var x0 = f4(0,0,0,0);
	var y0 = f4(0,0,0,0);
	var x = f4(0,0,0,0);
	var y = f4(0,0,0,0);
	var mi4 = b4(0,0,0,0);
	var xsq = f4(0,0,0,0);
	var ysq = f4(0,0,0,0);
	var xtemp = f4(0,0,0,0);
	var count4 = i4(0,0,0,0);
	var it = 0;
	var loc = 0;
	var i = 0;

	g_top = toF(centerY + toF(toF(1)/magnification));
	g_bottom = toF(centerY - toF(toF(1)/magnification));
	g_left = toF(centerX - toF(toF(toF(width|0) / toF(height|0)) * toF(toF(1)/magnification)));
	g_right = toF(centerX + toF(toF(toF(width|0) / toF(height|0)) * toF(toF(1)/magnification)));
	for ( Py=ybase ; (Py|0) < (ylimit|0) ; Py=(Py+1)|0 ) {
	    for ( Px=0 ; (Px|0) < (width|0) ; Px=(Px+4)|0 ) {
		x0 = f4(toF(g_left + toF(toF(toF((Px+0)|0) / toF(width|0)) * toF(g_right - g_left))),
			toF(g_left + toF(toF(toF((Px+1)|0) / toF(width|0)) * toF(g_right - g_left))),
			toF(g_left + toF(toF(toF((Px+2)|0) / toF(width|0)) * toF(g_right - g_left))),
			toF(g_left + toF(toF(toF((Px+3)|0) / toF(width|0)) * toF(g_right - g_left))));
		y0 = f4splat(toF(g_bottom + toF(toF(toF(Py|0) / toF(height|0)) * toF(g_top - g_bottom))));
		x = f4(0,0,0,0);
		y = f4(0,0,0,0);
		count4 = i4(0,0,0,0);

		for ( it = 0 ; (it|0) < (MAXIT|0) ; it = (it+1)|0) {
		    xsq = f4mul(x,x);
		    ysq = f4mul(y,y);
		    mi4 = f4lessThan(f4add(xsq, ysq), four4);
		    if (!b4Any(mi4))
			break;
		    xtemp = f4add(f4sub(xsq, ysq), x0);
		    y = f4add(f4mul(two4, f4mul(x, y)), y0);
		    x = xtemp;
		    count4 = i4add(count4, i4select(mi4, one4, zero4));
		}

		loc = imul(imul(Py|0, width|0) + Px|0 + 0, 4);
		it = i4lane(count4,0);
		i32[(membase+loc)>>2] = (it|0) == (MAXIT|0) ? 0xFF000000|0 : i32[(colbase+((it&7)<<2))>>2]|0;

		loc = imul(imul(Py|0, width|0) + Px|0 + 1, 4);
		it = i4lane(count4,1);
		i32[(membase+loc)>>2] = (it|0) == (MAXIT|0) ? 0xFF000000|0 : i32[(colbase+((it&7)<<2))>>2]|0;

		loc = imul(imul(Py|0, width|0) + Px|0 + 2, 4);
		it = i4lane(count4,2);
		i32[(membase+loc)>>2] = (it|0) == (MAXIT|0) ? 0xFF000000|0 : i32[(colbase+((it&7)<<2))>>2]|0;

		loc = imul(imul(Py|0, width|0) + Px|0 + 3, 4);
		it = i4lane(count4,3);
		i32[(membase+loc)>>2] = (it|0) == (MAXIT|0) ? 0xFF000000|0 : i32[(colbase+((it&7)<<2))>>2]|0;
	    }
	}
    }

    return mbrot;
}

var mandelbrot =
    (function (glob) {
	var kernel;
	var buffer;
	return function (grid, ybase, ylimit, magnification) {
	    if (!kernel) {
		buffer = grid.buffer;
		kernel = mandelbrot_asm_simd_module(glob,
						    {MAXIT:glob.MAXIT, width, height, centerX, centerY, colbase},
						    buffer);
	    }
	    else if (grid.buffer != buffer)
		throw new Error("Only one shared buffer allowed with the asm.js code");
	    return kernel(ybase, ylimit, grid.byteOffset, magnification);
	};
    })(this);
