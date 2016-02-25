/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Center the image at this location.

var centerX = -0.743643887037158704752191506114774;
var centerY = 0.131825904205311970493132056385139;

// Pixel grid.  (0,0) correspons to (bottom,left).

var height = 480;
var width  = 640;

// Shared memory size: ABGR values for the pixel grid, two grids.

var gridInts = height * width;
var gridBytes = gridInts * 4;
var memSize = gridBytes * 2;

// Offsets within the memory of the two grids.

var offset = [0, gridBytes];

// Maximum iterations per pixel.

var MAXIT = 200;

// Pixel colors, represented as ABGR with A=255.

var colors = [0xFFFF0700, 0xFF2a2aa5, 0xFFFFff00, 0xFFa19eff,
              0xFF00eefd, 0xFF008000, 0xFFFAFEFE, 0xFF00FFBF];

// Pixel color when we pass MAXIT.

var black = 0xFF000000;
