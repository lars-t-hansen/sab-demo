Atomics.compareExchangeFloat64 =
    function (fab, loc, oldval, newval) {
	var sl = Atomics.spinlockForObject(fab);
	sl.acquire();
	var x = fab[loc];
	if (x == oldval)
	    fab[loc] = newval;
	sl.release();
	return x;
    };