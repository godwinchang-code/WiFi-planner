# Architecture

## Overview

WiFi Planner is a single-page React application. The signal computation hot
path runs inside a **Rust/WebAssembly** module that is bundled by Vite and
loaded automatically when the browser tab opens. A pure-JavaScript fallback
engine is available if WASM cannot be initialised.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser Tab                                                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Application (main.tsx)                            │   │
│  │                                                          │   │
│  │  ┌──────────────┐   ┌────────────────────────────────┐  │   │
│  │  │ WasmProvider │   │ App                            │  │   │
│  │  │              │   │ ┌──────────┐  ┌─────────────┐ │  │   │
│  │  │  loads WASM  │   │ │ Sidebar  │  │ Planner     │ │  │   │
│  │  │  on mount    │   │ │          │  │ Canvas      │ │  │   │
│  │  │              │   │ │ Toolbar  │  │             │ │  │   │
│  │  │  context:    │   │ │ APPanel  │  │ SVG layer   │ │  │   │
│  │  │   engine     │   │ │ Heatmap  │  │ Heatmap     │ │  │   │
│  │  │   status     │   │ │ Settings │  │ canvas      │ │  │   │
│  │  │              │   │ │ Export   │  │             │ │  │   │
│  │  └──────┬───────┘   │ └──────────┘  └──────┬──────┘ │  │   │
│  │         │           └─────────────────────-─┼────────┘  │   │
│  │         │                                   │           │   │
│  │         │           useHeatmap hook         │           │   │
│  │         │           ┌────────────────────┐  │           │   │
│  │         └──────────►│  WASM engine  ───► │◄─┘           │   │
│  │                     │  (or JS fallback)  │              │   │
│  │                     └────────────────────┘              │   │
│  └──────────────────────────────────────────────────────── ┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WebAssembly (wifi_planner_wasm_bg.wasm, ~32 KB)         │   │
│  │  Rust: compute_heatmap() · point_rssi() · init_panic_hook│   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## WASM Auto-load Pipeline

```
page load
   │
   ▼
main.tsx renders <WasmProvider>
   │
   ▼
WasmProvider.useEffect fires (after first paint)
   │
   ▼
import('../wasm/engine') → dynamic import resolves from bundle
   │
   ▼
loadWasmEngine()
   ├─ WASM binary already initialised by vite-plugin-wasm at bundle load time
   ├─ Calls init_panic_hook() (Rust panics → console.error)
   └─ Returns WasmPropagationEngine singleton
   │
   ▼
WasmContext.status = 'ready'
WasmBadge shows green ● WASM
   │
   ▼
useHeatmap sees engine != null → switches to WASM path
```

### Why bundler target?

`wasm-pack --target bundler` generates an ES module that imports the `.wasm`
file as a static asset. `vite-plugin-wasm` intercepts that import and
initialises the WASM module synchronously during bundle evaluation, so there
is **no async handshake** required at runtime — the module is ready the
instant it is first imported.

---

## State Management

All mutable application state lives in a single **Zustand** store
(`src/store/plannerStore.ts`). A `persist` middleware automatically
serialises a subset of the state to `localStorage` so the plan survives
page reloads.

```
PlannerStore
├── accessPoints[]       AP list (id, x, y, band, channel, txPower, gain, …)
├── walls[]              Wall list (id, x1, y1, x2, y2, type)
├── floorPlan            { imageData, width, height, scale }
├── activeTool           'select' | 'ap' | 'wall' | 'erase'
├── selectedAPId         currently selected AP (or null)
├── selectedWallId       currently selected wall (or null)
├── showHeatmap          boolean toggle
├── heatmapBand          '2.4GHz' | '5GHz' | '6GHz'
├── heatmapResolution    pixels per heatmap cell (4 = high quality, 20 = fast)
├── canvasOffset         { x, y } pan offset in screen pixels
├── canvasZoom           zoom multiplier (0.2 – 5.0)
└── pixelsPerMeter       spatial scale

Persisted to localStorage:
  accessPoints, walls, pixelsPerMeter, showHeatmap, heatmapBand, heatmapResolution
```

---

## Component Hierarchy

