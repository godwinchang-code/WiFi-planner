/**
 * TypeScript wrapper around the Rust/WASM propagation engine.
 *
 * With wasm-pack --target bundler + vite-plugin-wasm, the WASM binary is
 * initialised synchronously when this module is first imported – no explicit
 * init() call is required.
 *
 * AP layout   (6 f64s per AP):  [x, y, tx_power_dbm, gain_dbi, freq_ghz, enabled]
 * Wall layout (5 f64s per wall):[x1, y1, x2, y2, attenuation_db]
 */

import type { AccessPoint, Wall, Band } from '../types';
import { BAND_FREQUENCY_GHZ, WALL_CONFIGS } from '../types';
import type { CoverageStats } from '../utils/signalSimulation';

// Named exports only – no default init() with bundler target + vite-plugin-wasm
import {
  compute_heatmap,
  point_rssi,
  init_panic_hook,
} from './pkg/wifi_planner_wasm';

// ─── AP / Wall serialisation ────────────────────────────────────────────────

function buildAPData(accessPoints: AccessPoint[], band: Band): Float64Array {
  const freqGhz = BAND_FREQUENCY_GHZ[band];
  const buf = new Float64Array(accessPoints.length * 6);
  accessPoints.forEach((ap, i) => {
    const base = i * 6;
    buf[base + 0] = ap.x;
    buf[base + 1] = ap.y;
    buf[base + 2] = ap.txPower;
    buf[base + 3] = ap.gain;
    buf[base + 4] = freqGhz;
    buf[base + 5] = ap.enabled ? 1.0 : 0.0;
  });
  return buf;
}

function buildWallData(walls: Wall[]): Float64Array {
  const buf = new Float64Array(walls.length * 5);
  walls.forEach((wall, i) => {
    const base = i * 5;
    buf[base + 0] = wall.x1;
    buf[base + 1] = wall.y1;
    buf[base + 2] = wall.x2;
    buf[base + 3] = wall.y2;
    buf[base + 4] = WALL_CONFIGS[wall.type].attenuation;
  });
  return buf;
}

// ─── Public engine class ─────────────────────────────────────────────────────

export type WasmHeatmapOutput = {
  imageData: ImageData;
  stats: CoverageStats;
};

export class WasmPropagationEngine {
  /** Generate the heatmap RGBA image and coverage statistics via WASM. */
  generateHeatmap(
    width: number,
    height: number,
    resolution: number,
    accessPoints: AccessPoint[],
    walls: Wall[],
    pixelsPerMeter: number,
    band: Band,
  ): WasmHeatmapOutput {
    const apData = buildAPData(accessPoints, band);
    const wallData = buildWallData(walls);

    // Call WASM – returns a HeatmapResult object (Rust struct)
    const result = compute_heatmap(
      width, height, resolution,
      apData, wallData,
      pixelsPerMeter,
    );

    try {
      const cols = result.cols;
      const rows = result.rows;
      const total = result.total_count;

      // Copy pixels out before freeing the Rust object
      const pixelsCopy = new Uint8ClampedArray(result.pixels());

      const stats: CoverageStats = {
        totalCells: total,
        excellentCells: result.excellent_count,
        goodCells: result.good_count,
        fairCells: result.fair_count,
        poorCells: result.poor_count,
        noCoverageCells: result.no_coverage_count,
        excellentPercent: total > 0 ? (result.excellent_count / total) * 100 : 0,
        goodPercent: total > 0 ? (result.good_count / total) * 100 : 0,
        fairPercent: total > 0 ? (result.fair_count / total) * 100 : 0,
        poorPercent: total > 0 ? (result.poor_count / total) * 100 : 0,
        noCoveragePercent: total > 0 ? (result.no_coverage_count / total) * 100 : 0,
        avgRSSI: result.avg_rssi(),
      };

      const imageData = new ImageData(pixelsCopy, cols, rows);
      return { imageData, stats };
    } finally {
      // Explicitly free the Rust-allocated memory (wasm-bindgen exposes .free())
      result.free();
    }
  }

  /** Query the best RSSI at a single canvas point. */
  pointRSSI(
    x: number,
    y: number,
    accessPoints: AccessPoint[],
    walls: Wall[],
    pixelsPerMeter: number,
    band: Band,
  ): number {
    const apData = buildAPData(accessPoints, band);
    const wallData = buildWallData(walls);
    return point_rssi(x, y, apData, wallData, pixelsPerMeter);
  }
}

// ─── Singleton loader ─────────────────────────────────────────────────────────

let engineSingleton: WasmPropagationEngine | null = null;
let initPromise: Promise<WasmPropagationEngine> | null = null;

/**
 * Initialise the WASM module and return the engine singleton.
 * Safe to call multiple times – subsequent calls return the cached promise.
 */
export async function loadWasmEngine(): Promise<WasmPropagationEngine> {
  if (engineSingleton) return engineSingleton;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // With bundler target + vite-plugin-wasm the WASM is already initialised;
    // we only need to wire up the panic hook.
    init_panic_hook();
    engineSingleton = new WasmPropagationEngine();
    return engineSingleton;
  })();

  return initPromise;
}
