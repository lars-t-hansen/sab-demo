// Ray tracer, largely out of Shirley & Marschner 3rd Ed.
// Traces a scene and writes to a canvas.
//
// lth@acm.org / lhansen@mozilla.com, winter 2012 and later.

importScripts("../util/barrier.js");
importScripts("ray4-common.js");

const SENTINEL = 1e32;
const EPS = 0.00001;

var fm = null;
var om = null;
var om_ = 0;
var bits = null;
var barrier = null;
var eye = null;
var light = null;
var background = null;

function read3(p) {
    return DL3(fm[p], fm[p+1], fm[p+2]);
}

function read(p) {
    return fm[p];
}

function Material(diffuse, specular, shininess, ambient, mirror) {
    this.diffuse = diffuse;
    this.specular = specular;
    this.shininess = shininess;
    this.ambient = ambient;
    this.mirror = mirror;
}

function read_Material(d) {
    return new Material(read3(d), read3(d+3), read(d+6), read3(d+7), read(d+10));
}

function Scene() {}

// Cache the objects we'll reference.  This cache is actually large
// enough to accomodate all objects in the scene, and we'll need that
// because the program references all objects.  A program that uses
// bounding volumes for optimization could probably get away with a
// smaller cache.

const c1 = new Array(256);
const c2 = new Array(256);
for ( var i=0 ; i < 256 ; i++ ) {
    c1[i] = -1;
    c2[i] = null;
}

function read_ObjectAt(i) {
    if (c1[i & 255] == i)
     	return c2[i & 255];
    if (om[i] == TRIANGLE)
	var x = read_Triangle(i);
    else
	var x = read_Sphere(i);
    c1[i & 255] = i;
    c2[i & 255] = x;
    return x;
}

Scene.prototype.intersect =
    function (eye, ray, min, max) {
	var min_obj = null;
	var min_dist = SENTINEL;

	var objs = this.objects;
	for ( var i=3 ; i < om_ ; i+=3 ) {
	    var surf = read_ObjectAt(i);
	    var tmp = surf.intersect(eye, ray, min, max);
	    var obj = tmp.obj;
	    var dist = tmp.dist;
	    if (obj)
		if (dist >= min && dist < max)
		    if (dist < min_dist) {
			min_obj = obj;
			min_dist = dist;
		    }
	}
	return {obj:min_obj, dist:min_dist};
    };

function Sphere(material, center, radius) {
    this.material = material;
    this.center = center;
    this.radius = radius;
}

function read_Sphere(obj_) {
    var m = om[obj_+1];
    var d = om[obj_+2];
    return new Sphere(read_Material(m), read3(d), read(d+3));
}

Sphere.prototype.intersect =
    function (eye, ray, min, max) {
	var DdotD = dot(ray, ray);
	var EminusC = sub(eye, this.center);
	var B = dot(ray, EminusC);
	var disc = B*B - DdotD*(dot(EminusC,EminusC) - this.radius*this.radius);
	if (disc < 0.0)
	    return {obj:null, dist:0};
	var s1 = (-B + Math.sqrt(disc))/DdotD;
	var s2 = (-B - Math.sqrt(disc))/DdotD;
	// Here return the smallest of s1 and s2 after filtering for _min and _max
	if (s1 < min || s1 > max)
	    s1 = SENTINEL;
	if (s2 < min || s2 > max)
	    s2 = SENTINEL;
	var _dist = Math.min(s1,s2);
	if (_dist == SENTINEL)
	    return {obj:null, dist:0};
	return {obj:this, dist:_dist};
    };

Sphere.prototype.normal =
    function (p) {
	return divi(sub(p, this.center), this.radius);
    };

function Triangle(material, v1, v2, v3) {
    this.material = material;
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
}

function read_Triangle(obj_) {
    var m = om[obj_+1];
    var d = om[obj_+2];
    return new Triangle(read_Material(m), read3(d), read3(d+3), read3(d+6));
}