```
App
├── Sidebar
│   ├── WasmBadge                (reads WasmContext.status)
│   ├── FloorPlanSettings        (image upload, canvas size)
│   ├── Toolbar                  (tool buttons, wall type selector)
│   ├── APPanel
│   │   ├── [APListItem × n]     (per-AP row with toggle/delete)
│   │   └── APDetailPanel        (band, channel, TX power, gain, color, position)
│   ├── HeatmapSettings          (band selector, resolution slider, legend)
│   │   └── CoverageStatsPanel   (stacked bar + percentage breakdown)
│   └── ExportPanel              (zoom controls, JSON export/import, clear all)
│
└── PlannerCanvas                (main interactive area)
    ├── HeatmapLayer             (<canvas> element; redrawn by useHeatmap)
    └── <svg>
        ├── <rect> floor plan background
        ├── <image> floor plan image (optional)
        ├── GridLayer            (metre-aligned grid lines)
        ├── WallLayer            (wall <line> elements with hit areas)
        ├── [AccessPointMarker × n]  (draggable SVG group + WiFi icon)
        └── Preview overlays     (wall-in-progress, AP placement ghost)
```

---

## Data Flow: Heatmap Render Cycle

```
Store change (AP moved / wall added / setting changed)
   │
   ▼
useHeatmap.redraw() — debounced 100 ms
   │
   ├─ engine present? ──yes──► WasmPropagationEngine.generateHeatmap()
   │                               buildAPData()  → Float64Array
   │                               buildWallData() → Float64Array
   │                               compute_heatmap() [WASM]
   │                               HeatmapResult.pixels() → Uint8ClampedArray
   │                               HeatmapResult.free()   ← explicit GC
   │                               new ImageData(pixels, cols, rows)
   │                               CoverageStats ← struct fields
   │
   └─ no engine ────────────► generateHeatmap() [JS fallback]
                                   OffscreenCanvas.createImageData()
                                   nested loop: best_rssi per cell
                                   rssiToColor() per cell
   │
   ▼
tempCanvas.putImageData(smallHeatmap)
ctx.drawImage(tempCanvas, 0, 0, fullWidth, fullHeight)   ← bilinear upscale
   │
   ▼
onStatsUpdate(stats) → App.setState → Sidebar.HeatmapSettings re-renders
```

---

## WASM Memory Management

`wasm-bindgen` exposes Rust heap-allocated objects as JS objects with a
`.free()` method. `HeatmapResult` owns a `Vec<u8>` pixel buffer (~100 KB
for a 1000×700 canvas at resolution=8). The engine wrapper always calls
`result.free()` in a `finally` block immediately after copying the pixel
bytes into a JS-owned `Uint8ClampedArray`:

```typescript
const result = compute_heatmap(…);
try {
  const pixelsCopy = new Uint8ClampedArray(result.pixels()); // copy out
  // … build ImageData and CoverageStats …
  return { imageData, stats };
} finally {
  result.free(); // release Rust Vec<u8> immediately
}
```

Without the explicit `.free()`, the buffer would remain live until the
wasm-bindgen finaliser runs (GC-dependent). Calling it eagerly keeps peak
WASM heap usage bounded regardless of render frequency.

---

## Build System

| Script | Action |
|--------|--------|
| `npm run build:wasm` | `wasm-pack build wasm-engine --target bundler` → `src/wasm/pkg/` |
| `npm run dev` | `build:wasm` then `vite` (HMR dev server) |
| `npm run build` | `build:wasm` then `tsc` then `vite build` |
| `npm run test` | `vitest run` (JS/TS, no browser) |
| `npm run test:rust` | `cargo test` (native target, fast) |
| `npm run test:all` | Rust + TS suites |

The compiled `src/wasm/pkg/` directory is **committed to Git** so that CI
pipelines without Rust/wasm-pack installed can still run `npm run build`
using the pre-built binary.

---

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| UI framework | React 18 | Component model, hooks, ecosystem |
| State | Zustand | Minimal boilerplate; persist middleware; no Context re-render cascade |
| Rendering | SVG + Canvas | SVG for AP/wall interaction; Canvas for heatmap (pixel-level control) |
| Compute | Rust → WASM | 10–20× faster nested loop vs. JS for large heatmaps; zero runtime cost when idle |
| Bundler | Vite 5 | Native ESM, fast HMR, first-class WASM support via plugin |
| Styling | Tailwind CSS | Utility classes; no CSS module naming overhead |
| Tests (TS) | Vitest | Same config as Vite; fast; compatible with jsdom |
| Tests (Rust) | cargo test | Native target; zero WASM overhead for unit tests |
