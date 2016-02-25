/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Generic mandelbrot computation.  Computes ABGR values into an
// Int32Array grid.

// Maximum iterations per pixel.

var MAXIT = 200;

// Pixel colors, represented as ABGR with A=255.

var colors = [0xFFFF0700, 0xFF2a2aa5, 0xFFFFff00, 0xFFa19eff,
              0xFF00eefd, 0xFF008000, 0xFFFAFEFE, 0xFF00FFBF];

// Pixel color when we pass MAXIT.

var black = 0xFF000000;

// Compute ABGR pixel values for a strip of an image.
//
// The image has dimensions "height" and "width".
// The image is centered at ("centerY", "centerX").
// The pixel strip to compute is for "ybase" <= y < "ylimit".
// The "magnification" (zoom level) is a floating value > 0.
// The pixels are stored in the "grid" array, which is an
//   Int32Array of length height*width.
//
// height, width, centerY, and centerX are free here -- they are
// constant -- but could be passed as parameters.

function mandelbrot(grid, ybase, ylimit, magnification) {
    const top = centerY + 1/magnification;
    const bottom = centerY - 1/magnification;
    const left = centerX - width/height*(1/magnification);
    const right = centerX + width/height*(1/magnification);
    for ( var Py=ybase ; Py < ylimit ; Py++ ) {
        for ( var Px=0 ; Px < width ; Px++ ) {
            var x0 = left+(Px/width)*(right-left);
            var y0 = bottom+(Py/height)*(top-bottom);
            var x = 0.0;
            var y = 0.0;
            var it = 0;
            while (x*x + y*y < 4.0 && it < MAXIT) {
                var xtemp = x*x - y*y + x0;
                y = 2.0*x*y + y0;
                x = xtemp;
                it++;
            }
            grid[Py*width+Px] = it == MAXIT ? black : colors[it & 7];
        }
    }
}
