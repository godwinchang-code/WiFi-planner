# Signal Propagation Model

WiFi Planner uses an **indoor path-loss model** that combines Free Space Path
Loss (FSPL) with a discrete wall-attenuation term. The same physics are
implemented twice: once in Rust (primary, compiled to WASM) and once in
JavaScript (fallback). Both implementations are covered by unit tests and
produce identical results.

---

## Received Signal Strength (RSSI)

The RSSI at a point **p** from access point **AP** is:

```
RSSI(p) = Tx_Power + Antenna_Gain − FSPL(d, f) − Wall_Attenuation(AP → p)

where
  Tx_Power       [dBm]  AP transmit power (configurable 0–33 dBm)
  Antenna_Gain   [dBi]  AP antenna gain (configurable 0–15 dBi)
  FSPL(d, f)     [dB]   Free Space Path Loss at distance d and frequency f
  Wall_Attenuation[dB]  Sum of attenuations of walls crossed by the ray AP → p
```

The heatmap at each cell shows the **best RSSI** across all enabled APs:

```
BestRSSI(p) = max{ RSSI_i(p)  for all enabled AP_i }
```

---

## Free Space Path Loss (FSPL)

```
FSPL(d, f) = 20·log₁₀(d) + 20·log₁₀(f) + 20·log₁₀(4π/c)

where
  d  distance in metres
  f  frequency in Hz
  c  speed of light = 3×10⁸ m/s
```

The constant term `20·log₁₀(4π/c)` evaluates to approximately **−147.55 dB**,
so for practical frequencies:

| Frequency | FSPL at 1 m | FSPL at 10 m | FSPL at 50 m |
|-----------|------------|-------------|-------------|
| 2.4 GHz   | 40.0 dB    | 60.0 dB     | 74.0 dB     |
| 5.0 GHz   | 46.4 dB    | 66.4 dB     | 80.4 dB     |
| 6.0 GHz   | 48.1 dB    | 68.1 dB     | 82.1 dB     |

FSPL grows by **6 dB** per doubling of distance (inverse-square law in log
scale) and by **6 dB** per octave of frequency.

### Rust implementation

```rust
fn free_space_path_loss(distance_m: f64, freq_ghz: f64) -> f64 {
    if distance_m <= 0.0 { return 0.0; }
    let f = freq_ghz * 1e9_f64;
    let k = 20.0 * (4.0 * std::f64::consts::PI / SPEED_OF_LIGHT).log10();
    20.0 * distance_m.log10() + 20.0 * f.log10() + k
}
```

---

## Wall Attenuation

Each wall segment has a configurable **attenuation value** that is subtracted
from the RSSI whenever the straight-line ray from the AP to the target point
crosses that wall.

| Wall type | Attenuation | Typical scenario |
|-----------|-------------|-----------------|
| Glass | −2 dB | Partitions, interior glass |
| Light wall | −3 dB | Plasterboard, drywall |
| Concrete | −15 dB | Reinforced concrete floors/walls |
| Exterior | −20 dB | Thick brick or masonry exterior |

Multiple walls are additive:

```
Wall_Attenuation(AP → p) = Σ attenuation_i   for each wall i crossed by segment AP→p
```

### Ray–Segment Intersection Test

The intersection check uses the standard parametric line formula. Segment
`(x1,y1)→(x2,y2)` intersects segment `(x3,y3)→(x4,y4)` iff both parameters
`uₐ` and `u_b` lie strictly in `(0, 1)`:

```
denom = (y4−y3)(x2−x1) − (x4−x3)(y2−y1)

uₐ = [(x4−x3)(y1−y3) − (y4−y3)(x1−x3)] / denom
u_b = [(x2−x1)(y1−y3) − (y2−y1)(x1−x3)] / denom

intersects ⟺ 0 < uₐ < 1  AND  0 < u_b < 1
```

Endpoints are excluded (`strict` inequality) to avoid counting a wall that
the AP itself sits directly on.

### Rust implementation

```rust
fn segments_intersect(x1: f64, y1: f64, x2: f64, y2: f64,
                       x3: f64, y3: f64, x4: f64, y4: f64) -> bool {
    let denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if denom.abs() < 1e-10 { return false; }
    let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    ua > 0.0 && ua < 1.0 && ub > 0.0 && ub < 1.0
}
```

