//////////////////////////////////////////////////////////////////////
//
// Single-producer/multiple-consumer with the master being the
// producer: essentially a work distribution mechanism.
//
// The main issue here might be that the lock is baked into the
// condition variable, which pretty much precludes having multiple
// signal types attached to a critical section.  That seems like a
// weakness, though for simple use cases it's not.

// On the master.

// A bounded, circular integer queue
const QSIZ = 100;
const AVAIL = QSIZ;
const TAIL = AVAIL+1;
const HEAD = TAIL+1;
const QEXTRA = 3;
var q = new Int32Array(iab, qoffset, QSIZ+QEXTRA);

// A condition variable
var c = new MasterCond(iab, offset);

function produceItem() {
    var item = PRODUCE();
    var critical;

    c.asyncLock(critical = function () {
	var avail = q[AVAIL];
	if (avail == qsiz)
	    return c.asyncWait(critical);

	var tail = q[TAIL];
	q[tail] = item;
	q[TAIL] = (tail + 1) % 100;
	q[AVAIL] = avail+1;

	if (avail == 0)
	    c.wake();
    });
}

// The producer "loop".
setInterval(function () { 
    if (needMore())
	produceItem();
},0);


// On the worker

var c = new WorkerCond(iab, offset);

function consumeItem() {
    c.lock();
    var avail;
    while ((avail = q[AVAIL]) == 0)
	c.wait();
    var head = q[HEAD];
    var item = q[head];
    q[HEAD] = (head + 1) % QSIZ;
    q[AVAIL] = avail-1;
    if (avail == QSIZ)
        c.wake();
    c.unlock();
    return item;
}


//////////////////////////////////////////////////////////////////////
//
// Single-producer/single-consumer with the master being the consumer.
// Sort of bogus: we want multiple producers here.

