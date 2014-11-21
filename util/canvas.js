function canvasSetFromGrayscale(canvasElt, bytes, height, width) {
    canvasElt.height = height;
    canvasElt.width = width;
    var cx = canvasElt.getContext('2d');
    var id  = cx.createImageData(width, height);
    var data = new Int32Array(id.data.buffer, id.data.byteOffset, width*height);
    for ( var y=0 ; y < height ; y++ ) {
	for ( var x=0 ; x < width ; x++ ) {
	    var v = bytes[y*width+x] & 255;
	    data[y*width+x] = 0xFF000000 | (v << 16) | (v << 8) | v;
	}
    }
    cx.putImageData( id, 0, 0 );
}

function canvasSetFromABGRBytes(canvasElt, bytes, height, width) {
    canvasElt.height = height;
    canvasElt.width = width;
    var cx = canvasElt.getContext('2d');
    var id  = cx.createImageData(width, height);
    id.data.set(bytes);
    cx.putImageData( id, 0, 0 );
}
