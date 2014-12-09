sab-demo
========

Abstractions and demos for SharedArrayBuffer, SharedTypedArray, and Atomics.

In util/ are several useful abstractions:

* asymmetric-barrier.js is a worker/main thread barrier synchronization that does not require the main thread to block
* parinvoke-master.js and parinvoke-worker.js comprise a framework for data-parallel computation
* bump-alloc.js is a simple allocator that takes some drudgery out of allocating memory out of a SharedArrayBuffer
* worker-only-barrier.js is a worker-only barrier (the main thread does not participate)

The demos all have READMEs.
