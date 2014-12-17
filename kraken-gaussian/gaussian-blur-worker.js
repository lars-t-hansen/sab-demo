importScripts("../util/asymmetric-barrier.js",
              "../util/multicore-worker.js");

function blurKernel(data, ymin, ylim, xmin, xlim, dataIn, height, width, kernel, kernelSize, kernelSum) {
          for (var y = ymin; y < ylim; ++y) {
            for (var x = xmin; x < xlim; ++x) {
              var r = 0, g = 0, b = 0, a = 0;
              for (j = 1 - kernelSize; j < kernelSize; ++j) {
                if (y + j < 0 || y + j >= height) continue;
                for (i = 1 - kernelSize; i < kernelSize; ++i) {
                  if (x + i < 0 || x + i >= width) continue;
                  r += dataIn[4 * ((y + j) * width + (x + i)) + 0] * kernel[Math.abs(j)*kernelSize+Math.abs(i)];
                  g += dataIn[4 * ((y + j) * width + (x + i)) + 1] * kernel[Math.abs(j)*kernelSize+Math.abs(i)];
                  b += dataIn[4 * ((y + j) * width + (x + i)) + 2] * kernel[Math.abs(j)*kernelSize+Math.abs(i)];
                  a += dataIn[4 * ((y + j) * width + (x + i)) + 3] * kernel[Math.abs(j)*kernelSize+Math.abs(i)];
                }
              }
              data[4 * (y * width + x) + 0] = r / kernelSum;
              data[4 * (y * width + x) + 1] = g / kernelSum;
              data[4 * (y * width + x) + 2] = b / kernelSum;
              data[4 * (y * width + x) + 3] = a / kernelSum;
            }
          }
}
