const numWorkers = 6;

const shadows = true;		// Compute object shadows
const reflection = true;	// Compute object reflections
const reflection_depth = 2;

const debug = false;		// Progress printout, may confuse the consumer

const TRIANGLE = 0;
const SPHERE = 1;

function DL3(x, y, z) { return {x:x, y:y, z:z}; }

function add(a, b) { return DL3(a.x+b.x, a.y+b.y, a.z+b.z); }
function sub(a, b) { return DL3(a.x-b.x, a.y-b.y, a.z-b.z); }
function muli(a, c) { return DL3(a.x*c, a.y*c, a.z*c); }
function divi(a, c) { return DL3(a.x/c, a.y/c, a.z/c); }
function neg(a) { return DL3(-a.x, -a.y, -a.z); }
function length(a) { return Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z); }
function normalize(a) { var d = length(a); return DL3(a.x/d, a.y/d, a.z/d); }
function cross(a, b) { return DL3(a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x); }
function dot(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }

const height = 600;
const width = 800;

const g_left = -2;
const g_right = 2;
const g_top = 1.5;
const g_bottom = -1.5;

// Shared memory layout
//
// FMMAX Float64 values (scene graph object contents)
// OMMAX Int32 values (scene graph object triplets)
// BMNUM Int32 values (bitmap values)
// BANUM Int32 values (barrier storage)
// IXNUM Int32 values (pool-next and pool-size values)
// PONUM Int32 values (ylow, xlow, yhigh, xhigh quads for the work pool)

const FMMAX = 1024; 		// Floats in 'fm'
const FMSIZ = FMMAX*8;
const OMMAX = 1000;		// Ints in 'om'
const OMSIZ = OMMAX*4;
const BMNUM = height*width;	// Ints in the bitmap
const BMSIZ = height*width*4;
const BANUM = MasterBarrier.NUMLOCS; // Ints for the barrier
const BASIZ = BANUM*4;
const IXNUM = 2;
const IXSIZ = IXNUM*4;
const POY = 5;			// POY cells along y
const POX = 5;			// POX cells along x
const PONUM = POX*POY*4;	// POYxPOX grid, 4 values per item
const POSIZ = PONUM*4;

const FMLOC = 0;
const OMLOC = FMLOC + FMSIZ;
const BMLOC = OMLOC + OMSIZ;
const BALOC = BMLOC + BMSIZ;
const IXLOC = BALOC + BASIZ;
const POLOC = IXLOC + IXSIZ;

const SharedBytes = FMSIZ + OMSIZ + BMSIZ + BASIZ + IXSIZ + POSIZ;

const ITER = 1;			// Number of iterations; later iterations are usually faster than the first
