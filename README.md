sab-demo
========

Abstractions and demos for SharedArrayBuffer, SharedTypedArray, and Atomics.

In util/ are several useful abstractions:

* asymmetric-barrier.js is a worker/main thread barrier synchronization that does not require the main thread to block
* multicore-master.js and multicore-worker.js comprise the "Multicore" framework for data-parallel computation
* bump-alloc.js is a simple allocator that takes some drudgery out of allocating memory out of a SharedArrayBuffer
* worker-only-barrier.js is a worker-only barrier (the main thread does not participate)

The demos all have READMEs.

The parallel demos all take a '?workers=n' URL parameter to override the default number of workers (currently 4).
