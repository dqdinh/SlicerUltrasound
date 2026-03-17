import { applyTopRedaction, applyTopRedactionInPlace } from '../pixel-redactor';
import { PixelDimensions } from '../types';

describe('applyTopRedaction', () => {
  const dims: PixelDimensions = {
    numFrames: 1,
    height: 100,
    width: 50,
    channels: 3,
    bitsAllocated: 8,
  };

  function createTestBuffer(dims: PixelDimensions, fillValue: number = 255): ArrayBuffer {
    const bytesPerSample = Math.ceil((dims.bitsAllocated || 8) / 8);
    const size = dims.numFrames * dims.height * dims.width * dims.channels * bytesPerSample;
    const buffer = new ArrayBuffer(size);
    new Uint8Array(buffer).fill(fillValue);
    return buffer;
  }

  it('returns original buffer when topRatio is 0', () => {
    const buffer = createTestBuffer(dims);
    const result = applyTopRedaction(buffer, dims, 0);
    expect(result).toBe(buffer); // Same reference (no copy)
  });

  it('returns original buffer when topRatio is negative', () => {
    const buffer = createTestBuffer(dims);
    const result = applyTopRedaction(buffer, dims, -0.1);
    expect(result).toBe(buffer);
  });

  it('zeros out top 10% of pixels', () => {
    const buffer = createTestBuffer(dims);
    const result = applyTopRedaction(buffer, dims, 0.1);
    const resultView = new Uint8Array(result);

    // Top 10% = 10 rows out of 100
    const redactionBytes = 10 * 50 * 3; // 10 rows * width * channels

    // Check that top pixels are zeroed
    for (let i = 0; i < redactionBytes; i++) {
      expect(resultView[i]).toBe(0);
    }

    // Check that remaining pixels are untouched
    for (let i = redactionBytes; i < resultView.length; i++) {
      expect(resultView[i]).toBe(255);
    }
  });

  it('works with multi-frame data', () => {
    const multiDims: PixelDimensions = { numFrames: 3, height: 100, width: 50, channels: 3, bitsAllocated: 8 };
    const buffer = createTestBuffer(multiDims);
    const result = applyTopRedaction(buffer, multiDims, 0.2);
    const resultView = new Uint8Array(result);

    const bytesPerFrame = 100 * 50 * 3;
    const redactionBytesPerFrame = 20 * 50 * 3; // 20% of 100 rows

    for (let frame = 0; frame < 3; frame++) {
      const frameOffset = frame * bytesPerFrame;

      // Top 20% zeroed
      for (let i = 0; i < redactionBytesPerFrame; i++) {
        expect(resultView[frameOffset + i]).toBe(0);
      }

      // Rest untouched
      for (let i = redactionBytesPerFrame; i < bytesPerFrame; i++) {
        expect(resultView[frameOffset + i]).toBe(255);
      }
    }
  });

  it('does not modify the original buffer', () => {
    const buffer = createTestBuffer(dims);
    const original = new Uint8Array(buffer).slice();
    applyTopRedaction(buffer, dims, 0.5);
    expect(new Uint8Array(buffer)).toEqual(original);
  });

  it('handles grayscale (1 channel)', () => {
    const grayDims: PixelDimensions = { numFrames: 1, height: 100, width: 50, channels: 1, bitsAllocated: 8 };
    const buffer = createTestBuffer(grayDims);
    const result = applyTopRedaction(buffer, grayDims, 0.1);
    const resultView = new Uint8Array(result);

    const redactionBytes = 10 * 50 * 1;
    for (let i = 0; i < redactionBytes; i++) {
      expect(resultView[i]).toBe(0);
    }
    for (let i = redactionBytes; i < resultView.length; i++) {
      expect(resultView[i]).toBe(255);
    }
  });
});

describe('applyTopRedactionInPlace', () => {
  it('modifies the buffer in place', () => {
    const dims: PixelDimensions = { numFrames: 1, height: 10, width: 5, channels: 1, bitsAllocated: 8 };
    const data = new Uint8Array(50).fill(128);
    applyTopRedactionInPlace(data, dims, 0.5);

    // Top 50% = 5 rows = 25 bytes zeroed
    for (let i = 0; i < 25; i++) {
      expect(data[i]).toBe(0);
    }
    for (let i = 25; i < 50; i++) {
      expect(data[i]).toBe(128);
    }
  });
});
