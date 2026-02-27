use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Panic hook – gives useful error messages in the browser console
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEED_OF_LIGHT: f64 = 3e8_f64; // m/s

// AP data stride: [x, y, tx_power_dbm, gain_dbi, freq_ghz, enabled(0/1)]
const AP_STRIDE: usize = 6;

// Wall data stride: [x1, y1, x2, y2, attenuation_db]
const WALL_STRIDE: usize = 5;

// ---------------------------------------------------------------------------
// Physics: Free Space Path Loss (FSPL)
// ---------------------------------------------------------------------------

/// FSPL(dB) = 20·log10(d) + 20·log10(f) + 20·log10(4π/c)
#[inline]
fn free_space_path_loss(distance_m: f64, freq_ghz: f64) -> f64 {
    if distance_m <= 0.0 {
        return 0.0;
    }
    let f = freq_ghz * 1e9_f64;
    let k = 20.0_f64 * (4.0 * std::f64::consts::PI / SPEED_OF_LIGHT).log10();
    20.0 * distance_m.log10() + 20.0 * f.log10() + k
}

// ---------------------------------------------------------------------------
// Geometry: line segment intersection
// ---------------------------------------------------------------------------

/// Returns true if segment (x1,y1)-(x2,y2) intersects (x3,y3)-(x4,y4)
/// (endpoints excluded to avoid counting walls the AP sits on)
#[inline]
fn segments_intersect(
    x1: f64, y1: f64, x2: f64, y2: f64,
    x3: f64, y3: f64, x4: f64, y4: f64,
) -> bool {
    let denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if denom.abs() < 1e-10 {
        return false; // parallel
    }
    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    ua > 0.0 && ua < 1.0 && ub > 0.0 && ub < 1.0
}

// ---------------------------------------------------------------------------
// Signal computation helpers
// ---------------------------------------------------------------------------

/// Total dB attenuation from all walls that the ray AP→target passes through
#[inline]
fn wall_attenuation(ap_x: f64, ap_y: f64, target_x: f64, target_y: f64, walls: &[f64]) -> f64 {
    let mut total = 0.0_f64;
    for chunk in walls.chunks(WALL_STRIDE) {
        if chunk.len() < WALL_STRIDE {
            break;
        }
        if segments_intersect(
            ap_x, ap_y, target_x, target_y,
            chunk[0], chunk[1], chunk[2], chunk[3],
        ) {
            total += chunk[4]; // attenuation_db
        }
    }
    total
}

/// RSSI at (target_x, target_y) for a single AP.
/// ap = [x, y, tx_power_dbm, gain_dbi, freq_ghz, enabled]
#[inline]
fn rssi_for_ap(ap: &[f64], target_x: f64, target_y: f64, pixels_per_meter: f64, walls: &[f64]) -> f64 {
    let (ap_x, ap_y, tx_power, gain, freq_ghz) = (ap[0], ap[1], ap[2], ap[3], ap[4]);

    let dx = target_x - ap_x;
    let dy = target_y - ap_y;
    let dist_px = (dx * dx + dy * dy).sqrt();
    let dist_m = dist_px / pixels_per_meter;

    if dist_m < 0.01 {
        return tx_power + gain;
    }

    let fspl = free_space_path_loss(dist_m, freq_ghz);
    let wall_att = wall_attenuation(ap_x, ap_y, target_x, target_y, walls);
    tx_power + gain - fspl - wall_att
}

/// Best RSSI across all enabled APs at a point
#[inline]
fn best_rssi(target_x: f64, target_y: f64, aps: &[f64], walls: &[f64], pixels_per_meter: f64) -> f64 {
    let mut best = f64::NEG_INFINITY;
    for ap in aps.chunks(AP_STRIDE) {
        if ap.len() < AP_STRIDE {
            break;
        }
        if ap[5] < 0.5 {
            // disabled
            continue;
        }
        let r = rssi_for_ap(ap, target_x, target_y, pixels_per_meter, walls);
        if r > best {
            best = r;
        }
    }
    best
}

// ---------------------------------------------------------------------------
// Colour mapping – RSSI → RGBA
// ---------------------------------------------------------------------------

