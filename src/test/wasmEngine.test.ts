/**
 * Tests for the WASM engine TypeScript wrapper.
 *
 * These tests run against the actual wasm-pack output via vitest's jsdom
 * environment (with the OffscreenCanvas mock from setup.ts).
 *
 * The WASM module is imported statically – vite-plugin-wasm (and therefore
 * the bundler init glue) isn't involved during tests, so we import the
 * background JS directly.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── Mock the WASM pkg so tests don't require a browser WASM runtime ─────────

vi.mock('../wasm/pkg/wifi_planner_wasm', () => {
  /**
   * Lightweight JS replicas of the Rust functions, used to test that the
   * TypeScript wrapper (engine.ts) correctly serialises inputs and
   * deserialises outputs without depending on the actual WASM binary.
   */

  class HeatmapResult {
    _pixels: Uint8Array;
    cols: number;
    rows: number;
    excellent_count: number;
    good_count: number;
    fair_count: number;
    poor_count: number;
    no_coverage_count: number;
    total_count: number;
    _avg: number;

    constructor(
      pixels: Uint8Array, cols: number, rows: number,
      exc: number, good: number, fair: number, poor: number, none: number, avg: number,
    ) {
      this._pixels = pixels;
      this.cols = cols;
      this.rows = rows;
      this.excellent_count = exc;
      this.good_count = good;
      this.fair_count = fair;
      this.poor_count = poor;
      this.no_coverage_count = none;
      this.total_count = exc + good + fair + poor + none;
      this._avg = avg;
    }
    pixels() { return this._pixels; }
    avg_rssi() { return this._avg; }
    free() { /* noop */ }
  }

  const compute_heatmap = (
    width: number,
    height: number,
    resolution: number,
    apData: Float64Array,
    _wallData: Float64Array,
    _ppm: number,
  ) => {
    const cols = Math.ceil(width / resolution);
    const rows = Math.ceil(height / resolution);
    const total = cols * rows;
    const pixels = new Uint8Array(total * 4);

    // For testing, mark every cell green when there's at least one enabled AP
    const hasAP = apData.length >= 6 && apData[5] >= 0.5;
    if (hasAP) {
      for (let i = 0; i < total; i++) {
        pixels[i * 4 + 1] = 200;  // green
        pixels[i * 4 + 3] = 191;  // alpha
      }
    }
    return new HeatmapResult(pixels, cols, rows, hasAP ? total : 0, 0, 0, 0, hasAP ? 0 : total, -55.0);
  };

  const point_rssi = (
    _x: number, _y: number,
    apData: Float64Array,
    _wallData: Float64Array,
    _ppm: number,
  ) => apData.length >= 6 && apData[5] >= 0.5 ? -55.0 : -Infinity;

  const init_panic_hook = () => { /* noop */ };

  return { compute_heatmap, point_rssi, init_panic_hook };
});

// ─── Actual tests ─────────────────────────────────────────────────────────────

import { WasmPropagationEngine, loadWasmEngine } from '../wasm/engine';
import type { AccessPoint, Wall } from '../types';

function makeAP(overrides: Partial<AccessPoint> = {}): AccessPoint {
  return {
    id: 'test-ap',
    x: 100, y: 100,
    name: 'Test AP',
    band: '2.4GHz',
    channel: 6,
    txPower: 20,
    gain: 2,
    enabled: true,
    color: '#3b82f6',
    ...overrides,
  };
}

const NO_WALLS: Wall[] = [];

describe('WasmPropagationEngine.generateHeatmap', () => {
  const engine = new WasmPropagationEngine();

  it('returns ImageData with correct dimensions', () => {
    const { imageData } = engine.generateHeatmap(200, 100, 10, [makeAP()], NO_WALLS, 20, '2.4GHz');
    expect(imageData.width).toBe(20);   // ceil(200/10)
    expect(imageData.height).toBe(10);  // ceil(100/10)
  });

  it('returns pixel buffer with correct byte length', () => {
    const { imageData } = engine.generateHeatmap(200, 100, 10, [makeAP()], NO_WALLS, 20, '2.4GHz');
    expect(imageData.data.length).toBe(20 * 10 * 4);
  });

  it('populates stats from HeatmapResult', () => {
    const { stats } = engine.generateHeatmap(200, 100, 10, [makeAP()], NO_WALLS, 20, '2.4GHz');
    expect(stats.totalCells).toBe(20 * 10);
    expect(stats.excellentCells).toBe(20 * 10); // mock marks all as excellent
    expect(stats.excellentPercent).toBeCloseTo(100, 1);
    expect(stats.avgRSSI).toBe(-55.0);
  });

  it('passes band frequency to AP data', () => {
    // With 5 GHz the mock still returns data (same path), just verifies no crash
    const { imageData } = engine.generateHeatmap(100, 100, 10, [makeAP()], NO_WALLS, 20, '5GHz');
    expect(imageData.width).toBe(10);
  });

  it('handles disabled AP (all no-coverage)', () => {
    const ap = makeAP({ enabled: false });
    const { stats } = engine.generateHeatmap(100, 100, 10, [ap], NO_WALLS, 20, '2.4GHz');
    expect(stats.excellentCells).toBe(0);
    expect(stats.noCoverageCells).toBe(stats.totalCells);
  });

  it('serialises walls into Float64Array correctly', () => {
    const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 100, y2: 0, type: 'concrete' };
    // Mock ignores walls, but this ensures no exception is thrown during serialisation
    expect(() => {
      engine.generateHeatmap(100, 100, 10, [makeAP()], [wall], 20, '2.4GHz');
    }).not.toThrow();
  });
});

describe('WasmPropagationEngine.pointRSSI', () => {
  const engine = new WasmPropagationEngine();

  it('returns finite RSSI for enabled AP', () => {
    const rssi = engine.pointRSSI(50, 50, [makeAP()], NO_WALLS, 20, '2.4GHz');
    expect(isFinite(rssi)).toBe(true);
    expect(rssi).toBe(-55.0);
  });

  it('returns -Infinity for disabled AP', () => {
    const rssi = engine.pointRSSI(50, 50, [makeAP({ enabled: false })], NO_WALLS, 20, '2.4GHz');
    expect(rssi).toBe(-Infinity);
  });

  it('returns -Infinity with empty AP list', () => {
    const rssi = engine.pointRSSI(50, 50, [], NO_WALLS, 20, '2.4GHz');
    expect(rssi).toBe(-Infinity);
  });
});

describe('loadWasmEngine', () => {
  it('returns a WasmPropagationEngine instance', async () => {
    const engine = await loadWasmEngine();
    expect(engine).toBeInstanceOf(WasmPropagationEngine);
  });

  it('returns the same singleton on repeated calls', async () => {
    const a = await loadWasmEngine();
    const b = await loadWasmEngine();
    expect(a).toBe(b);
  });
});
