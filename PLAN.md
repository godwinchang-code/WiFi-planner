# WiFi Planner — Implementation Specification

## Implemented Features

1. **Built-in typical scenarios** — residential + SMB floor plan templates
2. **Automatic wall detection** — pure-frontend Sobel edge detection from uploaded images
3. **AP auto-deployment** — greedy set-cover coverage optimisation
4. **Multi-floor support** — independent wall/AP/floorPlan data per floor with tab UI

All work is on branch `claude/wifi-planner-implementation-5e67e`.

---

## Current Codebase Key Facts

| Item | Value |
|------|-------|
| Canvas coordinate unit | pixels |
| Default scale | 20 px / metre |
| Default canvas | 1000 × 700 px → 50 m × 35 m |
| Wall struct | `{id, x1, y1, x2, y2, type: WallType}` |
| AccessPoint struct | `{id, x, y, name, band, channel, txPower, gain, enabled, color}` |
| FloorPlan struct | `{imageData, width, height, scale}` |
| Floor struct | `{id, name, walls, accessPoints, floorPlan, pixelsPerMeter}` |
| Export format version | `1.2` (floors array); v1.0/v1.1 imported as single floor |
| Persistence key | `wifi-planner-storage-v2` |
| History snapshots | `accessPoints[]` + `walls[]` per session (reset on floor switch) |
| RSSI simulation | `generateHeatmap()` in `src/utils/signalSimulation.ts` |

---

## Feature 1 — Built-in Typical Scenarios

### File: `src/data/scenarios.ts`

Exports `SCENARIOS: ScenarioTemplate[]` — 4 built-in templates.

```ts
type ScenarioTemplate = {
  id: string;
  name: string;           // bilingual, e.g. "家庭公寓 / Apartment"
  category: 'residential' | 'smb';
  description: string;
  floorPlan: { width: number; height: number };
  pixelsPerMeter: number;
  walls: Omit<Wall, 'id'>[];        // IDs assigned at load time
  accessPoints: Omit<AccessPoint, 'id'>[];
};
```

| ID | Name | Canvas | ppm | Pre-placed APs |
|----|------|--------|-----|----------------|
| `home-apartment` | 家庭公寓 / Apartment | 800 × 640 | 80 | 1 × 2.4 GHz |
| `home-3br` | 三居室住宅 / 3BR Home | 1200 × 640 | 80 | 2 × 2.4 GHz |
| `smb-open-office` | SMB开放办公 / Open Office | 1380 × 720 | 30 | 4 × (3×5 GHz + 1×2.4 GHz) |
| `smb-floor` | SMB楼层 / Office Floor | 1500 × 840 | 30 | 6 × (4×5 GHz + 2×2.4 GHz) |

### UI: `src/components/Sidebar/ScenarioPanel.tsx`

- Two tabs: 🏠 家庭 / 🏢 商业
- Scenario cards with inline SVG thumbnails generated from wall data
- Confirmation dialog before overwriting non-empty canvas
- Calls `loadScenario(scenario)` on the active floor

---

## Feature 2 — Automatic Wall Detection

### File: `src/utils/wallDetection.ts`

Pure-frontend image processing pipeline (Canvas 2D API, no external library).

```ts
export type WallSegment = { x1: number; y1: number; x2: number; y2: number };

export type WallDetectionOptions = {
  edgeThreshold?: number;   // default 30
  minLength?: number;       // default 40 px
  maxGap?: number;          // default 8 px
  mergeTolerance?: number;  // default 6 px
};

export function detectWallsFromImageData(
  imageData: ImageData,
  options?: WallDetectionOptions,
): WallSegment[];

export async function detectWallsFromImage(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number,
  options?: WallDetectionOptions,
): Promise<WallSegment[]>;
```

**Pipeline:** `toGrayscale` → `sobelEdges` (3×3 kernel) → `findHorizontalSegments` +
`findVerticalSegments` (run-length with gap bridging) → `mergeHorizontalSegments` +
`mergeVerticalSegments` (cluster nearby parallel segments).