/// Maps RSSI (dBm) to RGBA bytes matching the JS reference implementation.
#[inline]
fn rssi_to_rgba(rssi: f64) -> (u8, u8, u8, u8) {
    const EXCELLENT: f64 = -50.0;
    const GOOD: f64 = -60.0;
    const FAIR: f64 = -70.0;
    const POOR: f64 = -80.0;
    const NONE: f64 = -90.0;

    if rssi >= EXCELLENT {
        (0, 200, 0, 191)
    } else if rssi >= GOOD {
        let t = (rssi - GOOD) / (EXCELLENT - GOOD);
        (((200.0 * (1.0 - t)) as u8), 200, 0, 184)
    } else if rssi >= FAIR {
        let t = (rssi - FAIR) / (GOOD - FAIR);
        (220, (180.0 * t) as u8, 0, 173)
    } else if rssi >= POOR {
        let t = (rssi - POOR) / (FAIR - POOR);
        (230, (80.0 * t) as u8, 0, 153)
    } else if rssi >= NONE {
        let t = (rssi - NONE) / (POOR - NONE);
        (200, 0, 0, (128.0 * t) as u8)
    } else {
        (0, 0, 0, 0)
    }
}

/// Signal quality bucket for stats
#[inline]
fn signal_bucket(rssi: f64) -> u8 {
    // 0=none, 1=poor, 2=fair, 3=good, 4=excellent
    if rssi >= -50.0 { 4 }
    else if rssi >= -60.0 { 3 }
    else if rssi >= -70.0 { 2 }
    else if rssi >= -80.0 { 1 }
    else { 0 }
}

// ---------------------------------------------------------------------------
// Public WASM API
// ---------------------------------------------------------------------------

/// Result object returned by `compute_heatmap`.
///
/// JS fields:
///   .pixels()           → Uint8Array (RGBA, rows × cols × 4)
///   .cols               → u32
///   .rows               → u32
///   .excellent_count    → u32
///   .good_count         → u32
///   .fair_count         → u32
///   .poor_count         → u32
///   .no_coverage_count  → u32
///   .total_count        → u32
///   .avg_rssi()         → f64
#[wasm_bindgen]
pub struct HeatmapResult {
    pixels: Vec<u8>,
    pub cols: u32,
    pub rows: u32,
    pub excellent_count: u32,
    pub good_count: u32,
    pub fair_count: u32,
    pub poor_count: u32,
    pub no_coverage_count: u32,
    pub total_count: u32,
    rssi_sum: f64,
    rssi_non_zero_count: u32,
}

#[wasm_bindgen]
impl HeatmapResult {
    /// RGBA pixel data for the heatmap (rows × cols × 4 bytes).
    pub fn pixels(&self) -> Vec<u8> {
        self.pixels.clone()
    }

    /// Average RSSI across cells that have any signal (−90 dBm floor).
    pub fn avg_rssi(&self) -> f64 {
        if self.rssi_non_zero_count > 0 {
            self.rssi_sum / self.rssi_non_zero_count as f64
        } else {
            -90.0
        }
    }
}

/// Compute the WiFi signal heatmap.
///
/// Parameters
/// ----------
/// width, height   – canvas dimensions in pixels
/// resolution      – heatmap cell size in pixels (e.g. 8 → one pixel per 8×8 block)
/// ap_data         – flat f64 array, AP_STRIDE values per AP:
///                   [x, y, tx_power_dbm, gain_dbi, freq_ghz, enabled(0/1)]
/// wall_data       – flat f64 array, WALL_STRIDE values per wall:
///                   [x1, y1, x2, y2, attenuation_db]
/// pixels_per_meter – spatial scale
///
/// Returns
/// -------
/// HeatmapResult containing RGBA pixels + coverage statistics.
#[wasm_bindgen]
pub fn compute_heatmap(
    width: u32,
    height: u32,
    resolution: u32,
    ap_data: &[f64],
    wall_data: &[f64],
    pixels_per_meter: f64,
) -> HeatmapResult {
    let res = resolution as f64;
    let cols = ((width as f64) / res).ceil() as u32;
    let rows = ((height as f64) / res).ceil() as u32;
    let n_cells = (cols * rows) as usize;

    let mut pixels = vec![0u8; n_cells * 4];
    let mut excellent_count = 0u32;
    let mut good_count = 0u32;
    let mut fair_count = 0u32;
    let mut poor_count = 0u32;
    let mut no_coverage_count = 0u32;
    let mut rssi_sum = 0.0_f64;
    let mut rssi_non_zero_count = 0u32;

    // Check that we have at least one enabled AP
    let has_enabled_ap = ap_data
        .chunks(AP_STRIDE)
        .any(|ap| ap.len() >= AP_STRIDE && ap[5] >= 0.5);

    if !has_enabled_ap {
        return HeatmapResult {
            pixels,
            cols,
            rows,
            excellent_count,
            good_count,
            fair_count,
            poor_count,
            no_coverage_count: (cols * rows),
            total_count: (cols * rows),
            rssi_sum,
            rssi_non_zero_count,
        };
    }

    for row in 0..rows {
        for col in 0..cols {
            let px = (col as f64 + 0.5) * res;
            let py = (row as f64 + 0.5) * res;

            let rssi = best_rssi(px, py, ap_data, wall_data, pixels_per_meter);
            let (r, g, b, a) = rssi_to_rgba(rssi);

            let idx = ((row * cols + col) as usize) * 4;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = a;

            match signal_bucket(rssi) {
                4 => excellent_count += 1,
                3 => good_count += 1,
                2 => fair_count += 1,
                1 => poor_count += 1,
                _ => no_coverage_count += 1,
            }

            if rssi > -90.0 {
                rssi_sum += rssi;
                rssi_non_zero_count += 1;
            }
        }
    }

    HeatmapResult {
        pixels,
        cols,
        rows,
        excellent_count,
        good_count,
        fair_count,
        poor_count,
        no_coverage_count,
        total_count: cols * rows,
        rssi_sum,
        rssi_non_zero_count,
    }
}

