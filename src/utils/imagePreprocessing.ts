/**
 * Client-side HTML5 Canvas utilities for OCR Image Preprocessing.
 * Performs scaling, grayscale conversion, contrast enhancement, binarization, and sharpening.
 */

export interface PreprocessOptions {
  scaleFactor?: number;
  contrast?: number; // 1.0 = normal, >1.0 = higher contrast (e.g. 1.5)
  brightness?: number; // -255 to 255
  binarizeThreshold?: number | null; // null for adaptive/otsu or no binarization
  sharpen?: boolean;
}

/**
 * Preprocesses an image File or ImageElement for improved OCR accuracy.
 * Returns a Canvas element containing the processed image.
 */
export async function preprocessImageForOCR(
  imageSource: File | Blob | HTMLImageElement | string,
  options: PreprocessOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    scaleFactor = 2,
    contrast = 1.4,
    brightness = 10,
    binarizeThreshold = null,
    sharpen = true,
  } = options;

  const img = await loadImage(imageSource);

  // Determine scaled canvas dimensions
  const targetWidth = Math.round(img.width * scaleFactor);
  const targetHeight = Math.round(img.height * scaleFactor);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2d context for canvas');

  // Smooth scaling for upscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;

  // 1. Grayscale, Contrast, Brightness
  // Contrast adjustment factor: f = (259 * (contrast + 255)) / (255 * (259 - contrast)) where contrast is in range -255 to 255
  // For multiplier (e.g. 1.4), contrastVal in range:
  const contrastFactor = contrast;

  let totalGray = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Luminosity grayscale formula
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Apply brightness
    gray += brightness;

    // Apply contrast
    gray = (gray - 128) * contrastFactor + 128;

    // Clamp 0-255
    gray = Math.min(255, Math.max(0, gray));

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;

    totalGray += gray;
  }

  // 2. Optional Otsu or Fixed Binarization
  if (binarizeThreshold !== null) {
    const thresh = binarizeThreshold;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] >= thresh ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // 3. Optional 3x3 Sharpen Convolution
  if (sharpen) {
    applySharpenKernel(ctx, targetWidth, targetHeight);
  }

  return canvas;
}

function loadImage(src: File | Blob | HTMLImageElement | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (src instanceof HTMLImageElement) {
      if (src.complete && src.naturalWidth !== 0) {
        resolve(src);
        return;
      }
      src.onload = () => resolve(src);
      src.onerror = reject;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;

    if (src instanceof File || src instanceof Blob) {
      img.src = URL.createObjectURL(src);
    } else {
      img.src = src;
    }
  });
}

function applySharpenKernel(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const src = imageData.data;
  const output = ctx.createImageData(width, height);
  const dst = output.data;

  // 3x3 Sharpen Kernel
  // [  0, -1,  0 ]
  // [ -1,  5, -1 ]
  // [  0, -1,  0 ]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      const up = ((y - 1) * width + x) * 4;
      const down = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      const val = 5 * src[idx] - src[up] - src[down] - src[left] - src[right];
      const clamped = Math.min(255, Math.max(0, val));

      dst[idx] = clamped;
      dst[idx + 1] = clamped;
      dst[idx + 2] = clamped;
      dst[idx + 3] = 255;
    }
  }

  ctx.putImageData(output, 0, 0);
}
