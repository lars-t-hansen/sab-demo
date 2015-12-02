var numWorkers = 4;
var iab = new Int32Array(new SharedArrayBuffer(1024*100*Int32Array.BYTES_PER_ELEMENT));
var lockLoc = 0;
var flagLoc = lockLoc + MasterLock.NUMLOCS;
var compLoc = flagLoc + 1;
var compSiz = iab.length - iab.compLoc;
var l = new MasterLock(iab, 0);

for ( var i=0 ; i < numWorkers ; i++ ) {
    var w = new Worker("test-lock-worker.js");
    w.postMessage(["start", iab.buffer, lockLoc, flagLoc, compLoc, compSiz], [iab.buffer]);
}

setTimeout(function () {
    flagLoc = -1;		// Start the workers, who are busy-waiting
    performWork();
}, 0);

var nextIndex = 0;
var a = 3;
var b = -4;
var c = 2;
function performWork() {
    // This is a typical optimized critical section loop: the while
    // loop tests the flag and will perform another iteration if
    // the lock was taken synchronously; the callback will restart the
    // loop at the end of the critical section if the lock had to be
    // taken by a callback.
    while (nextIndex < compSiz &&
	   l.asyncLock(function (sync) {
	       // Increment by 1
	       iab[compLoc+nextIndex]+=a;
	       iab[compLoc+nextIndex]+=b;
	       iab[compLoc+nextIndex]+=c;
	       nextIndex++;
	       if (!sync)
		   setTimeout(performWork, 0);
	   }))
    {
	// Body must be empty
    }
    if (nextIndex == compSiz) {
	// Now wait until the workers are all idle, there needs to be a counter loc
	// Then check all the values
    }
}
