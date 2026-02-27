// Test setup file
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

    getContext(_type: string) {
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
