A simple program that computes a Mandelbrot set in parallel into a
shared array and displays it in a canvas.

The program just splits the output grid into strips among the workers;
there is no load balancing.
