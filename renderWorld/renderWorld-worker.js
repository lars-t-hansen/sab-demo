importScripts("../util/barrier.js",
	      "../util/parinvoke-worker.js");

Multicore.addFunction("MineKernel", MineKernel);

function MineKernel(result, lo, hi, w, h, map, texmap, yCos, ySin, xCos, xSin, ox, oy, oz) {
    for ( var index=lo ; index < hi ; index++ ) {
	var x = Math.floor(index/w);
	var y = index-(x*w);
	var ___xd = (x - w / 2) / h;
	var __yd = (y - h / 2) / h;
	var __zd = 1;
	
	var ___zd = __zd * yCos + __yd * ySin;
	var _yd = __yd * yCos - __zd * ySin;
	
	var _xd = ___xd * xCos + ___zd * xSin;
	var _zd = ___zd * xCos - ___xd * xSin;
	
	var col = 0;
	var br = 255;
	var ddist = 0;
	
	var closest = 32;
	for ( var d = 0; d < 3; d++) {
            var dimLength = _xd;
            if (d == 1)
		dimLength = _yd;
            if (d == 2)
		dimLength = _zd;

            var ll = 1 / (dimLength < 0 ? -dimLength : dimLength);
            var xd = (_xd) * ll;
            var yd = (_yd) * ll;
            var zd = (_zd) * ll;
	    
            var initial = ox - (ox | 0);
            if (d == 1)
		initial = oy - (oy | 0);
            if (d == 2)
		initial = oz - (oz | 0);
            if (dimLength > 0)
		initial = 1 - initial;

            var dist = ll * initial;

            var xp = ox + xd * initial;
            var yp = oy + yd * initial;
            var zp = oz + zd * initial;

            if (dimLength < 0) {
		if (d == 0)
                    xp--;
		if (d == 1)
                    yp--;
		if (d == 2)
                    zp--;
            }

            while (dist < closest) {
		var tex = map[(zp & 63) << 12 | (yp & 63) << 6 | (xp & 63)];
		
		if (tex > 0) {
                    var u = ((xp + zp) * 16) & 15;
                    var v = ((yp * 16) & 15) + 16;
                    if (d == 1) {
			u = (xp * 16) & 15;
			v = ((zp * 16) & 15);
			if (yd < 0)
                            v += 32;
                    }
		    
                    var cc = texmap[u + v * 16 + tex * 256 * 3];
                    if (cc > 0) {
			col = cc;
			ddist = 255 - ((dist / 32 * 255) | 0);
			br = 255 * (255 - ((d + 2) % 3) * 50) / 255;
			closest = dist;
                    }
		}
		xp += xd;
		yp += yd;
		zp += zd;
		dist += ll;
            }
	}

	var r = ((col >> 16) & 0xff) * br * ddist / (255 * 255);
	var g = ((col >> 8) & 0xff) * br * ddist / (255 * 255);
	var b = ((col) & 0xff) * br * ddist / (255 * 255);
	result[index] = ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
    }
}