Performance target: < 2 s for 1000 × 700 px on a single JS thread.

### Ephemeral store state

```ts
pendingWalls: Wall[] | null;   // detected, awaiting confirmation
```

Not persisted; not part of undo/redo snapshots.

Actions: `setPendingWalls(segments, wallType?)`, `applyPendingWalls()`, `discardPendingWalls()`

### UI

**`FloorPlanSettings.tsx`** — sensitivity slider (15–80) + "Detect Walls" button +
"Apply / Discard" banner shown when `pendingWalls` is set.

**`PlannerCanvas.tsx`** — pending walls rendered as yellow dashed lines (`#f59e0b`,
`strokeDasharray`) above the regular wall layer.

**User workflow:**
1. Upload floor plan image
2. Adjust sensitivity slider, click "Detect Walls" (~1–2 s)
3. Review yellow dashed lines on canvas; use Erase tool to remove bad detections
4. Click "Apply" → walls become permanent (pushed into undo history)

---

## Feature 3 — AP Auto-Deployment

### File: `src/utils/autoDeployment.ts`

Greedy set-cover algorithm using JS RSSI model.

```ts
export function computeAutoDeployment(
  floorPlan: { width: number; height: number },
  walls: Wall[],
  pixelsPerMeter: number,
  options: DeploymentOptions,
): DeploymentResult;
```

**Algorithm:**
1. Build evaluation sample grid (step = `max(20, 2×ppm)`)
2. Build candidate placement grid (step = `max(30, 3×ppm)`)
3. For each candidate: precompute set of evaluation points with RSSI ≥ targetRSSI
4. Greedy loop: pick candidate with maximum new coverage, enforce `minSeparationM`, repeat until target coverage reached or maxAPs exhausted
5. Return positions + achieved coverage %

Uses `calculateRSSI()` from `signalSimulation.ts` directly (synchronous JS, no WASM).

### Types (`src/types/index.ts`)

```ts
export type DeploymentOptions = {
  band: Band;
  txPower: number;           // dBm
  gain: number;              // dBi
  targetRSSI: number;        // dBm threshold for "covered"
  minSeparationM: number;    // minimum AP-to-AP distance in metres
  targetCoveragePct: number; // 0–1
  maxAPs: number;
};

export type DeploymentResult = {
  positions: Array<{ x: number; y: number }>;
  achievedCoveragePct: number;
  uncoveredPct: number;
};
```

### Ephemeral store state

```ts
suggestedAPs: Array<{ x: number; y: number }> | null;
suggestedAPOptions: DeploymentOptions | null;
```

Not persisted; not part of undo/redo snapshots.

Actions: `setSuggestedAPs(positions, opts)`, `applySuggestedAPs()`, `clearSuggestedAPs()`

### UI: `src/components/Sidebar/AutoDeployPanel.tsx`

Between APPanel and HeatmapSettings in the sidebar.

Controls: band selector, target RSSI dropdown (−60/−65/−70 dBm), min separation input,
max APs input, "Calculate" button with spinner.  After calculation: result banner
showing AP count + coverage %, "Apply" and "Clear" buttons.

**`PlannerCanvas.tsx`** — suggested APs rendered as blue ghost circles (`#3b82f6`,
`fillOpacity: 0.15`, dashed stroke) with "建议" label.  Non-interactive.

---

## Feature 4 — Multi-Floor Support

### Type: `Floor` (`src/types/index.ts`)

```ts
export type Floor = {
  id: string;
  name: string;
  walls: Wall[];
  accessPoints: AccessPoint[];
  floorPlan: FloorPlan;
  pixelsPerMeter: number;
};
```

### Store (`src/store/plannerStore.ts`)

**New state:**
```ts
floors: Floor[];        // all floors (persisted)
activeFloorId: string;  // which floor is displayed
```

The existing top-level `walls`, `accessPoints`, `floorPlan`, `pixelsPerMeter` remain as
the **active floor's working state**.  They are loaded from `floors[activeFloorId]` on
startup and on floor switch.

