const numWorkers = 7;

const shadows = true;		// Compute object shadows
const reflection = true;	// Compute object reflections
const reflection_depth = 2;

const height = 600;
const width = 800;

const g_left = -2;
const g_right = 2;
const g_top = 1.5;
const g_bottom = -1.5;

const eye = { x: 0.5, y: 0.75, z: 5 };
const light = { x: g_left-1, y: g_top, z: 2 };

var pixels;
var start_time, end_time;

var frames = 1;			// Set to 1 for a single frame

function main() {
    pixels = new SharedInt32Array(height*width);
    Multicore.init(numWorkers, "ray-worker.js", doSetup);
}

function doSetup() {
    Multicore.broadcast(doRaytrace1, "setupScene");
}

function doRaytrace1() {
    Multicore.broadcast(doRaytrace2, "setupParameters", 
			height, width,
			g_left, g_right, g_top, g_bottom,
			shadows ? 1 : 0, reflection ? 1 : 0, reflection_depth,
			eye.x, eye.y, eye.z,
			light.x, light.y, light.z);
}

function doRaytrace2() {
    start_time = Date.now();
    Multicore.build(doDisplay, "trace", pixels, [[0, height], [0, width]]);
}

function doDisplay() {
    end_time = Date.now();
    if (--frames > 0) {
	updateViewForAnimation();
	doRaytrace1();
    }
    var mycanvas = document.getElementById("mycanvas");
    var cx = mycanvas.getContext('2d');
    var id  = cx.createImageData(width, height);
    id.data.set(new SharedUint8Array(pixels.buffer));
    cx.putImageData( id, 0, 0 );
    document.getElementById("mycaption").innerHTML = numWorkers + " workers, time=" + (end_time - start_time) + "ms";
}

function updateViewForAnimation() {
    // Just manipulating z creates a bizarre fisheye effect.
    eye.z -= 0.25;
}
