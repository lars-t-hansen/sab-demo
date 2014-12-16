// Master/Worker task framework
// Worker side.
//
// There is one global queue.  Nominally the master inserts work into
// the queue and the workers extract it.  A worker always completes
// one item at a time, evaluation is never nested.

const TQueue = {
    init: _TQueue_init,
    addFunction: _TQueue_addFunction,
    msg: _TQueue_msg,
    _ready: false
};

