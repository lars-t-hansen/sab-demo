var numWorkers = 4;
var workers = [];
var g, h;

initWorkers();

var image = new PGM();
var finished = 0;

image.loadFromURL("cat.pgm", convolveImage, () => alert("Not found"));

function convolveImage() {
    console.log("Got to convolveImage");
    var height = image.height;
    var width = image.width;

    g = new SharedUint8Array(height*width);
    h = new SharedUint8Array(height*width);

    for ( var w of workers )
	w.postMessage(["data", g.buffer, h.buffer], [g.buffer, h.buffer]);

    g.set(image.data);

    // Exclude the border pixels from the convolution, for simplicity.
    var sliceHeight = Math.floor((height-2) / numWorkers);
    for ( var i=0 ; i < numWorkers ; i++ )
	workers[i].postMessage(["compute",
				width,
				1+i*sliceHeight,
				i==numWorkers-1 ? height-1 : 1+(i+1)*sliceHeight]);
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
