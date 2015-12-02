// 'filename' should be defined by a previously loaded script.

if (!this.filename) {
    alert("No file name defined");
    throw new Error("Aborted");
}

var numWorkers = 4;
var workers = [];
var finished = 0;
var g, h;
var image = new PGM();

initWorkers();
image.loadFromURL(filename,
		  convolveImage,
		  () => alert(filename + ": Not found"));

function convolveImage() {
    var height = image.height;
    var width = image.width;

    g = new Uint8Array(new SharedArrayBuffer(height*width));
    h = new Uint8Array(new SharedArrayBuffer(height*width));

    for ( var w of workers )
	w.postMessage(["data", g.buffer, h.buffer], [g.buffer, h.buffer]);

    g.set(image.data);

    var sliceHeight = Math.floor(height / numWorkers);
    var extra = height % numWorkers;
    var lo = 0;
    for ( var w of workers ) {
	var hi = lo + sliceHeight;
	if (extra) {
	    hi++;
	    extra--;
	}
	w.postMessage(["compute", height, width, lo, hi]);
	lo = hi;
    }
}

function initWorkers() {
    for ( var i=0 ; i < numWorkers ; i++ ) {
	var w = new Worker("convolve-worker.js");
	// Workers post messages of the form [tag, payload...] where tag
	// is always a string.
	w.onmessage = 
	    function (ev) {
		switch (ev.data[0]) {
		case "done":
		    if (++finished == numWorkers)
			displayResult();
		    break;
		default:
		    console.log(ev.data);
		    break;
		}
	    };
	// Get the workers warmed up.
	w.postMessage(["start"]);
	workers.push(w);
    }
}

function displayResult() {
    canvasSetFromGrayscale(document.getElementById("mycanvas"),
			   h,
			   image.height,
			   image.width);
}
