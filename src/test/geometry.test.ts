import { describe, it, expect } from 'vitest';
import { distance, pointNearLine, snapToGrid, clamp, screenToCanvas, canvasToScreen } from '../utils/geometry';

describe('distance', () => {
  it('returns 0 for same point', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('returns correct distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 5, y: 9 };
    expect(distance(a, b)).toBeCloseTo(distance(b, a), 10);
  });
});

describe('pointNearLine', () => {
  it('detects point on the line', () => {
    expect(pointNearLine(5, 0, 0, 0, 10, 0, 8)).toBe(true);
  });

  it('detects point close to line', () => {
    expect(pointNearLine(5, 3, 0, 0, 10, 0, 8)).toBe(true);
  });

  it('rejects distant point', () => {
    expect(pointNearLine(5, 100, 0, 0, 10, 0, 8)).toBe(false);
  });

  it('handles zero-length line', () => {
    expect(pointNearLine(0, 0, 0, 0, 0, 0, 5)).toBe(true);
    expect(pointNearLine(10, 0, 0, 0, 0, 0, 5)).toBe(false);
  });
});

describe('snapToGrid', () => {
  it('snaps to nearest grid point', () => {
    expect(snapToGrid(13, 10)).toBe(10);
    expect(snapToGrid(16, 10)).toBe(20);
    expect(snapToGrid(15, 10)).toBe(20);
  });

  it('returns value unchanged when already on grid', () => {
    expect(snapToGrid(20, 10)).toBe(20);
    expect(snapToGrid(0, 10)).toBe(0);
  });
});

describe('clamp', () => {
  it('clamps to min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('returns value when in range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('screenToCanvas / canvasToScreen', () => {
  it('screenToCanvas inverts canvasToScreen', () => {
    const canvasPoint = { x: 200, y: 150 };
    const offset = { x: 50, y: 30 };
    const zoom = 1.5;

    const screen = canvasToScreen(canvasPoint.x, canvasPoint.y, offset, zoom);
    const back = screenToCanvas(screen.x, screen.y, offset, zoom);

    expect(back.x).toBeCloseTo(canvasPoint.x, 10);
    expect(back.y).toBeCloseTo(canvasPoint.y, 10);
  });

  it('handles zero offset and unit zoom', () => {
    const pt = screenToCanvas(100, 200, { x: 0, y: 0 }, 1);
    expect(pt.x).toBe(100);
    expect(pt.y).toBe(200);
  });
});