Triangle.prototype.intersect =
    function (eye, ray, min, max) {
	var v1 = this.v1;
	var v2 = this.v2;
	var v3 = this.v3;
	var a = v1.x - v2.x;
	var b = v1.y - v2.y;
	var c = v1.z - v2.z;
	var d = v1.x - v3.x;
	var e = v1.y - v3.y;
	var f = v1.z - v3.z;
	var g = ray.x;
	var h = ray.y;
	var i = ray.z;
	var j = v1.x - eye.x;
	var k = v1.y - eye.y;
	var l = v1.z - eye.z;
	var M = a*(e*i - h*f) + b*(g*f - d*i) + c*(d*h - e*g);
	var t = -((f*(a*k - j*b) + e*(j*c - a*l) + d*(b*l - k*c))/M);
	if (t < min || t > max)
	    return {obj:null,dist:0};
	var gamma = (i*(a*k - j*b) + h*(j*c - a*l) + g*(b*l - k*c))/M;
	if (gamma < 0 || gamma > 1.0)
	    return {obj:null,dist:0};
	var beta = (j*(e*i - h*f) + k*(g*f - d*i) + l*(d*h - e*g))/M;
	if (beta < 0.0 || beta > 1.0 - gamma)
	    return {obj:null,dist:0};
	return {obj:this, dist:t};
    };

Triangle.prototype.normal =
    function (p) {
	return normalize(cross(sub(this.v2, this.v1), sub(this.v3, this.v1)));
    };

function setColor(y, x, v) {
    bits[(height-y)*width+x] = (255<<24)|((255*v.z)<<16)|((255*v.y)<<8)|(255*v.x);
}

var world = new Scene();

function trace(hmin, hlim, wmin, wlim) {
    for ( var h=hmin ; h < hlim ; h++ ) {
	for ( var w=wmin ; w < wlim ; w++ ) {
	    var u = g_left + (g_right - g_left)*(w + 0.5)/width;
	    var v = g_bottom + (g_top - g_bottom)*(h + 0.5)/height;
	    var ray = DL3(u, v, -eye.z);
	    var col = raycolor(eye, ray, 0, SENTINEL, reflection_depth);
	    setColor(h, w, col);
	}
    }
}

function raycolor(eye, ray, t0, t1, depth) {
    var tmp = world.intersect(eye, ray, t0, t1);
    var obj = tmp.obj;
    var dist = tmp.dist;

    if (obj) {
	const m = obj.material;
	const p = add(eye, muli(ray, dist));
	const n1 = obj.normal(p);
	const l1 = normalize(sub(light, p));
	var c = m.ambient;
	var min_obj = null;

	if (shadows) {
	    var tmp = world.intersect(add(p, muli(l1, EPS)), l1, EPS, SENTINEL);
	    min_obj = tmp.obj;
	}

	if (!min_obj) {
	    const diffuse = Math.max(0.0, dot(n1,l1));
	    const v1 = normalize(neg(ray));
	    const h1 = normalize(add(v1, l1));
	    const specular = Math.pow(Math.max(0.0, dot(n1, h1)), m.shininess);
	    c = add(c, add(muli(m.diffuse,diffuse), muli(m.specular,specular)));
	    if (reflection)
		if (depth > 0 && m.mirror != 0.0) {
		    const r = sub(ray, muli(n1, 2.0*dot(ray, n1)));
		    c = add(c, muli(raycolor(add(p, muli(r,EPS)), r, EPS, SENTINEL, depth-1), m.mirror));
		}
	}
	return c;
    }
    return background;
}

onmessage =
    function (ev) {
	var [x, y, a, b, c] = ev.data;
	sab = x;
	fm = new SharedFloat64Array(sab, FMLOC, FMMAX);
	om = new SharedInt32Array(sab, OMLOC, OMMAX);
	ix = new SharedInt32Array(sab, IXLOC, IXNUM);
	pool = new SharedInt32Array(sab, POLOC, PONUM);
	om_ = y;
	eye = a;
	light = b;
	background = c;
	bits = new SharedInt32Array(sab, BMLOC, BMNUM);
	barrier = new WorkerBarrier(1337, new SharedInt32Array(sab, BALOC, BANUM), 0);
	for ( var i=0 ; i < ITER ; i++ ) {
	    barrier.enter();	// wait for the goahead / signal completion
	    var limit = Atomics.load(ix, 1);
	    for (;;) {
		var item = Atomics.add(ix, 0, 1);
		if (item >= limit) break;
		var ylo = pool[item*4+0];
		var xlo = pool[item*4+1];
		var yhi = pool[item*4+2];
		var xhi = pool[item*4+3];
		trace(ylo, yhi, xlo, xhi);
	    }
	}
	barrier.enter();	// signal completion after the last iteration
    };
