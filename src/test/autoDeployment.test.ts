import { describe, it, expect } from 'vitest';
import { computeAutoDeployment } from '../utils/autoDeployment';
import type { DeploymentOptions } from '../types';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const FLOOR = { width: 600, height: 400 };
const WALLS: never[] = [];
const PPM   = 50; // 50 px per metre → 12 m × 8 m floor

const OPTS: DeploymentOptions = {
  band:             '2.4GHz',
  txPower:          20,
  gain:             3,
  targetRSSI:       -70,
  minSeparationM:   5,
  targetCoveragePct: 0.8,
  maxAPs:           6,
};

function allPairsAboveSep(
  positions: Array<{ x: number; y: number }>,
  minSepPx: number,
) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < minSepPx) return false;
    }
  }
  return true;
}

// ── Basic behaviour ───────────────────────────────────────────────────────────

describe('computeAutoDeployment — basic', () => {
  it('returns positions array and coverage stats', () => {
    const r = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS);
    expect(Array.isArray(r.positions)).toBe(true);
    expect(r.achievedCoveragePct).toBeGreaterThanOrEqual(0);
    expect(r.achievedCoveragePct).toBeLessThanOrEqual(1);
    expect(r.uncoveredPct).toBeCloseTo(1 - r.achievedCoveragePct, 10);
  });

  it('never exceeds maxAPs', () => {
    const r = computeAutoDeployment(FLOOR, WALLS, PPM, { ...OPTS, maxAPs: 3 });
    expect(r.positions.length).toBeLessThanOrEqual(3);
  });

  it('returns empty result for zero-size floor', () => {
    const r = computeAutoDeployment({ width: 0, height: 0 }, WALLS, PPM, OPTS);
    expect(r.positions).toHaveLength(0);
    expect(r.achievedCoveragePct).toBe(0);
  });
});

// ── Separation between newly placed APs ──────────────────────────────────────

describe('computeAutoDeployment — separation between new APs', () => {
  it('all newly placed APs respect minSeparationM', () => {
    const r = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS);
    const minSepPx = OPTS.minSeparationM * PPM; // 5 m × 50 px/m = 250 px
    expect(allPairsAboveSep(r.positions, minSepPx)).toBe(true);
  });

  it('respects separation at a tighter threshold', () => {
    const opts = { ...OPTS, minSeparationM: 3 };
    const r    = computeAutoDeployment(FLOOR, WALLS, PPM, opts);
    expect(allPairsAboveSep(r.positions, 3 * PPM)).toBe(true);
  });
});

// ── Separation from existing APs (bug fix) ───────────────────────────────────

describe('computeAutoDeployment — separation from existingAPs', () => {
  it('new APs keep minSeparationM away from an existing AP', () => {
    // Place one existing AP right in the centre of the floor
    const existing = [{ x: 300, y: 200 }];
    const minSepPx = OPTS.minSeparationM * PPM; // 250 px

    const r = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS, existing);

    for (const pos of r.positions) {
      const dx  = pos.x - existing[0].x;
      const dy  = pos.y - existing[0].y;
      const sep = Math.sqrt(dx * dx + dy * dy);
      expect(sep).toBeGreaterThanOrEqual(minSepPx);
    }
  });

  it('new APs keep separation from multiple existing APs', () => {
    const existing = [
      { x: 100, y: 100 },
      { x: 500, y: 300 },
    ];
    const minSepPx = OPTS.minSeparationM * PPM;

    const r = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS, existing);

    for (const pos of r.positions) {
      for (const ex of existing) {
        const dx  = pos.x - ex.x;
        const dy  = pos.y - ex.y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(minSepPx);
      }
    }
  });

  it('combined set (existing + new) all respect minSeparationM', () => {
    const existing = [{ x: 150, y: 150 }];
    const r        = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS, existing);
    const all      = [...existing, ...r.positions];
    const minSepPx = OPTS.minSeparationM * PPM;
    expect(allPairsAboveSep(all, minSepPx)).toBe(true);
  });

  it('returns no positions when a single existing AP blocks all candidates', () => {
    // Use a huge separation so every candidate is within range of the existing AP
    const existing = [{ x: 300, y: 200 }];
    const opts     = { ...OPTS, minSeparationM: 100, maxAPs: 3 }; // 100 m >> floor
    const r        = computeAutoDeployment(FLOOR, WALLS, PPM, opts, existing);
    expect(r.positions).toHaveLength(0);
  });

  it('existingAPs defaults to empty (backwards-compatible call without 5th arg)', () => {
    // Must not throw and must produce the same result as passing []
    const r1 = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS);
    const r2 = computeAutoDeployment(FLOOR, WALLS, PPM, OPTS, []);
    expect(r1.positions.length).toBe(r2.positions.length);
    expect(r1.achievedCoveragePct).toBeCloseTo(r2.achievedCoveragePct, 10);
  });
});