---

## Spatial Scale

Canvas coordinates are in **pixels**. The `pixelsPerMeter` setting (default
20 px/m) converts pixel distances to metres for the FSPL formula:

```
distance_m = sqrt((px_target − px_ap)² + (py_target − py_ap)²) / pixelsPerMeter
```

A `pixelsPerMeter` of 20 means the default 1000×700 px canvas represents a
50 m × 35 m space.

---

## Heatmap Generation

The heatmap is computed on a downsampled grid to balance quality and speed.
The `resolution` setting controls the cell size:

| Resolution | Grid cell size | Quality | Speed |
|-----------|---------------|---------|-------|
| 4 px | 4 × 4 px | High | Slower |
| 8 px | 8 × 8 px | Medium (default) | Fast |
| 12 px | 12 × 12 px | Lower | Faster |
| 20 px | 20 × 20 px | Low | Fastest |

After generation the small grid image is bilinearly scaled up to the full
canvas size using the browser's native `ctx.drawImage` with
`imageSmoothingQuality = 'high'`.

**Cell count** (default 1000×700 canvas at resolution 8):
```
cols = ceil(1000 / 8) = 125
rows = ceil(700 / 8)  =  88
cells = 125 × 88      = 11 000
```

With 3 APs and 5 walls, the Rust engine processes 11 000 cells with 3 RSSI
calculations and up to 5 ray–segment tests each — approximately 165 000
intersection tests per frame. The WASM engine completes this in **< 5 ms**
on a modern CPU.

---

## Colour Mapping (RSSI → RGBA)

Signal quality thresholds and colours follow common WiFi survey conventions:

| Quality | RSSI range | Colour | Use case |
|---------|-----------|--------|---------|
| Excellent | ≥ −50 dBm | Green `#00c800` | HD video, VoIP |
| Good | −50 to −60 dBm | Yellow-green `#c8c800` | Web browsing, email |
| Fair | −60 to −70 dBm | Orange `#dc6400` | Basic connectivity |
| Poor | −70 to −80 dBm | Red `#e60000` | Marginal; drops likely |
| No signal | < −80 dBm | Transparent | Out of range |

Alpha blending is used (0.6–0.75 opacity) so the floor plan image remains
visible beneath the heatmap overlay.

### Rust implementation

```rust
fn rssi_to_rgba(rssi: f64) -> (u8, u8, u8, u8) {
    if rssi >= -50.0 { (0, 200, 0, 191) }
    else if rssi >= -60.0 {
        let t = (rssi + 60.0) / 10.0;   // 0→1 across the band
        ((200.0 * (1.0 - t)) as u8, 200, 0, 184)
    }
    else if rssi >= -70.0 {
        let t = (rssi + 70.0) / 10.0;
        (220, (180.0 * t) as u8, 0, 173)
    }
    else if rssi >= -80.0 {
        let t = (rssi + 80.0) / 10.0;
        (230, (80.0 * t) as u8, 0, 153)
    }
    else if rssi >= -90.0 {
        let t = (rssi + 90.0) / 10.0;
        (200, 0, 0, (128.0 * t) as u8)
    }
    else { (0, 0, 0, 0) }
}
```

---

## Limitations and Known Approximations

| Limitation | Impact |
|-----------|--------|
| **2D model only** — no floor-to-floor attenuation | Multi-floor buildings require one plan per floor |
| **Omnidirectional antenna assumed** — no beam patterns | Directional APs (panels, Yagi) will show wider coverage than reality |
| **No multipath / reflection** — only line-of-sight + wall absorption | Coverage near reflective surfaces may be optimistic |
| **Single wall crossing** — no partial-crossing angle correction | Oblique-angle wall crossings underestimate attenuation slightly |
| **No interference model** — co-channel interference not simulated | Use the channel assignment display only as a guide |

For professional RF planning, use dedicated tools (Ekahau, iBwave) that
incorporate full 3D ray-tracing, vendor-specific AP antenna patterns, and
measured building material databases.
