// 'filename' should be defined by a previously loaded script.

if (!this.filename) {
    alert("No file name defined");
    throw new Error("Aborted");
}

var numWorkers = 4;
var input, output;
var image = new PGM();

Multicore.init(numWorkers, "convolve-worker.js", loadImage);

function loadImage() {
    image.loadFromURL(filename,
		      convolveImage,
		      () => alert(filename + ": Not found"));
}

function convolveImage() {
    var h = image.height;
    var w = image.width;
    input = new SharedUint8Array(h*w);
    input.set(image.data);
    output = new SharedUint8Array(h*w);
    Multicore.build(displayResult, "convolve", output, [[0,h], [0,w]], input, h, w);
}

function displayResult() {
    canvasSetFromGrayscale(document.getElementById("mycanvas"),
			   output,
			   image.height,
			   image.width);
}
