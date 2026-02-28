// Test setup file
import '@testing-library/jest-dom';

// ImageData is not available in jsdom – provide a minimal mock
if (typeof ImageData === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ImageData = class MockImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
}

// Canvas 2D context – jsdom has a stub but getContext returns null; fill it in
HTMLCanvasElement.prototype.getContext = function (contextId: string) {
  if (contextId === '2d') {
    return {
      clearRect: () => { /* mock */ },
      putImageData: () => { /* mock */ },
      drawImage: () => { /* mock */ },
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    } as unknown as CanvasRenderingContext2D;
  }
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;

// ResizeObserver is not available in jsdom
if (typeof ResizeObserver === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class MockResizeObserver {
    observe() { /* mock */ }
    unobserve() { /* mock */ }
    disconnect() { /* mock */ }
  };
}

// OffscreenCanvas is not available in jsdom, provide a mock
if (typeof OffscreenCanvas === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).OffscreenCanvas = class MockOffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext(_contextType: string) {
      return {
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        }),
        putImageData: () => { /* mock */ },
        drawImage: () => { /* mock */ },
      };
    }
  };
}
