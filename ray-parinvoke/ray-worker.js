importScripts("../util/asymmetric-barrier.js",
	      "../util/parinvoke-worker.js");

Multicore.addFunction("setupScene", setupScene);
Multicore.addFunction("setupParameters", setupParameters);
Multicore.addFunction("trace", trace);

// Begin rendering parameters

var height = 0;
var width = 0;

var g_left = 0;
var g_right = 0;
var g_top = 0;
var g_bottom = 0;

var shadows = false;
var reflection = false;
var reflection_depth = 0;

var eye = { x: 0, y: 0, z: 0 };
var light = { x: 0, y: 0, z: 0 };

function setupParameters(_height, _width, _left, _right, _top, _bottom,
			 _shadows, _reflection, _reflection_depth,
			 _eye_x, _eye_y, _eye_z,
			 _light_x, _light_y, _light_z)
{
    height = _height;
    width = _width;
    g_left = _left;
    g_right = _right;
    g_top = _top;
    g_bottom = _bottom;
    shadows = !!_shadows;
    reflection = !!_reflection;
    reflection_depth = _reflection_depth;
    eye = DL3(_eye_x, _eye_y, _eye_z);
    light = DL3(_light_x, _light_y, _light_z);
}

// End rendering parameters

var world;			// Scene graph

const SENTINEL = 1e32;
const EPS = 0.00001;

function DL3(x, y, z) { return {x:x, y:y, z:z}; }

function add(a, b) { return DL3(a.x+b.x, a.y+b.y, a.z+b.z); }
function addi(a, c) { return DL3(a.x+c, a.y+c, a.z+c); }
function sub(a, b) { return DL3(a.x-b.x, a.y-b.y, a.z-b.z); }
function subi(a, c) { return DL3(a.x-c, a.y-c, a.z-c); }
function muli(a, c) { return DL3(a.x*c, a.y*c, a.z*c); }
function divi(a, c) { return DL3(a.x/c, a.y/c, a.z/c); }
function neg(a) { return DL3(-a.x, -a.y, -a.z); }
function length(a) { return Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z); }
function normalize(a) { var d = length(a); return DL3(a.x/d, a.y/d, a.z/d); }
function cross(a, b) { return DL3(a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x); }
function dot(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }

function Material(diffuse, specular, shininess, ambient, mirror) {
    this.diffuse = diffuse;
    this.specular = specular;
    this.shininess = shininess;
    this.ambient = ambient;
    this.mirror = mirror;
}

const zzz = DL3(0,0,0);
const m0 = new Material(zzz, zzz, 0, zzz, 0);

function Scene() {
    this.material = m0;
    this.objects = [];
}

Scene.prototype.add =
    function(obj) {
	this.objects.push(obj);
    };

