// Ray tracer, largely out of Shirley & Marschner 3rd Ed.
// Traces a scene and writes to a canvas.
//
// lth@acm.org / lhansen@mozilla.com, winter 2012 and later.

// Shared memory - this holds all the arrays.

const sab = new SharedArrayBuffer(SharedBytes);

// Each object in 'om' is a triple of integers: (tag, material-offset, data-offset)
//
// Materials and data are in 'fm'.
//
// Materials are laid out as diffuse*3, specular*3, shininess, ambient*3, mirror.
// Spheres are laid out as center*3, radius.
// Triangles are laid out as v1*3, v2*3, v3*3.
//
// Each triple is in (x,y,z) order.

const fm = new Float64Array(sab, FMLOC, FMMAX);	// Scene graph objects are allocated here
const om = new Int32Array(sab, OMLOC, OMMAX);	// List of object triples

var fm_ = 0;
var om_ = 3;			        // 0 is reserved for 'no data'

function falloc(...vals) {
    var p = fm_;
    for ( var v of vals )
	fm[fm_++] = v;
    return p;
}

function oalloc(tag, material, data) {
    var p = om_;
    om[om_++] = tag;
    om[om_++] = material;
    om[om_++] = data;
    return p;
}

var eye;        // Eye coordinates
var light;      // Light source coordinates
var background; // Background color

function write_Material(diffuse, specular, shininess, ambient, mirror) {
    return falloc(diffuse.x, diffuse.y, diffuse.z,
		  specular.x, specular.y, specular.z,
		  shininess,
		  ambient.x, ambient.y, ambient.z,
		  mirror);
}

function write_Sphere(material, center, radius) {
    var p = falloc(center.x, center.y, center.z, radius);
    oalloc(SPHERE, material, p);
}

