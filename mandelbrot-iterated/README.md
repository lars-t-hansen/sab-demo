A simple program that computes a Mandelbrot set in parallel into a
shared array and displays it in a canvas, using the "Multicore.build"
framework.

It then repeats the computation at a higher magnification level, thus
creating an animation where we zoom in on a point in the fractal.

The framework takes care of load balancing and synchronization; the
main computation just reacts to callbacks and schedules iterations.