**New actions:**

| Action | Behaviour |
|--------|-----------|
| `addFloor()` | Saves current working state, creates new empty floor, switches to it |
| `deleteFloor(id)` | Requires ≥ 2 floors; if active, switches to adjacent floor first |
| `renameFloor(id, name)` | Updates `floors[id].name` |
| `switchFloor(id)` | Saves current → `floors[activeFloorId]`, loads target floor into working state; resets undo history |
| `moveFloor(id, 'up'\|'down')` | Reorders floor in the array |

**Persistence:**
- Storage key: `wifi-planner-storage-v2` (breaking change from v1; old data discarded)
- `partialize` serialises: `floors` (imageData stripped), `activeFloorId`, `walls`,
  `accessPoints`, `pixelsPerMeter`, `showHeatmap`, `heatmapBand`, `heatmapResolution`
- `_history` / `_historyIndex` are session-only (not persisted; reset on floor switch)

**Export format v1.2:**
```json
{
  "version": "1.2",
  "floors": [ { "id": "...", "name": "1F", "walls": [], "accessPoints": [], ... } ],
  "activeFloorId": "floor-1",
  "exportedAt": "..."
}
```

Import supports v1.0 / v1.1 (migrated to single floor) and v1.2.

**`loadScenario`** and **`importPlan`** both update `floors` as well as the working state.

### UI: `src/components/Canvas/FloorTabs.tsx`

Horizontal tab bar rendered above the canvas (inside the right-hand column in `App.tsx`).

| Interaction | Result |
|-------------|--------|
| Single click on tab | `switchFloor(id)` |
| Double click on tab | Inline rename (input field, Enter/Esc/blur to commit) |
| ‹ / › buttons (active tab only) | `moveFloor(id, 'up' \| 'down')` |
| × button (active tab, ≥ 2 floors) | `deleteFloor(id)` with `window.confirm` |
| "+ 添加楼层" button | `addFloor()` |

Active tab is styled with white background, blue label, bottom border matching canvas.
Floor count is shown on the right.

### Layout (`src/App.tsx`)

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (320 px)  │  Column (flex: 1)               │
│                    │  ┌─────────────── FloorTabs ──┐  │
│                    │  │ 1F  2F  3F  + 添加楼层 3层 │  │
│                    │  └────────────────────────────┘  │
│                    │  ┌─────────── PlannerCanvas ──┐  │
│                    │  │                            │  │
│                    │  └────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Complete File Index

| File | Status | Description |
|------|--------|-------------|
| `src/types/index.ts` | Edited | Added `Floor`, `ScenarioTemplate`, `DeploymentOptions`, `DeploymentResult` |
| `src/data/scenarios.ts` | New | 4 built-in scenario templates |
| `src/utils/wallDetection.ts` | New | Sobel edge detection pipeline |
| `src/utils/autoDeployment.ts` | New | Greedy set-cover AP placement |
| `src/store/plannerStore.ts` | Edited | Full multi-floor store; all new actions |
| `src/components/Canvas/FloorTabs.tsx` | New | Floor tab bar above canvas |
| `src/components/Canvas/PlannerCanvas.tsx` | Edited | Renders pendingWalls + suggestedAPs overlays |
| `src/components/Sidebar/ScenarioPanel.tsx` | New | Scenario selection UI |
| `src/components/Sidebar/AutoDeployPanel.tsx` | New | Auto-deployment controls |
| `src/components/Sidebar/FloorPlanSettings.tsx` | Edited | Wall detection section |
| `src/components/Sidebar/Sidebar.tsx` | Edited | Wires ScenarioPanel + AutoDeployPanel |
| `src/App.tsx` | Edited | FloorTabs above PlannerCanvas |

---

## Non-goals / Out of Scope

- No backend / server-side processing
- No LLM integration
- No real-time collaborative editing
- No cross-floor signal propagation (each floor simulated independently)
- WASM engine unchanged (auto-deploy uses JS path deliberately)
