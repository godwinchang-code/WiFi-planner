/* tslint:disable */
/* eslint-disable */

/**
 * Result object returned by `compute_heatmap`.
 *
 * JS fields:
 *   .pixels()           → Uint8Array (RGBA, rows × cols × 4)
 *   .cols               → u32
 *   .rows               → u32
 *   .excellent_count    → u32
 *   .good_count         → u32
 *   .fair_count         → u32
 *   .poor_count         → u32
 *   .no_coverage_count  → u32
 *   .total_count        → u32
 *   .avg_rssi()         → f64
 */
export class HeatmapResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Average RSSI across cells that have any signal (−90 dBm floor).
     */
    avg_rssi(): number;
    /**
     * RGBA pixel data for the heatmap (rows × cols × 4 bytes).
     */
    pixels(): Uint8Array;
    cols: number;
    excellent_count: number;
    fair_count: number;
    good_count: number;
    no_coverage_count: number;
    poor_count: number;
    rows: number;
    total_count: number;
}

/**
 * Compute the WiFi signal heatmap.
 *
 * Parameters
 * ----------
 * width, height   – canvas dimensions in pixels
 * resolution      – heatmap cell size in pixels (e.g. 8 → one pixel per 8×8 block)
 * ap_data         – flat f64 array, AP_STRIDE values per AP:
 *                   [x, y, tx_power_dbm, gain_dbi, freq_ghz, enabled(0/1)]
 * wall_data       – flat f64 array, WALL_STRIDE values per wall:
 *                   [x1, y1, x2, y2, attenuation_db]
 * pixels_per_meter – spatial scale
 *
 * Returns
 * -------
 * HeatmapResult containing RGBA pixels + coverage statistics.
 */
export function compute_heatmap(width: number, height: number, resolution: number, ap_data: Float64Array, wall_data: Float64Array, pixels_per_meter: number): HeatmapResult;

export function init_panic_hook(): void;

/**
 * Calculate the best RSSI at a single point across all enabled APs.
 *
 * Parameters match the same layout as `compute_heatmap`.
 * Returns −Infinity (as f64::NEG_INFINITY) if no enabled APs.
 */
export function point_rssi(target_x: number, target_y: number, ap_data: Float64Array, wall_data: Float64Array, pixels_per_meter: number): number;
