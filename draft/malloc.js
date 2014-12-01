// Shared-memory memory management: a basic library.
// 2014-11-28 / lhansen@mozilla.com

// Create a memory manager on a piece of shared memory.
//
// "sab" is a SharedArrayBuffer.
// "byteOffset" is an offset within sab where the available memory starts.
//    This will be rounded up by the memmgr to a useful boundary.
// "bytesAvail" is the number of bytes in sab starting at byteOffset
//    available to the memmgr.  This number will be rounded down to
//    by the memmgr to a useful boundary.
// "who" is a string, either "master" or "worker".
//
// This will use a few words of shared memory for its own data
// structures, and there may be a per-object overhead.
//
// The construction of the SharedMalloc on the master must be complete
// before the construction is started on the workers.

function SharedMalloc(sab, byteOffset, bytesAvail, who) {
    const METAWORDS = 4;		// Make it even

    var nByteOffset = (byteOffset + 3) & ~3;
    var baseOffset = nByteOffset + METAWORDS*4;
    var numBytes = ((byteOffset + bytesAvail) & ~7) - baseOffset;

    // Our heap layout:
    //
    //  - wilderness pointer
    //  - limit pointer
    //  - free list pointer
    //
    // Object layout (4-byte words):
    //
    //  - number of bytes including header
    //  - next-object pointer
    //
    // Free list is address ordered with eager coalescing (tricky in shared memory)

    this._meta = new SharedInt32Array(sab, nByteOffset, METAWORDS);

    meta[WILDERNESS] = baseOffset + 8; // Make '0' an illegal address
    meta[LIMIT] = baseOffset + numBytes;
    meta[FREELIST] = 0;

    this._int8Array = new SharedInt8Array(sab, baseOffset, numBytes);
    this._uint8Array = new SharedUint8Array(sab, baseOffset, numBytes);
    this._int16Array = new SharedInt16Array(sab, baseOffset, numBytes >> 1);
    this._uint16Array = new SharedUint16Array(sab, baseOffset, numBytes >> 1);
    this._int32Array = new SharedInt32Array(sab, baseOffset, numBytes >> 2);
    this._uint32Array = new SharedUint32Array(sab, baseOffset, numBytes >> 2);
    this._float32Array = new SharedFloat32Array(sab, baseOffset, numBytes >> 2);
    this._float64Array = new SharedFloat64Array(sab, baseOffset, numBytes >> 3);
}

// The SharedMalloc will have accessors called the following:
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
// These all alias and overlap completely.  They have different
// lengths.  They may or may not start at byteOffset within sab.
    
// Returns an integer byte offset within the sab for nbytes of
// storage, aligned on an 8-byte boundary.  Returns 0 on allocation
// error.

SharedMalloc.prototype.allocBytes =
    function (nbytes) {
	// Very basic: 8 bytes of header, first integer word is byte size,
	// second word is the next pointer on the free list or -1 once
	// allocated. 
	nbytes = (nbytes + 15) & ~7; // Add 8 and round up to 8
	...;
    };

SharedMalloc.prototype.free =
    function (pointer) {
	// get the size
	// add to the correct free list
    };

// Returns an index within Int32Array / Uint32Array, or 0 on memory-full.

SharedMalloc.prototype.allocInt32 =
    function (nelements) {
	return this.allocBytes(nelements*4) >> 2;
    };

