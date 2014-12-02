// Shared-memory memory management: a very basic library for bump allocation.
// lhansen@mozilla.com / 1 December 2014.
//
// Usage:
//
//  - Create a malloc on a piece of memory with "new SharedBumpAlloc()".
//  - There will be accessors for SharedTypedArrays of every type, eg,
//    m.Int32Array gets you the SharedInt32Array mapped onto the memory.
//  - There will be allocators for ranges of elements within the various
//    typed arrays, eg, m.allocInt32(n) will allocate n consecutive 
//    Int32 values.  The value returned from the allocator is an index
//    within m.Int32Array.  If the value returned is 0 then the allocation
//    failed.
//  - There is no facility for freeing individual objects.
//  - Use the "mark" method to obtain the current allocation pointer and
//    the "release" method to reset the allocation pointer to a captured
//    pointer.  The pointer is an integer.  Do not manufacture these
//    integers yourself.  Allocation is linear in the heap.
//  - Anyone can allocate, mark, and reset.  Watch your step: marking and
//    resetting are unsynchronized operations that are best done by the
//    master when it knows the workers are quiescent.

// Create a memory manager on a piece of shared memory.
//
// "sab" is a SharedArrayBuffer.
// "byteOffset" is an offset within sab where the available memory starts.
//    This will be rounded up by the memmgr to a useful boundary.
// "bytesAvail" is the number of bytes in sab starting at byteOffset
//    available exclusively to the memmgr.  This number will be rounded
//    down by the memmgr to a useful boundary.
// "who" is a string, either "master" or "worker".
//
// This will use a few words of shared memory for its own data
// structures; this will be no more than 4KB.
//
// There is no per-object overhead.
//
// The construction of the SharedBumpAlloc on the master must be complete
// before the construction is started on the workers.

const _METAWORDS = 2;		// Must be even
const _TOP = 0;
const _LIMIT = 1;

function SharedBumpAlloc(sab, byteOffset, bytesAvail, who) {
    var nByteOffset = (byteOffset + 3) & ~3;
    var baseOffset = nByteOffset + _METAWORDS*4;
    var numBytes = ((byteOffset + bytesAvail) & ~7) - baseOffset;

    // Our heap layout:
    //
    //  - allocation pointer
    //  - limit pointer

    this._meta = new SharedInt32Array(sab, nByteOffset, _METAWORDS);

    var top = baseOffset + 8;   // Make '0' an illegal address without exposing metadata
    var limit = baseOffset + numBytes;

    this._meta[_TOP] = top;
    this._meta[_LIMIT] = limit;

    this._limit = limit;	// Cache this, it doesn't change

    this._int8Array = new SharedInt8Array(sab, baseOffset, numBytes);
    this._uint8Array = new SharedUint8Array(sab, baseOffset, numBytes);
    this._int16Array = new SharedInt16Array(sab, baseOffset, numBytes >> 1);
    this._uint16Array = new SharedUint16Array(sab, baseOffset, numBytes >> 1);
    this._int32Array = new SharedInt32Array(sab, baseOffset, numBytes >> 2);
    this._uint32Array = new SharedUint32Array(sab, baseOffset, numBytes >> 2);
    this._float32Array = new SharedFloat32Array(sab, baseOffset, numBytes >> 2);
    this._float64Array = new SharedFloat64Array(sab, baseOffset, numBytes >> 3);
}

// The SharedBumpAlloc object has the following accessors:
//
//   Int8Array
//   Uint8Array
//   Int16Array
//   Uint16Array
//   Int32Array
//   Uint32Array
//   Float32Array
//   Float64Array
//
// The arrays returned from these all overlap completely (but the
// length values will only be the same for same-basetype arrays).
    
SharedBumpAlloc.prototype.defineProperties({
    Int8Array: { get: function () { return this._int8Array; } },
    Uint8Array: { get: function () { return this._uint8Array; } },
    Int16Array: { get: function () { return this._int16Array; } },
    Uint16Array: { get: function () { return this._uint16Array; } },
    Int32Array: { get: function () { return this._int32Array; } },
    Uint32Array: { get: function () { return this._uint32Array; } },
    Float32Array: { get: function () { return this._float32Array; } },
    Float64Array: { get: function () { return this._float64Array; } } });
    
// PRIVATE.  Returns an integer byte offset within the sab for nbytes
// of storage, aligned on an 8-byte boundary.  Returns 0 on allocation
// error.

SharedBumpAlloc.prototype._allocBytes =
    function (nbytes) {
	const meta = this._meta;
	const limit = this.limit;
	nbytes = (nbytes + 7) & ~7;
	do {
	    var p = meta[_TOP];
	    var newtop = p+nbytes;
	    if (newtop > limit)
		return 0;
	} while (Atomic.compareExchange(meta, _TOP, p, newtop) != p);
	return p;
    };

// Returns an index within Int32Array / Uint32Array, or 0 on memory-full.

SharedBumpAlloc.prototype.allocInt8 =
    function (nelements) {
	return this._allocBytes(nelements);
    };

SharedBumpAlloc.prototype.allocUint8 =
    SharedBumpAlloc.prototype.allocInt8;

SharedBumpAlloc.prototype.allocInt16 =
    function (nelements) {
	return this._allocBytes(nelements*2) >> 1;
    };

SharedBumpAlloc.prototype.allocUint16 =
    SharedBumpAlloc.prototype.allocInt16;

SharedBumpAlloc.prototype.allocInt32 =
    function (nelements) {
	return this._allocBytes(nelements*4) >> 2;
    };

SharedBumpAlloc.prototype.allocUint32 =
    SharedBumpAlloc.prototype.allocInt32;

SharedBumpAlloc.prototype.allocFloat32 =
    SharedBumpAlloc.prototype.allocInt32;

SharedBumpAlloc.prototype.allocFloat64 =
    function (nelements) {
	return this._allocBytes(nelements*8) >> 3;
    };

SharedBumpAlloc.prototype.mark =
    function () {
	return this._meta[_TOP];
    };

SharedBumpAlloc.prototype.reset =
    function (p) {
	const meta = this._meta;
	// TODO: some error checks on p
	Atomics.store(meta, _TOP, p);
    };

