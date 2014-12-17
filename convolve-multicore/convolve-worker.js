importScripts("../util/asymmetric-barrier.js",
	      "../util/multicore-worker.js");

// http://blancosilva.wordpress.com/teaching/mathematical-imaging/edge-detection-the-convolution-approach/
// Faler's approach.

function convolve(output, ylo, yhi, xlo, xhi, input, height, width) {
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
    if (ylo == 0) ylo++;
    if (xlo == 0) xlo++;
    if (yhi == height) yhi--;
    if (xhi == width) xhi--;
    for ( var h=ylo ; h < yhi ; h++ ) {
	for ( var w=xlo ; w < xhi ; w++ ) {
	    var xmm=input[(h-1)*width+(w-1)];
	    var xzm=input[h*width+(w-1)];
	    var xpm=input[(h+1)*width+(w-1)];
	    var xmz=input[(h-1)*width+w];
	    var xzz=input[h*width+w];
	    var xpz=input[(h+1)*width+w];
	    var xmp=input[(h-1)*width+(w+1)];
	    var xzp=input[h*2+(w+1)];
	    var xpp=input[(h+1)*width+(w+1)];
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