/// Calculate the best RSSI at a single point across all enabled APs.
///
/// Parameters match the same layout as `compute_heatmap`.
/// Returns −Infinity (as f64::NEG_INFINITY) if no enabled APs.
#[wasm_bindgen]
pub fn point_rssi(
    target_x: f64,
    target_y: f64,
    ap_data: &[f64],
    wall_data: &[f64],
    pixels_per_meter: f64,
) -> f64 {
    best_rssi(target_x, target_y, ap_data, wall_data, pixels_per_meter)
}

// ---------------------------------------------------------------------------
// Unit tests (native, not wasm-bindgen-test)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // ---- FSPL ---------------------------------------------------------------

    #[test]
    fn fspl_positive_for_nonzero_distance() {
        let loss = free_space_path_loss(10.0, 2.437);
        assert!(loss > 0.0, "FSPL should be positive, got {loss}");
    }

    #[test]
    fn fspl_zero_for_zero_distance() {
        assert_eq!(free_space_path_loss(0.0, 2.437), 0.0);
    }

    #[test]
    fn fspl_increases_with_distance() {
        let d1 = free_space_path_loss(1.0, 2.437);
        let d10 = free_space_path_loss(10.0, 2.437);
        assert!(d10 > d1, "FSPL should increase with distance");
    }

    #[test]
    fn fspl_increases_with_frequency() {
        let f24 = free_space_path_loss(10.0, 2.437);
        let f5 = free_space_path_loss(10.0, 5.5);
        assert!(f5 > f24, "5 GHz should have higher path loss than 2.4 GHz");
    }

    #[test]
    fn fspl_1m_2_4ghz_approx_40db() {
        let loss = free_space_path_loss(1.0, 2.437);
        // Expected ≈ 40 dB
        assert!(loss > 35.0 && loss < 45.0, "FSPL at 1m/2.4GHz expected ~40dB, got {loss}");
    }

    // ---- Segment intersection -----------------------------------------------

    #[test]
    fn segments_do_intersect() {
        // Cross at (1,1)
        assert!(segments_intersect(0.0, 0.0, 2.0, 2.0, 0.0, 2.0, 2.0, 0.0));
    }

    #[test]
    fn parallel_segments_do_not_intersect() {
        assert!(!segments_intersect(0.0, 0.0, 2.0, 0.0, 0.0, 1.0, 2.0, 1.0));
    }

    #[test]
    fn non_crossing_segments_do_not_intersect() {
        assert!(!segments_intersect(0.0, 0.0, 1.0, 0.0, 2.0, 0.0, 3.0, 0.0));
    }

    #[test]
    fn wall_blocks_signal_correctly() {
        // AP at origin, target at (200, 0), wall at x=100 (vertical)
        let walls = [100.0_f64, -50.0, 100.0, 50.0, 15.0]; // concrete-like
        let att = wall_attenuation(0.0, 0.0, 200.0, 0.0, &walls);
        assert_eq!(att, 15.0, "Wall attenuation should be 15 dB");
    }

    #[test]
    fn wall_does_not_block_perpendicular_path() {
        // AP at (0, 0), target at (0, 200) — wall is horizontal and doesn't cross the vertical ray
        let walls = [50.0_f64, 100.0, 150.0, 100.0, 15.0];
        let att = wall_attenuation(0.0, 0.0, 0.0, 200.0, &walls);
        assert_eq!(att, 0.0, "Wall should not attenuate perpendicular path");
    }

    // ---- RSSI ---------------------------------------------------------------

    #[test]
    fn rssi_decreases_with_distance() {
        let ap = [0.0_f64, 0.0, 20.0, 2.0, 2.437, 1.0];
        let near = rssi_for_ap(&ap, 20.0, 0.0, 20.0, &[]);   // 1 m
        let far = rssi_for_ap(&ap, 200.0, 0.0, 20.0, &[]);   // 10 m
        let vfar = rssi_for_ap(&ap, 1000.0, 0.0, 20.0, &[]); // 50 m
        assert!(near > far, "Signal should decrease with distance (near > far)");
        assert!(far > vfar, "Signal should decrease with distance (far > vfar)");
    }

    #[test]
    fn rssi_wall_reduces_signal() {
        let ap = [0.0_f64, 0.0, 20.0, 2.0, 2.437, 1.0];
        let walls = [100.0_f64, -50.0, 100.0, 50.0, 15.0];
        let no_wall = rssi_for_ap(&ap, 200.0, 0.0, 20.0, &[]);
        let with_wall = rssi_for_ap(&ap, 200.0, 0.0, 20.0, &walls);
        assert!(no_wall > with_wall, "Wall should reduce signal strength");
        assert!((no_wall - with_wall - 15.0).abs() < 0.001, "Exactly 15 dB attenuation expected");
    }

    #[test]
    fn rssi_disabled_ap_ignored() {
        let aps = [
            0.0_f64, 0.0, 20.0, 2.0, 2.437, 0.0, // disabled
        ];
        let r = best_rssi(10.0, 0.0, &aps, &[], 20.0);
        assert!(r.is_infinite() && r < 0.0, "Disabled AP should return NEG_INFINITY");
    }

    #[test]
    fn rssi_picks_best_of_multiple_aps() {
        let aps = [
            0.0_f64, 0.0, 20.0, 2.0, 2.437, 1.0,    // near AP
            10000.0, 0.0, 20.0, 2.0, 2.437, 1.0,     // far AP
        ];
        let point = (20.0_f64, 0.0_f64);
        let rssi = best_rssi(point.0, point.1, &aps, &[], 20.0);
        let near_only = rssi_for_ap(&aps[..AP_STRIDE], point.0, point.1, 20.0, &[]);
        assert!((rssi - near_only).abs() < 0.001, "Best RSSI should come from nearest AP");
    }

    // ---- Colour mapping -----------------------------------------------------

    #[test]
    fn excellent_signal_is_green() {
        let (r, g, _b, a) = rssi_to_rgba(-45.0);
        assert_eq!((r, g, a), (0, 200, 191));
    }

    #[test]
    fn no_coverage_is_transparent() {
        let (_r, _g, _b, a) = rssi_to_rgba(-100.0);
        assert_eq!(a, 0, "Signal below -90 should be fully transparent");
    }

    // ---- compute_heatmap ----------------------------------------------------

    #[test]
    fn heatmap_returns_correct_dimensions() {
        let aps = [250.0_f64, 175.0, 20.0, 2.0, 2.437, 1.0];
        let result = compute_heatmap(500, 350, 10, &aps, &[], 20.0);
        assert_eq!(result.cols, 50);
        assert_eq!(result.rows, 35);
        assert_eq!(result.pixels().len(), 50 * 35 * 4);
    }

    #[test]
    fn heatmap_total_equals_cells() {
        let aps = [250.0_f64, 175.0, 20.0, 2.0, 2.437, 1.0];
        let result = compute_heatmap(500, 350, 10, &aps, &[], 20.0);
        assert_eq!(
            result.total_count,
            result.excellent_count + result.good_count +
            result.fair_count + result.poor_count + result.no_coverage_count
        );
    }

    #[test]
    fn heatmap_no_aps_all_no_coverage() {
        let result = compute_heatmap(100, 100, 10, &[], &[], 20.0);
        assert_eq!(result.no_coverage_count, result.total_count);
        assert_eq!(result.excellent_count, 0);
    }

    #[test]
    fn heatmap_nearby_ap_has_excellent_cells() {
        let aps = [50.0_f64, 50.0, 30.0, 5.0, 2.437, 1.0]; // powerful AP at centre
        let result = compute_heatmap(100, 100, 10, &aps, &[], 20.0);
        assert!(result.excellent_count > 0, "Powerful close AP should produce excellent cells");
    }

    #[test]
    fn point_rssi_api() {
        let aps = [0.0_f64, 0.0, 20.0, 2.0, 2.437, 1.0];
        let rssi = point_rssi(20.0, 0.0, &aps, &[], 20.0);
        assert!(rssi.is_finite() && rssi > -100.0, "point_rssi should return a finite value");
    }
}
