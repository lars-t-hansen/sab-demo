// 'filename' should be defined by a previously loaded script.

if (!this.filename) {
    alert("No file name defined");
    throw new Error("Aborted");
}

var input, output;
var image = new PGM();
var time_before;

Multicore.init(numWorkers, "convolve-worker.js", loadImage);

function loadImage() {
    image.loadFromURL(filename,
		      convolveImage,
		      () => alert(filename + ": Not found"));
}

function convolveImage() {
    var h = image.height;
    var w = image.width;
    input = new Uint8Array(new SharedArrayBuffer(h*w));
    input.set(image.data);
    output = new Uint8Array(new SharedArrayBuffer(h*w));
    time_before = Date.now();
    Multicore.build(displayResult, "convolve", output, [[0,h], [0,w]], input, h, w);
}

function displayResult() {
    var time_after = Date.now();
    canvasSetFromGrayscale(document.getElementById("mycanvas"),
			   output,
			   image.height,
			   image.width);
    document.getElementById("myresults").innerHTML = "Number of workers=" + numWorkers + "; time=" + (time_after - time_before) + "ms";
}
