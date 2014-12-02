load("bump-alloc.js");

var nbytes = 1024;
var n = nbytes + SharedBumpAlloc.NUMBYTES;
var sab = new SharedArrayBuffer(n);

var sba = new SharedBumpAlloc(sab, 0, n, "master");

// Sanity
assertEq(sba.Int8Array.length >= 1024, true);
assertEq(sba.Float64Array.length >= 128, true);

var bottom = sba.mark();

//////////////////////////////////////////////////////////////////////
// White-box tests.

// The heap limit is where we set it, plus page zero
assertEq(sba._limit, _SBA_PAGEZEROSZ+nbytes);

// The first object is at the heap base.
var v = sba.allocInt32(1);
assertEq(v > 0, true);
assertEq(v, _SBA_PAGEZEROSZ >>> 2);

// End white-box
//////////////////////////////////////////////////////////////////////

// No padding
var first = sba.mark();
sba.allocInt32(10);
var next = sba.mark();
assertEq(first + 40, next);

// Mark/Release works as expected
sba.release(first);
assertEq(first, sba.mark());

// Allocating arrays works too
var a = sba.allocInt32Array(10);
assertEq(a.length, 10);

// No padding, and not overlapping
var b = sba.allocInt32Array(10);
assertEq(a.byteOffset + 40, b.byteOffset);

// Precise allocation semantics
sba.release(bottom);
for ( var i=0 ; i < nbytes/8 ; i++ )
    assertEq(sba.allocInt8(1) != 0, true);
assertEq(sba.allocInt8(1), 0);

sba.release(bottom);
for ( var i=0 ; i < nbytes/8 ; i++ )
    assertEq(sba.allocInt16(1) != 0, true);
assertEq(sba.allocInt16(1), 0);

sba.release(bottom);
for ( var i=0 ; i < nbytes/8 ; i++ )
    assertEq(sba.allocInt32(1) != 0, true);
assertEq(sba.allocInt32(1), 0);

sba.release(bottom);
for ( var i=0 ; i < nbytes/8 ; i++ )
    assertEq(sba.allocFloat32(1) != 0, true);
assertEq(sba.allocFloat32(1), 0);

sba.release(bottom);
for ( var i=0 ; i < nbytes/8 ; i++ )
    assertEq(sba.allocFloat64(1) != 0, true);
assertEq(sba.allocFloat64(1), 0);

