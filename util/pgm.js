// Utilities for Portable Graymap images.

function PGM() {
    this.height = 0;
    this.width = 0;
    this.maxval = 0;
    this.data = null;		// A Uint8Array of length height*width
}

PGM.prototype.loadFromURL =
    function (url, success, fail) {
	var req = new XMLHttpRequest();
	var self = this;
	req.open('get', url, true);
	req.responseType = "arraybuffer";
	req.addEventListener('load', function (ev) { self.setFromBytes(ev.target.response); success(); });
	req.addEventListener('error', function () { if (fail) fail(); });
	req.send();
    };

// Note, this will retain the byte array as a representation of the
// image.

PGM.prototype.setFromBytes =
    function (ab) {
	var loc = 0;
	var bytes = new Uint8Array(ab);

	if (getAscii() != "P5")
            throw "Bad magic: " + word;

	skipWhite();
	this.width = parseInt(getAscii());

	skipWhite();
	this.height = parseInt(getAscii());

	skipWhite();
	this.maxval = parseInt(getAscii());
	loc++;

	this.data = new Uint8Array(ab, loc);

	function getAscii() {
	    var s = "";
	    while (loc < bytes.length && bytes[loc] > 32)
		s += String.fromCharCode(bytes[loc++]);
	    return s;
	}

	function skipWhite() {
	    while (loc < bytes.length && bytes[loc] <= 32)
		loc++;
	}
    };