Scene.prototype.intersect =
    function (eye, ray, min, max) {
	var min_obj = null;
	var min_dist = SENTINEL;

	var objs = this.objects;
	for ( var idx=0, limit=objs.length ; idx < limit ; idx++ ) {
	    var surf = objs[idx];
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

Scene.prototype.normal =
    function (p) {
	fail("normal() not defined on Scene");
	return zzz;
    };

function Sphere(material, center, radius) {
    this.material = material;
    this.center = center;
    this.radius = radius;
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

function setupScene() {
    world = new Scene();
    world.background = DL3(25.0/256.0,25.0/256.0,112.0/256.0);

    const paleGreen = DL3(152.0/256.0, 251.0/256.0, 152.0/256.0);
    const darkGray = DL3(169.0/256.0, 169.0/256.0, 169.0/256.0);
    const yellow = DL3(1.0, 1.0, 0.0);
    const red = DL3(1.0, 0.0, 0.0);
    const blue = DL3(0.0, 0.0, 1.0);

    const m1 = new Material(DL3(0.1, 0.2, 0.2), DL3(0.3, 0.6, 0.6), 10, DL3(0.05, 0.1, 0.1), 0);
    const m2 = new Material(DL3(0.3, 0.3, 0.2), DL3(0.6, 0.6, 0.4), 10, DL3(0.1,0.1,0.05),   0);
    const m3 = new Material(DL3(0.1,  0,  0), DL3(0.8,0,0),     10, DL3(0.1,0,0),     0);
    const m4 = new Material(muli(darkGray,0.4), muli(darkGray,0.3), 100, muli(darkGray,0.3), 0.5);
    const m5 = new Material(muli(paleGreen,0.4), muli(paleGreen,0.4), 10, muli(paleGreen,0.2), 1.0);
    const m6 = new Material(muli(yellow,0.6), zzz, 0, muli(yellow,0.4), 0);
    const m7 = new Material(muli(red,0.6), zzz, 0, muli(red,0.4), 0);
    const m8 = new Material(muli(blue,0.6), zzz, 0, muli(blue,0.4), 0);

    world.add(new Sphere(m1, DL3(-1, 1, -9), 1));
    world.add(new Sphere(m2, DL3(1.5, 1, 0), 0.75));
    world.add(new Triangle(m1, DL3(-1,0,0.75), DL3(-0.75,0,0), DL3(-0.75,1.5,0)));
    world.add(new Triangle(m3, DL3(-2,0,0), DL3(-0.5,0,0), DL3(-0.5,2,0)));
    rectangle(m4, DL3(-5,0,5), DL3(5,0,5), DL3(5,0,-40), DL3(-5,0,-40));
    cube(m5, DL3(1, 1.5, 1.5), DL3(1.5, 1.5, 1.25), DL3(1.5, 1.75, 1.25), DL3(1, 1.75, 1.5),
	 DL3(1.5, 1.5, 0.5), DL3(1, 1.5, 0.75), DL3(1, 1.75, 0.75), DL3(1.5, 1.75, 0.5));
    for ( var i=0 ; i < 30 ; i++ )
	world.add(new Sphere(m6, DL3((-0.6+(i*0.2)), (0.075+(i*0.05)), (1.5-(i*Math.cos(i/30.0)*0.5))), 0.075));
    for ( var i=0 ; i < 60 ; i++ )
	world.add(new Sphere(m7, DL3((1+0.3*Math.sin(i*(3.14/16))), (0.075+(i*0.025)), (1+0.3*Math.cos(i*(3.14/16)))), 0.025));
    for ( var i=0 ; i < 60 ; i++ )
	world.add(new Sphere(m8, DL3((1+0.3*Math.sin(i*(3.14/16))), (0.075+((i+8)*0.025)), (1+0.3*Math.cos(i*(3.14/16)))), 0.025));

    function rectangle(m, v1, v2, v3, v4) {
	world.add(new Triangle(m, v1, v2, v3));
	world.add(new Triangle(m, v1, v3, v4));
    }

    function cube(m, v1, v2, v3, v4, v5, v6, v7, v8) {
	rectangle(m, v1, v2, v3, v4);  // front
	rectangle(m, v2, v5, v8, v3);  // right
	rectangle(m, v6, v1, v4, v7);  // left
	rectangle(m, v5, v5, v7, v8);  // back
	rectangle(m, v4, v3, v8, v7);  // top
	rectangle(m, v6, v5, v2, v1);  // bottom
    }
}

function trace(buffer, hmin, hlim, wmin, wlim) {
    for ( var h=hmin ; h < hlim ; h++ ) {
	for ( var w=wmin ; w < wlim ; w++ ) {
	    var u = g_left + (g_right - g_left)*(w + 0.5)/width;
	    var v = g_bottom + (g_top - g_bottom)*(h + 0.5)/height;
	    var ray = DL3(u, v, -eye.z);
	    var col = raycolor(eye, ray, 0, SENTINEL, reflection_depth);
	    buffer[(height-h)*width+w] = (255<<24)|((255*col.z)<<16)|((255*col.y)<<8)|(255*col.x);
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

	// Passing NULL here and testing for it in intersect() was intended as an optimization,
	// since any hit will do, but does not seem to have much of an effect in scenes tested
	// so far - maybe not enough scene detail (too few shadows).
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
		if (depth > 0.0 && m.mirror != 0.0) {
		    const r = sub(ray, muli(n1, 2.0*dot(ray, n1)));
		    c = add(c, muli(raycolor(add(p, muli(r,EPS)), r, EPS, SENTINEL, depth-1), m.mirror));
		}
	}
	return c;
    }
    return world.background;
}

function fail(msg) {
    Multicore.msg(msg);
    throw new Error("EXIT");
}
