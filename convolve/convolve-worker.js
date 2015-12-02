// g will be the input image, h the output image

var g, h;

onmessage =
    function (ev) {
	switch (ev.data[0]) {
	case "start":
	    postMessage(["online"]);
	    break;
	case "data":
	    var [_, a, b] = ev.data;
	    g = new Uint8Array(a);
	    h = new Uint8Array(b);
	    break;
	case "compute":
	    var [_, height, width, lo, hi] = ev.data;
	    var then = new Date();
	    convolve(g, width, lo, hi, h);
	    postMessage(["status", width, lo, hi, (new Date() - then) + "ms"]);
	    postMessage(["done"]);
	    break;
	}
    };

// http://blancosilva.wordpress.com/teaching/mathematical-imaging/edge-detection-the-convolution-approach/
// Faler's approach.

function convolve(grid, width, lo, hi, output) {
    function c1(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp) {
	// (-1  0  1)
	// (-1  0  1)
	// (-1  0  1)
	return -xmm + -xzm + -xpm + xmp + xzp + xpp;
    }
    function c2(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp) {
	// ( 1  1  1)
	// ( 0  0  0)
	// (-1 -1 -1)
	return xmm + xmz + xmp + -xpm + -xpz + -xpp;
    }
    function c3(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp) {
	// (-1 -1 -1)
	// (-1  8 -1)
	// (-1 -1 -1)
	return -xmm + -xzm + -xpm + -xmz + 8*xzz + -xpz + -xmp + -xzp + -xpp;
    }
    function c4(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp) {
	// ( 0  1  0)
	// (-1  0  1)
	// ( 0 -1  0)
	return xmz + -xzm + xzp + -xpz;
    }
    // Local max() to work around bug #1101821, for now.
    function max2(a,b) { return a > b ? a : b }
    function max4(a,b,c,d) { return max2(max2(a,b),max2(c,d)); }
    function max5(a,b,c,d,e) { return max2(max4(a,b,c,d),e); }
    var errors = 0;
    for ( var h=lo ; h < hi ; h++ ) {
	for ( var w=1 ; w < width-1 ; w++ ) {
	    var xmm=grid[(h-1)*width+(w-1)];
	    var xzm=grid[h*width+(w-1)];
	    var xpm=grid[(h+1)*width+(w-1)];
	    var xmz=grid[(h-1)*width+w];
	    var xzz=grid[h*width+w];
	    var xpz=grid[(h+1)*width+w];
	    var xmp=grid[(h-1)*width+(w+1)];
	    var xzp=grid[h*2+(w+1)];
	    var xpp=grid[(h+1)*width+(w+1)];
	    var a = c1(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp);
	    var b = c2(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp);
	    var c = c3(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp);
	    var d = c4(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp);
	    var sum=max5(0,
			 c1(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp),
			 c2(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp),
			 c3(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp),
			 c4(xmm,xzm,xpm,xmz,xzz,xpz,xmp,xzp,xpp));
	    output[h*width+w] = sum;
	}
    }
}
