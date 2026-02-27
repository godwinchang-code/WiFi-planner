# WiFi Planner

A browser-based WiFi network coverage planning tool. Place access points on a floor plan, draw walls and obstacles, and see a real-time signal strength heatmap powered by a **Rust/WebAssembly** propagation engine.

![Overview](docs/screenshots/01-overview.svg)

---

## Features

| Feature | Detail |
|---------|--------|
| **Rust/WASM engine** | Signal propagation computed in WebAssembly (auto-loaded on page open) |
| **Real-time heatmap** | FSPL + wall attenuation model; updates as you place APs |
| **Multi-band support** | 2.4 GHz, 5 GHz, 6 GHz per AP |
| **Wall types** | Light (−3 dB), Glass (−2 dB), Concrete (−15 dB), Exterior (−20 dB) |
| **AP configuration** | Name, band, channel, TX power (0–33 dBm), antenna gain |
| **Floor plan upload** | PNG / JPG / SVG background image |
| **Coverage statistics** | Per-tier breakdown (Excellent / Good / Fair / Poor) + avg RSSI |
| **Export / Import** | Save and restore plans as JSON |
| **Pan & Zoom** | Scroll to zoom, middle-click drag to pan |
| **Persistent state** | Plan auto-saved to `localStorage` |

---

## Screenshots

| | |
|---|---|
| ![Heatmap](docs/screenshots/02-heatmap-coverage.svg) | ![AP config](docs/screenshots/03-ap-configuration.svg) |
| _Coverage heatmap across a multi-room floor plan_ | _Per-access-point configuration panel_ |
| ![Walls](docs/screenshots/04-wall-drawing.svg) | ![Stats](docs/screenshots/05-coverage-statistics.svg) |
| _Wall drawing with selectable attenuation types_ | _Coverage statistics and signal legend_ |

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥ 18 | JavaScript runtime + npm |
| **Rust** | ≥ 1.70 (stable) | Compile the WASM engine |
| **wasm-pack** | ≥ 0.12 | Build Rust → WebAssembly |

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

### Install wasm-pack

```bash
cargo install wasm-pack
# or
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/godwinchang-code/WiFi-planner.git
cd WiFi-planner

# 2. Install JavaScript dependencies
npm install

# 3. Build the Rust/WASM engine
npm run build:wasm
```

The `build:wasm` step compiles `wasm-engine/` with wasm-pack and writes the
output to `src/wasm/pkg/`. The compiled `.wasm` binary (~32 KB) is also
committed to the repository so CI environments without Rust/wasm-pack can
skip this step.

---

## Running in Development

```bash
npm run dev
```

This rebuilds the WASM engine (if sources changed) then starts the Vite dev
server at `http://localhost:5173`.

The WASM engine is loaded automatically when the browser tab opens. A green
**WASM** badge in the top-left corner of the sidebar confirms it is active.

---

## Building for Production

```bash
npm run build        # compiles WASM + TypeScript, then bundles with Vite
npm run preview      # serve the dist/ folder locally
```

Output is written to `dist/`. The `.wasm` file is included as a hashed asset
by `vite-plugin-wasm` and served with the correct `application/wasm` MIME type.

---

## Running Tests

### TypeScript / JavaScript tests (Vitest)

```bash
npm test              # run once
npm run test:watch    # watch mode
```

### Rust unit tests (native target)

```bash
npm run test:rust
# or directly:
cd wasm-engine && cargo test
```

### All tests

```bash
npm run test:all      # Rust (21 tests) + TS (56 tests)
```

Current totals: **77 tests, all passing**.

---

## Project Structure

```
WiFi-planner/
├── wasm-engine/                   # Rust crate → WebAssembly
│   ├── Cargo.toml
│   └── src/lib.rs                 # Propagation engine + 21 unit tests
│
├── src/
│   ├── main.tsx                   # App entry – mounts WasmProvider
│   ├── App.tsx
│   │
│   ├── wasm/
│   │   ├── engine.ts              # TypeScript wrapper around WASM functions
│   │   └── pkg/                   # wasm-pack output (committed)
│   │       ├── wifi_planner_wasm_bg.wasm
│   │       ├── wifi_planner_wasm_bg.js
│   │       └── wifi_planner_wasm.d.ts
│   │
│   ├── context/
│   │   └── WasmContext.tsx        # React context – auto-loads WASM on mount
│   │
│   ├── store/
│   │   └── plannerStore.ts        # Zustand store (APs, walls, settings)
│   │
│   ├── hooks/
│   │   ├── useHeatmap.ts          # Canvas heatmap (WASM → JS fallback)
│   │   └── useCanvasPan.ts        # Pan/zoom interactions
│   │
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── PlannerCanvas.tsx  # Main SVG canvas + event handling
│   │   │   ├── HeatmapLayer.tsx   # Canvas overlay for heatmap
│   │   │   ├── AccessPointMarker.tsx
│   │   │   ├── WallLayer.tsx
│   │   │   └── GridLayer.tsx
│   │   └── Sidebar/
│   │       ├── Sidebar.tsx
│   │       ├── Toolbar.tsx        # Tool selector
│   │       ├── APPanel.tsx        # AP list + configuration
│   │       ├── HeatmapSettings.tsx
│   │       ├── FloorPlanSettings.tsx
│   │       ├── ExportPanel.tsx
│   │       └── WasmBadge.tsx      # Engine status indicator
│   │
│   ├── utils/
│   │   ├── signalSimulation.ts    # JS fallback propagation engine
│   │   └── geometry.ts            # Point/line helpers
│   │
│   ├── types/index.ts             # Shared TypeScript types
│   └── test/                      # Vitest test suite
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SIGNAL_MODEL.md
│   └── screenshots/
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Select / Move tool |
| `2` | Place Access Point |
| `3` | Draw Wall |
| `4` | Erase tool |
| `Delete` / `Backspace` | Remove selected AP or wall |
| `Esc` | Cancel wall drawing / reset to Select |
| Scroll wheel | Zoom in / out |
| Middle-click drag | Pan canvas |

---

## Design Documentation

- [Architecture overview](docs/ARCHITECTURE.md) – component hierarchy, WASM integration, state management
- [Signal propagation model](docs/SIGNAL_MODEL.md) – FSPL physics, wall attenuation, colour mapping

---

## License

MIT
