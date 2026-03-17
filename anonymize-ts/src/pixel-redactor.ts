import { PixelDimensions } from './types';

/**
 * Apply top-ratio pixel redaction to DICOM pixel data.
 *
 * Zeros out the top N% of pixel rows in every frame.
 * This is a simplified version of DicomProcessor._apply_top_redaction() that
 * does not use AI corner predictions — it unconditionally masks the top portion.
 *
 * @param pixelData - Raw pixel data buffer (all frames concatenated)
 * @param dimensions - Frame dimensions
 * @param topRatio - Fraction of image height to redact from top (0.0-1.0)
 * @returns Modified pixel data buffer (new copy)
 */
export function applyTopRedaction(
  pixelData: ArrayBuffer,
  dimensions: PixelDimensions,
  topRatio: number
): ArrayBuffer {
  if (topRatio <= 0 || topRatio > 1) {
    return pixelData;
  }

  const { numFrames, height, width, channels, bitsAllocated = 8 } = dimensions;
  const redactionHeight = Math.floor(height * topRatio);

  if (redactionHeight <= 0) {
    return pixelData;
  }

  // Work on a copy
  const result = new Uint8Array(pixelData.slice(0));
  const bytesPerSample = Math.ceil(bitsAllocated / 8);
  const bytesPerPixel = channels * bytesPerSample;
  const bytesPerRow = width * bytesPerPixel;
  const bytesPerFrame = height * bytesPerRow;

  for (let frame = 0; frame < numFrames; frame++) {
    const frameOffset = frame * bytesPerFrame;
    const redactionBytes = redactionHeight * bytesPerRow;
    // Zero out the top rows
    result.fill(0, frameOffset, frameOffset + redactionBytes);
  }

  return result.buffer;
}

/**
 * Apply top-ratio redaction directly to a Uint8Array pixel buffer (in-place).
 * Use this when you already have a mutable buffer.
 */
export function applyTopRedactionInPlace(
  pixelData: Uint8Array,
  dimensions: PixelDimensions,
  topRatio: number
): void {
  if (topRatio <= 0 || topRatio > 1) {
    return;
  }

  const { numFrames, height, width, channels, bitsAllocated = 8 } = dimensions;
  const redactionHeight = Math.floor(height * topRatio);

  if (redactionHeight <= 0) {
    return;
  }

  const bytesPerSample = Math.ceil(bitsAllocated / 8);
  const bytesPerPixel = channels * bytesPerSample;
  const bytesPerRow = width * bytesPerPixel;
  const bytesPerFrame = height * bytesPerRow;

  for (let frame = 0; frame < numFrames; frame++) {
    const frameOffset = frame * bytesPerFrame;
    const redactionBytes = redactionHeight * bytesPerRow;
    pixelData.fill(0, frameOffset, frameOffset + redactionBytes);
  }
}