function write_Triangle(material, v1, v2, v3) {
    var p = falloc(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
    oalloc(TRIANGLE, material, p);
}

const bits = new Int32Array(sab, BMLOC, BMNUM);
const initial = DL3(152.0/256.0, 251.0/256.0, 152.0/256.0); // Pale green
const initialc = (255<<24)|((255*initial.z)<<16)|((255*initial.y)<<8)|(255*initial.x)
for ( var i=0, l=width*height ; i < l ; i++ )
    bits[i] = initialc;

var numWorkers;			// Set by main
var barrier = null;		// Set by main

const ix = new Int32Array(sab, IXLOC, IXNUM);
const pool = new Int32Array(sab, POLOC, PONUM);

var setup = false;
var workers = [];

function main(cores) {
    if (!setup) {
	// Initialize fm, om, om_, eye, light, background
	setStage();

	// Initialize work pool
	// Simplification: Assume both height and width are divisible by POX and POY
	var yslice = height/POY;
	var xslice = width/POX;
	for ( var y=0 ; y < POY ; y++ ) {
	    for ( var x=0 ; x < POX ; x++ ) {
		pool[y*POX*4+x*4+0] = yslice*y;
		pool[y*POX*4+x*4+1] = xslice*x;
		pool[y*POX*4+x*4+2] = yslice*(y+1);
		pool[y*POX*4+x*4+3] = xslice*(x+1);
	    }
	}

	setup = true;
    }

    Atomics.store(ix, 0, 0);
    Atomics.store(ix, 1, POY*POX);
    numWorkers = cores;
    barrier = new MasterBarrier(1337, numWorkers, new Int32Array(sab, BALOC, BANUM), 0, () => barrierTrigger());
    timeBefore = null
    it = 0;

    // Create and start workers, they will enter the barrier when ready
    for ( var i=0 ; i < numWorkers ; i++ ) {
	if (i < workers.length)
	    var w = workers[i];
	else {
	    var w = new Worker("ray4-worker.js"); 
	    w.onmessage =
		function (ev) {
		    if (ev.data instanceof Array && ev.data.length == 2 && ev.data[0] == "MasterBarrier.dispatch")
			MasterBarrier.dispatch(ev.data[1]);
		    else
			console.log(ev.data);
		}
	    workers.push(w);
	}
	w.postMessage([sab, om_, eye, light, background], [sab]);
    }
}

// Called when all workers are in the barrier
var timeBefore;
var it = 0;
function barrierTrigger() {
    if (it++ < ITER) {
	if (timeBefore)
	    showTime();
    }
    else
	showResult();
    timeBefore = new Date();
    Atomics.store(ix, 0, 0);
    barrier.release();
}

function showResult() {
    showTime();

    var mycanvas = document.getElementById("mycanvas");
    var cx = mycanvas.getContext('2d');
    var id  = cx.createImageData(width, height);
    id.data.set(new Uint8Array(sab, BMLOC, BMSIZ));
    cx.putImageData( id, 0, 0 );
}

function showTime() {
    const timeAfter = new Date();
    console.log("Number of workers: " + numWorkers + "  Compute time: " + (timeAfter - timeBefore) + "ms");
}

function setStage() {

    const zzz = DL3(0,0,0);

    // Colors: http://kb.iu.edu/data/aetf.html

    const paleGreen = DL3(152.0/256.0, 251.0/256.0, 152.0/256.0);
    const darkGray = DL3(169.0/256.0, 169.0/256.0, 169.0/256.0);
    const yellow = DL3(1.0, 1.0, 0.0);
    const red = DL3(1.0, 0.0, 0.0);
    const blue = DL3(0.0, 0.0, 1.0);

    // Not restricted to a rectangle, actually
    function rectangle(m, v1, v2, v3, v4) {
	write_Triangle(m, v1, v2, v3);
	write_Triangle(m, v1, v3, v4);
    }

    // Vertices are for front and back faces, both counterclockwise as seen
    // from the outside.
    // Not restricted to a cube, actually.
    function cube(m, v1, v2, v3, v4, v5, v6, v7, v8) {
	rectangle(m, v1, v2, v3, v4);  // front
	rectangle(m, v2, v5, v8, v3);  // right
	rectangle(m, v6, v1, v4, v7);  // left
	rectangle(m, v5, v5, v7, v8);  // back
	rectangle(m, v4, v3, v8, v7);  // top
	rectangle(m, v6, v5, v2, v1);  // bottom
    }

    const m1 = write_Material(DL3(0.1, 0.2, 0.2), DL3(0.3, 0.6, 0.6), 10, DL3(0.05, 0.1, 0.1), 0);
    const m2 = write_Material(DL3(0.3, 0.3, 0.2), DL3(0.6, 0.6, 0.4), 10, DL3(0.1,0.1,0.05),   0);
    const m3 = write_Material(DL3(0.1,  0,  0), DL3(0.8,0,0),     10, DL3(0.1,0,0),     0);
    const m4 = write_Material(muli(darkGray,0.4), muli(darkGray,0.3), 100, muli(darkGray,0.3), 0.5);
    const m5 = write_Material(muli(paleGreen,0.4), muli(paleGreen,0.4), 10, muli(paleGreen,0.2), 1.0);
    const m6 = write_Material(muli(yellow,0.6), zzz, 0, muli(yellow,0.4), 0);
    const m7 = write_Material(muli(red,0.6), zzz, 0, muli(red,0.4), 0);
    const m8 = write_Material(muli(blue,0.6), zzz, 0, muli(blue,0.4), 0);

    write_Sphere(m1, DL3(-1, 1, -9), 1);
    write_Sphere(m2, DL3(1.5, 1, 0), 0.75);
    write_Triangle(m1, DL3(-1,0,0.75), DL3(-0.75,0,0), DL3(-0.75,1.5,0));
    write_Triangle(m3, DL3(-2,0,0), DL3(-0.5,0,0), DL3(-0.5,2,0));
    rectangle(m4, DL3(-5,0,5), DL3(5,0,5), DL3(5,0,-40), DL3(-5,0,-40));
    cube(m5, DL3(1, 1.5, 1.5), DL3(1.5, 1.5, 1.25), DL3(1.5, 1.75, 1.25), DL3(1, 1.75, 1.5),
	 DL3(1.5, 1.5, 0.5), DL3(1, 1.5, 0.75), DL3(1, 1.75, 0.75), DL3(1.5, 1.75, 0.5));
    for ( var i=0 ; i < 30 ; i++ )
	write_Sphere(m6, DL3((-0.6+(i*0.2)), (0.075+(i*0.05)), (1.5-(i*Math.cos(i/30.0)*0.5))), 0.075);
    for ( var i=0 ; i < 60 ; i++ )
	write_Sphere(m7, DL3((1+0.3*Math.sin(i*(3.14/16))), (0.075+(i*0.025)), (1+0.3*Math.cos(i*(3.14/16)))), 0.025);
    for ( var i=0 ; i < 60 ; i++ )
	write_Sphere(m8, DL3((1+0.3*Math.sin(i*(3.14/16))), (0.075+((i+8)*0.025)), (1+0.3*Math.cos(i*(3.14/16)))), 0.025);

    eye        = DL3(0.5, 0.75, 5);
    light      = DL3(g_left-1, g_top, 2);
    background = DL3(25.0/256.0,25.0/256.0,112.0/256.0);
}
