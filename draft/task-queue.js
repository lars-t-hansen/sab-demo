// Master/Worker task framework
// Master side.
//
// There is one global queue.  Nominally the master inserts work into
// the queue and the workers extract it.  A worker always completes
// one item at a time, evaluation is never nested.
//
// We want for the workers to be able to insert work too, though this
// risks deadlock.  (Suppose there is one worker and the queue has
// capacity 1.  If the worker tries to insert 2 items synchronously it
// will block, and it will not be around to process the first item.)

const TQueue = {
    init: _TQueue_init,
    Task: _TQueue_Task,
    TaskGroup: _TQueue_TaskGroup,
    add: _TQueue_add,
    addEmptyHandler: _TQueue_addEmptyHandler,
    addNonFullHandler: _TQueue_addNonFullHandler,
    _ready: false
};

function _TQueue_init(numWorkers, url, readyCallback) {
    if (TQueue._ready)
	throw new Error("Already initialized");
    ...;
};

// Constructor for a Task.  The arguments are marshalled into an
// internal data structure and the inputs may be modified after the
// constructor returns.

function Task(fn, ...args) {
    // marshal the arguments
    // Total number of words needed for the task, not including management overhead.
    this.requirement = numWords;
}

// Constructor for a group of tasks.  The tasks are retained by
// reference.

function TaskGroup(...tasks) {
    this.requirement = 0;
    this.count = tasks.length;
    this.tasks = tasks;
    for ( var t of tasks ) {
	if (!(t instanceof Task) && !(t instanceof TaskGroup))
	    throw new Error("Invalid task: " + t);
	this.requirement += t.requirement;
    }
}

// callback can be null, but if it is not then it is invoked once the
// task has completed.
//
// t is a Task or TaskGroup instance.
//
// Returns true if the task could be added, false if the task queue
// was full and the call has to be retried.
//
// Throws an exception if a build or broadcast is in-flight.
//
// A task can be added several times, and is executed as many times as
// it is added to the queue.  Several copies of the task can be
// pending at any one time.  The different copies are not guaranteed
// to be evaluated on the same worker.
//
// Tasks can be added at any time but none will be dispatched as long
// as a build or broadcast is in flight.  Conversely, once tasks are
// executing the task queue must be drained before a build or broadcast
// can be effected.
//
// NOTE, build is just an optimized taskgroup with automatic slicing
// of the output volume.
//
// NOTE, broadcast is just an optimized taskgroup with a specialized
// task.

function _TQueue_add(cb, t) {
    var needed = t.requirement + ...;
    var avail = ...;
    if (avail < needed) {
	// TODO: Register desire for callbacks somehow
	return false;
    }
    // push tasks on queue
    // if t is a group or we need a callback then push a barrier item on queue
    //   the barrier for a single callback is not a great idea
    // publish the new queue
    ...;
}

// Add event handlers to be notified when the task queue is empty and
// all pending callbacks have been dispatched.

function _TQueue_addEmptyHandler(cb) {
    ...;
}

// Add event handlers to be notified when there are slots available in
// the task queue.  A handler should be prepared for the possibility
// that the queue is still full when it is invoked.

function _TQueue_addNotFullHandler(cb) {
    ...;
}

