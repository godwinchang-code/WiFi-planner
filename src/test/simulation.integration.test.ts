/**
 * Deterministic simulation integration tests.
 *
 * Verifies that the JS propagation engine produces stable, physically-plausible
 * output for a known scenario so regressions in the signal model are caught
 * immediately without requiring a WASM runtime.
 */
import { describe, it, expect } from 'vitest';
import {
  generateHeatmap,
  calculateRSSI,
  getBestRSSI,
} from '../utils/signalSimulation';
import type { AccessPoint, Wall } from '../types';

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeAP(overrides: Partial<AccessPoint> = {}): AccessPoint {
  return {
    id: 'ap-1',
    x: 100,
    y: 100,
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

function makeWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: 'wall-1',
    x1: 150,
    y1: 0,
    x2: 150,
    y2: 200,
    type: 'light',
    ...overrides,
  };
}

const PIXELS_PER_METER = 20;

// ── Signal level tests ───────────────────────────────────────────────────────

describe('calculateRSSI – deterministic signal model', () => {
  it('returns a finite dBm value for a point at the AP location', () => {
    const ap = makeAP({ x: 100, y: 100 });
    // Target exactly at AP origin – distance < 0.01m clamps to max signal
    const rssi = calculateRSSI(ap, 100, 100, PIXELS_PER_METER, [], '2.4GHz');
    expect(Number.isFinite(rssi)).toBe(true);
    // Should equal tx_power + gain at distance 0
    expect(rssi).toBeCloseTo(ap.txPower + ap.gain, 1);
  });

  it('signal is weaker at greater distance', () => {
    const ap = makeAP({ x: 0, y: 0 });
    // near = 1 m away (20 px), far = 10 m away (200 px)
    const near = calculateRSSI(ap, 20, 0, PIXELS_PER_METER, [], '2.4GHz');
    const far = calculateRSSI(ap, 200, 0, PIXELS_PER_METER, [], '2.4GHz');
    expect(far).toBeLessThan(near);
  });

  it('wall attenuation reduces RSSI', () => {
    const ap = makeAP({ x: 50, y: 100 });
    const wall = makeWall({ x1: 150, y1: 0, x2: 150, y2: 200 });
    // Target at x=250 (wall is at x=150, so it is in the way)
    const noWall = calculateRSSI(ap, 250, 100, PIXELS_PER_METER, [], '2.4GHz');
    const withWall = calculateRSSI(ap, 250, 100, PIXELS_PER_METER, [wall], '2.4GHz');
    expect(withWall).toBeLessThan(noWall);
  });
});

describe('getBestRSSI – multi-AP scenario', () => {
  it('returns the highest RSSI among multiple APs', () => {
    const ap1 = makeAP({ id: 'ap-1', x: 0, y: 0, txPower: 10 });
    // ap2 is far away and high-power; ap1 is co-located so should win at origin
    const ap2 = makeAP({ id: 'ap-2', x: 500, y: 0, txPower: 30 });
    const best = getBestRSSI({ x: 0, y: 0 }, [ap1, ap2], [], PIXELS_PER_METER, '2.4GHz');
    const only1 = getBestRSSI({ x: 0, y: 0 }, [ap1], [], PIXELS_PER_METER, '2.4GHz');
    // at co-location the difference should be tiny
    expect(best).toBeCloseTo(only1, 0);
  });

  it('returns -Infinity when no APs are enabled', () => {
    const ap = makeAP({ enabled: false });
    const result = getBestRSSI({ x: 100, y: 100 }, [ap], [], PIXELS_PER_METER, '2.4GHz');
    expect(result).toBe(-Infinity);
  });
});

describe('generateHeatmap – output shape and determinism', () => {
  it('returns an ImageData with non-zero dimensions', () => {
    const ap = makeAP({ x: 200, y: 200 });
    const { imageData, stats } = generateHeatmap(400, 400, 8, [ap], [], PIXELS_PER_METER, '2.4GHz');

    expect(imageData.width).toBeGreaterThan(0);
    expect(imageData.height).toBeGreaterThan(0);
    expect(imageData.data.length).toBe(imageData.width * imageData.height * 4);
    expect(stats.totalCells).toBeGreaterThan(0);
  });

  it('coverage statistics sum to 100% (within floating-point error)', () => {
    const ap = makeAP({ x: 200, y: 200, txPower: 30 });
    const { stats } = generateHeatmap(400, 400, 8, [ap], [], PIXELS_PER_METER, '2.4GHz');
    const total =
      stats.excellentPercent +
      stats.goodPercent +
      stats.fairPercent +
      stats.poorPercent +
      stats.noCoveragePercent;
    expect(total).toBeCloseTo(100, 1);
  });

  it('is deterministic – same input produces identical pixel bytes', () => {
    const ap = makeAP({ x: 100, y: 100 });
    const wall = makeWall();
    const run1 = generateHeatmap(200, 200, 8, [ap], [wall], PIXELS_PER_METER, '2.4GHz');
    const run2 = generateHeatmap(200, 200, 8, [ap], [wall], PIXELS_PER_METER, '2.4GHz');
    // Sample first 32 bytes to detect any non-determinism quickly
    for (let i = 0; i < 32; i++) {
      expect(run2.imageData.data[i]).toBe(run1.imageData.data[i]);
    }
  });
});
