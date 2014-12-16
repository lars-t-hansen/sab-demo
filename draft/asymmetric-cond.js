// See cond-example.js for some motivating code.

function MasterCond(iab, offset) {
}

MasterCond.NUMLOCS = ...;

MasterCond.prototype.asyncLock =
    function (callback) {
	...;
    };

MasterCond.prototype.asyncWait =
    function (callback) {
	...;
    };


function WorkerCond(iab, offset) {
}

WorkerCond.prototype.lock =
    function () {
    };

WorkerCond.prototype.unlock =
    function () {
    };

WorkerCond.prototype.wait =
    function () {
    };

WorkerCond.prototype.wake =
    function () {
    };

WorkerCond.prototype.wakeAll =
    function () {
    };
