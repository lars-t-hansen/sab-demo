A simple program that computes a Mandelbrot set in parallel into a
shared array and displays it in a canvas, using the "Multicore.build"
framework.

The framework takes care of load balancing and synchronization; the
main computation just reacts to callbacks.
