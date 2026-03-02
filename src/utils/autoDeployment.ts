/**
 * AP Auto-Deployment — Greedy Set-Cover Algorithm
 *
 * Algorithm overview:
 *   1. Build a grid of evaluation sample points over the floor plan.
 *   2. Build a grid of candidate AP positions (coarser grid).
 *   3. For each candidate position compute which sample points it
 *      covers at ≥ targetRSSI using the existing JS signal model.
 *   4. Greedy loop: repeatedly pick the candidate that covers the
 *      most currently-uncovered samples, subject to a minimum
 *      separation constraint from ALL APs (existing + already placed).
 *   5. Stop when targetCoveragePct is reached or maxAPs is placed.
 *
 * Uses the pure-JS signal simulation path (no WASM) so it can run
 * synchronously without async complexity.
 */

import type { Wall, DeploymentOptions, DeploymentResult } from '../types';
import { calculateRSSI } from './signalSimulation';
import type { AccessPoint } from '../types';

// Dummy AP template for coverage evaluation — real id/name/color added later
function makeDummyAP(x: number, y: number, opts: DeploymentOptions): AccessPoint {
  return {
    id: '__dummy__',
    x,
    y,
    name: '',
    band: opts.band,
    channel: 1,
    txPower: opts.txPower,
    gain: opts.gain,
    enabled: true,
    color: '#000',
  };
}

/**
 * Compute the set of sample-point indices that a candidate AP at (cx, cy)
 * can cover at ≥ targetRSSI, given existing walls.
 */
function computeCoverageSet(
  cx: number,
  cy: number,
  samplePoints: Array<{ x: number; y: number }>,
  walls: Wall[],
  pixelsPerMeter: number,
  opts: DeploymentOptions,
): Set<number> {
  const ap = makeDummyAP(cx, cy, opts);
  const covered = new Set<number>();

  for (let i = 0; i < samplePoints.length; i++) {
    const { x, y } = samplePoints[i];
    const rssi = calculateRSSI(ap, x, y, pixelsPerMeter, walls, opts.band);
    if (rssi >= opts.targetRSSI) {
      covered.add(i);
    }
  }

  return covered;
}

/**
 * Distance between two points in pixels.
 */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * Main entry point: compute optimal AP placement using a greedy
 * set-cover algorithm.
 *
 * @param floorPlan      Canvas dimensions in pixels
 * @param walls          Existing walls (used for signal attenuation)
 * @param pixelsPerMeter Scale factor
 * @param options        Deployment parameters
 * @param existingAPs    APs already on the plan — their positions are treated
 *                       as occupied and respected by the minimum-separation
 *                       constraint so newly suggested APs never land too close
 *                       to an AP that already exists.
 * @returns              Suggested AP positions + coverage statistics
 */
export function computeAutoDeployment(
  floorPlan: { width: number; height: number },
  walls: Wall[],
  pixelsPerMeter: number,
  options: DeploymentOptions,
  existingAPs: Array<{ x: number; y: number }> = [],
): DeploymentResult {
  const { width, height } = floorPlan;
  const {
    minSeparationM,
    targetCoveragePct,
    maxAPs,
  } = options;

  const minSepPx = minSeparationM * pixelsPerMeter;

  // ── Step 1: evaluation sample grid (every ~2 m)
  const evalStep = Math.max(20, Math.round(2 * pixelsPerMeter));
  const samplePoints: Array<{ x: number; y: number }> = [];

  for (let y = evalStep / 2; y < height; y += evalStep) {
    for (let x = evalStep / 2; x < width; x += evalStep) {
      samplePoints.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  const totalSamples = samplePoints.length;
  if (totalSamples === 0) {
    return { positions: [], achievedCoveragePct: 0, uncoveredPct: 1 };
  }

  // ── Step 2: candidate placement grid (every ~3 m)
  const candStep = Math.max(30, Math.round(3 * pixelsPerMeter));
  const candidates: Array<{ x: number; y: number }> = [];

  for (let y = candStep / 2; y < height; y += candStep) {
    for (let x = candStep / 2; x < width; x += candStep) {
      candidates.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  // ── Step 3: precompute coverage sets for each candidate
  const coverageSets = candidates.map(c =>
    computeCoverageSet(c.x, c.y, samplePoints, walls, pixelsPerMeter, options),
  );

  // ── Step 4: greedy placement loop
  const uncovered = new Set<number>(Array.from({ length: totalSamples }, (_, i) => i));
  const placed: Array<{ x: number; y: number }> = [];
  const usedCandIdx = new Set<number>();

  // All occupied positions: existing APs seed the separation check from the
  // very first iteration, so new suggestions cannot cluster around them.
  const occupied: Array<{ x: number; y: number }> = [...existingAPs];

  while (placed.length < maxAPs && uncovered.size > 0) {
    let bestIdx = -1;
    let bestGain = 0;

    for (let i = 0; i < candidates.length; i++) {
      if (usedCandIdx.has(i)) continue;

      // Enforce minimum separation from ALL occupied positions
      // (existing APs on the plan + APs placed in this run).
      const tooClose = occupied.some(p =>
        dist(candidates[i].x, candidates[i].y, p.x, p.y) < minSepPx,
      );
      if (tooClose) continue;

      // Count how many uncovered samples this candidate covers
      let gain = 0;
      for (const idx of coverageSets[i]) {
        if (uncovered.has(idx)) gain++;
      }

      if (gain > bestGain) {
        bestGain = gain;
        bestIdx = i;
      }
    }

    // No candidate improves coverage (all blocked by separation or zero gain)
    if (bestIdx === -1 || bestGain === 0) break;

    const chosen = candidates[bestIdx];
    placed.push({ x: chosen.x, y: chosen.y });
    occupied.push({ x: chosen.x, y: chosen.y }); // register for future iterations
    usedCandIdx.add(bestIdx);

    // Remove covered samples
    for (const idx of coverageSets[bestIdx]) {
      uncovered.delete(idx);
    }

    // Check target
    const coveredSoFar = (totalSamples - uncovered.size) / totalSamples;
    if (coveredSoFar >= targetCoveragePct) break;
  }

  const coveredCount = totalSamples - uncovered.size;
  const achievedCoveragePct = totalSamples > 0 ? coveredCount / totalSamples : 0;

  return {
    positions: placed,
    achievedCoveragePct,
    uncoveredPct: 1 - achievedCoveragePct,
  };
}
