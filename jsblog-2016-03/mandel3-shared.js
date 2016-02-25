/* -*- indent-tabs-mode: nil -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Double_BYTES = 8;
var Int_BYTES = 4;

// Center the image at this location.

var centerX = -0.743643887037158704752191506114774;
var centerY = 0.131825904205311970493132056385139;

// Pixel grid, int32 values.  (0,0) correspons to (bottom,left).

var height = 480;
var width  = 640;

var Grid_BYTES = height * width * Int_BYTES;
var Grid_INTS  = Grid_BYTES / Int_BYTES;

// Convenient to have a ceiling on this, for data structure layout.

var MaxWorkers = 20;

// A datum representing a slice of work.
//
// struct Slice {
//   ybase: int32      // lowest index in grid slice
//   ylimit: int32     // 1+highest index in grid slice
// }

var Slice_BYTES  = Int_BYTES * 2;
var Slice_ybase  = 0;
var Slice_ylimit = 1;

var Slice_INTS   = Slice_BYTES / Int_BYTES;

// A datum representing for coordinating access to the slice set,
// and sleeping and waking
//
// struct Sync {
//   next: atomic int32               // next index in "slices" array
//   wait: atomic int32[MaxWorkers]   // locations to wait on when idle
// }

var Sync_BYTES         = Int_BYTES * (1 + MaxWorkers);
var Sync_next          = 0;
var Sync_wait          = 1;

var Sync_INTS          = Sync_BYTES / Int_BYTES;

// Memory layout:
//
//  magnification : float64
//  sync          : Sync
//  slices        : Slice[NumSlices]
//  grid          : int32[Grid_INTS];

var NumSlices = 25;             // Good for load balancing

// Byte offsets in memory.

var magnification_OFFSET = 0;
var sync_OFFSET          = magnification_OFFSET + Double_BYTES;
var slices_OFFSET        = sync_OFFSET + Sync_BYTES;
var grid_OFFSET          = slices_OFFSET + NumSlices * Slice_BYTES;
var END_OFFSET           = grid_OFFSET + Grid_BYTES;

// Sizes

var memSize = END_OFFSET;

// Maximum iterations per pixel.

var MAXIT = 200;

// Pixel colors, represented as ABGR with A=255.

var colors = [0xFFFF0700, 0xFF2a2aa5, 0xFFFFff00, 0xFFa19eff,
              0xFF00eefd, 0xFF008000, 0xFFFAFEFE, 0xFF00FFBF];

// Pixel color when we pass MAXIT.

var black = 0xFF000000;
