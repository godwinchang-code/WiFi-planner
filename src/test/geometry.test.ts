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

// ── Zoom anchor invariant ─────────────────────────────────────────────────────
//
// The wheel-zoom formula in PlannerCanvas computes a new offset such that the
// canvas point beneath the cursor does not move in screen space.
//
// Formula:
//   newOffset = { x: mx - (mx - offset.x) * scale,
//                 y: my - (my - offset.y) * scale }
// where scale = newZoom / oldZoom.

function applyZoomStep(
  mouseX: number, mouseY: number,
  offset: { x: number; y: number },
  zoom: number,
  factor: number,
  minZoom = 0.2, maxZoom = 5,
) {
  const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * factor));
  const scale   = newZoom / zoom;
  return {
    offset: { x: mouseX - (mouseX - offset.x) * scale,
              y: mouseY - (mouseY - offset.y) * scale },
    zoom: newZoom,
  };
}

describe('zoom anchor invariant', () => {
  it('keeps the canvas point under cursor fixed on a single zoom-in step', () => {
    const mouseX = 300, mouseY = 200;
    const offset = { x: 50, y: 30 };
    const zoom   = 1.0;

    const before = screenToCanvas(mouseX, mouseY, offset, zoom);
    const next   = applyZoomStep(mouseX, mouseY, offset, zoom, 1.1);
    const after  = screenToCanvas(mouseX, mouseY, next.offset, next.zoom);

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('keeps the anchor fixed on a single zoom-out step', () => {
    const mouseX = 100, mouseY = 400;
    const offset = { x: -80, y: 20 };
    const zoom   = 2.5;

    const before = screenToCanvas(mouseX, mouseY, offset, zoom);
    const next   = applyZoomStep(mouseX, mouseY, offset, zoom, 0.9);
    const after  = screenToCanvas(mouseX, mouseY, next.offset, next.zoom);

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('keeps the anchor fixed across many rapid scroll steps (stale-closure scenario)', () => {
    // Simulates multiple wheel events arriving before a re-render.
    // Each step must use the result of the previous step — if any step used
    // a stale snapshot the accumulated error would be large.
    const mouseX = 640, mouseY = 360;
    let offset = { x: 0, y: 0 };
    let zoom   = 1.0;

    const before = screenToCanvas(mouseX, mouseY, offset, zoom);

    for (let i = 0; i < 10; i++) {
      const next = applyZoomStep(mouseX, mouseY, offset, zoom, 1.1);
      offset = next.offset;
      zoom   = next.zoom;
    }

    const after = screenToCanvas(mouseX, mouseY, offset, zoom);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('anchor at top-centre stays fixed when zooming from the top', () => {
    const mouseX = 800, mouseY = 10; // top of a 1600-wide canvas
    const offset = { x: 0, y: 0 };
    const zoom   = 1.0;

    const before = screenToCanvas(mouseX, mouseY, offset, zoom);
    const next   = applyZoomStep(mouseX, mouseY, offset, zoom, 1.1);
    const after  = screenToCanvas(mouseX, mouseY, next.offset, next.zoom);

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });
});
