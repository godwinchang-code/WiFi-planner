# WiFi Planner — Three-Feature Implementation Plan

## Features to implement
1. **Built-in typical scenarios** (residential + SMB templates)
2. **Automatic wall detection** from uploaded floor plan images (pure frontend)
3. **AP auto-deployment** (greedy coverage optimisation algorithm)

All work goes on branch `claude/wifi-planner-implementation-5e67e`.

---

## Current codebase key facts

| Item | Value |
|------|-------|
| Canvas coordinate unit | pixels |
| Default scale | 20 px / metre |
| Default canvas | 1000 × 700 px → 50 m × 35 m |
| Wall struct | `{id, x1,y1, x2,y2, type: WallType}` |
| AccessPoint struct | `{id, x, y, name, band, channel, txPower, gain, enabled, color}` |
| FloorPlan struct | `{imageData, width, height, scale}` |
| Store action for batch load | `importPlan(json)` — resets history + sets all data |
| History snapshots | only `accessPoints[]` + `walls[]` |
| RSSI simulation | `generateHeatmap()` in `src/utils/signalSimulation.ts` |

---

## Feature 1 — Built-in Typical Scenarios

### 1.1  New file: `src/data/scenarios.ts`

Exports a `SCENARIOS` array of `ScenarioTemplate` objects.

```ts
type ScenarioTemplate = {
  id: string;
  name: string;           // "家庭三居室 / Home 3BR"
  nameEn: string;
  category: 'residential' | 'smb';
  description: string;
  floorPlan: { width: number; height: number };
  pixelsPerMeter: number;
  walls: Omit<Wall, 'id'>[];        // ids assigned at load time
  accessPoints: Omit<AccessPoint, 'id'>[];
};
```

**Four pre-built scenarios:**

| ID | Name | Canvas | ppm | Rooms |
|----|------|--------|-----|-------|
| `home-apartment` | 家庭公寓 / Home Apartment | 800 × 600 | 20 | Living, bedroom, kitchen, bath |
| `home-3br` | 家庭三居室 / Home 3BR | 1000 × 700 | 20 | Living, 3 bedrooms, kitchen, 2 baths |
| `smb-open-office` | SMB开放办公 / SMB Open Office | 1200 × 800 | 15 | Reception, open office, server room, meeting |
| `smb-floor` | SMB楼层 / SMB Floor | 1600 × 900 | 12 | Multiple offices, corridor, conference, lobby |

Each scenario includes:
- Perimeter exterior walls
- Interior concrete/light walls defining rooms
- Pre-positioned APs with reasonable band/power/channel choices

### 1.2  Store changes (`src/store/plannerStore.ts`)

Add action:
```ts
loadScenario: (id: string) => void
```
Implementation: find the scenario, generate fresh ids for walls and APs, then call the same path as `importPlan` (reset history, set state).

### 1.3  UI: new Sidebar panel `src/components/Sidebar/ScenarioPanel.tsx`

- Collapsible section at the top of the sidebar (above FloorPlanSettings)
- Two category tabs: 🏠 家庭 / 🏢 商业
- Grid of scenario cards (icon + name + short description)
- Clicking a card shows a small confirmation dialog if canvas already has data, then calls `loadScenario(id)`
- Inline SVG thumbnails drawn programmatically from scenario wall data (no external assets)

---

## Feature 2 — Automatic Wall Detection from Floor Plan Images

### 2.1  Algorithm overview (pure frontend, Canvas 2D API, no library)

```
Upload image
  → render to offscreen canvas (same size as floor plan)
  → grayscale + contrast stretch
  → Sobel edge detection  (3×3 kernel on ImageData)
  → threshold → binary edge image
  → Probabilistic Hough line accumulator
      – sample random edge pixels
      – accumulate (r, θ) in polar space
      – extract peaks above minVotes
  → Convert (r, θ) → line segments clipped to canvas bounds
  → Merge nearly-parallel nearby segments (DBSCAN-style clustering)
  → Filter out short segments (< minLength px)
  → Output: WallSegment[] {x1,y1,x2,y2}
```

Performance target: < 2 s for a 1000 × 700 px image, single JS thread.

### 2.2  New file: `src/utils/wallDetection.ts`

```ts
export type WallSegment = { x1: number; y1: number; x2: number; y2: number };

export function detectWallsFromCanvas(
  imageData: ImageData,
  options?: {
    edgeThreshold?: number;   // 0-255, default 40
    minLineLength?: number;   // px,  default 60
    maxLineGap?: number;      // px,  default 20
    numSamples?: number;      // Hough iterations, default 2000
  }
): WallSegment[];
```

Internally calls:
- `toGrayscale(ImageData): Uint8ClampedArray`
- `sobelEdges(gray, width, height): Uint8ClampedArray`
- `probabilisticHough(edges, width, height, opts): WallSegment[]`
- `mergeSegments(segments, angleTol, distTol): WallSegment[]`

### 2.3  Store changes

Add to state:
```ts
pendingWalls: Wall[] | null;    // walls detected, awaiting user confirmation
```

Add actions:
```ts
setPendingWalls: (walls: Wall[] | null) => void;
applyPendingWalls: () => void;   // merges pendingWalls into walls[], pushes history
```

`pendingWalls` is **not** persisted and **not** part of undo/redo history snapshots (it is ephemeral UI state).

### 2.4  UI changes

**`FloorPlanSettings.tsx`** — add after existing image upload section:
- "🔍 自动识别墙体 / Detect Walls" button (only enabled when `floorPlan.imageData !== null`)
- While running: spinner + "Analysing…"
- After detection:
  - Success banner: "Detected N walls — review and apply"
  - "Apply Detected Walls" green button
  - "Discard" button
- Sensitivity slider (edge threshold 20–80, default 40)

**`PlannerCanvas.tsx`** — add rendering of `pendingWalls`:
- Render as dashed yellow lines on top of the regular wall layer
- With a "pending" indicator (smaller opacity, dashed stroke)

No separate modal — the pending walls are visible directly on the canvas so the user can see them in context, delete individual ones if needed, then click Apply.

**User workflow:**
1. Upload floor plan image → see image on canvas
2. Click "Detect Walls" → ~1-2 s processing → yellow dashed lines appear on canvas
3. Review; use Erase tool to remove bad detections
4. Click "Apply" → walls become permanent (and go into undo history)

---

## Feature 3 — AP Auto-Deployment

### 3.1  Algorithm: Greedy Set Cover with RSSI model

```
Input:
  floorPlan dimensions, pixelsPerMeter,
  walls (for attenuation),
  targetRSSI (dBm),
  minAPSeparation (m),
  targetCoveragePct (0–1),
  band, txPower, gain,
  maxAPs

Step 1 — Build candidate grid
  Candidate positions: every (gridStep) pixels inside floor plan bounds
  gridStep = max(20, minAPSeparation × pixelsPerMeter / 3)

Step 2 — Compute coverage sets (JS signal engine)
  For each candidate position p:
    For each sample point s in a coarser evaluation grid:
      RSSI(p → s) = compute using existing path-loss + wall model
      If RSSI >= targetRSSI: mark s as "coverable by p"
  coverageSet[p] = Set of sample points covered

Step 3 — Greedy placement loop
  uncovered = all sample points
  placed = []
  while uncovered.size > 0 and placed.length < maxAPs:
    pick p = argmax |coverageSet[p] ∩ uncovered|
    if best coverage gain < minGain: break
    check minAPSeparation distance from all placed[]
    placed.push(p)
    uncovered -= coverageSet[p]

Step 4 — Return placed[] positions + coverage statistics
```

Performance: ~1-3 s for typical floor plan using JS simulation at evaluation grid resolution of 40 px.

### 3.2  New file: `src/utils/autoDeployment.ts`

```ts
export type DeploymentOptions = {
  band: Band;
  txPower: number;          // dBm, default 20
  gain: number;             // dBi, default 2
  targetRSSI: number;       // dBm, default -65
  minSeparationM: number;   // metres, default 8
  targetCoveragePct: number;// 0–1, default 0.90
  maxAPs: number;           // default 10
};

export type DeploymentResult = {
  positions: Array<{ x: number; y: number }>;
  achievedCoveragePct: number;
  uncoveredPct: number;
};

export function computeAutoDeployment(
  floorPlan: { width: number; height: number },
  walls: Wall[],
  pixelsPerMeter: number,
  options: DeploymentOptions,
): DeploymentResult;
```

Uses `generateHeatmap`-style logic from `signalSimulation.ts` (direct JS function call, not WASM, to avoid async complexity in a synchronous algorithm).

### 3.3  Store changes

Add to state:
```ts
suggestedAPs: Array<{ x: number; y: number }> | null;
suggestedAPOptions: DeploymentOptions | null;
```

Add actions:
```ts
setSuggestedAPs: (positions, options) => void;
clearSuggestedAPs: () => void;
applySuggestedAPs: () => void;  // creates real APs from suggestedAPs, pushes history
```

`suggestedAPs` is **not** persisted and **not** part of undo/redo snapshots.

### 3.4  UI: new Sidebar panel `src/components/Sidebar/AutoDeployPanel.tsx`

Located between APPanel and HeatmapSettings.

Controls:
```
🤖 AP 自动部署 / Auto Deploy
──────────────────────────────
频段 Band:       [2.4GHz ▼]
目标信号 Target: [-65 dBm ▼]  (options: -60 / -65 / -70)
最小间距 Min Sep:[8] m
最大数量 Max APs:[10]
[▶ 计算部署 / Calculate]      ← triggers algorithm, shows spinner

--- (after calculation) ---
建议部署 X 个AP,覆盖率 Y%
[✔ 应用部署 / Apply]  [✘ 取消 / Clear]
```

**`PlannerCanvas.tsx`** — render `suggestedAPs`:
- Blue semi-transparent circles (same style as AccessPointMarker but dashed outline, ghosted)
- Label "建议" / "Suggested"
- Not interactive (can't drag)
- Disappear when `applySuggestedAPs()` is called

---

## File Change Summary

| File | Change |
|------|--------|
| `src/data/scenarios.ts` | **New** — 4 built-in scenarios with walls + APs |
| `src/utils/wallDetection.ts` | **New** — Sobel + probabilistic Hough implementation |
| `src/utils/autoDeployment.ts` | **New** — greedy set-cover deployment algorithm |
| `src/components/Sidebar/ScenarioPanel.tsx` | **New** — scenario selection UI |
| `src/components/Sidebar/AutoDeployPanel.tsx` | **New** — auto-deploy configuration UI |
| `src/components/Sidebar/FloorPlanSettings.tsx` | **Edit** — add "Detect Walls" button + pending walls UI |
| `src/components/Sidebar/Sidebar.tsx` | **Edit** — add ScenarioPanel + AutoDeployPanel |
| `src/components/Canvas/PlannerCanvas.tsx` | **Edit** — render pendingWalls + suggestedAPs |
| `src/store/plannerStore.ts` | **Edit** — add loadScenario, setPendingWalls, applyPendingWalls, setSuggestedAPs, applySuggestedAPs, clearSuggestedAPs |
| `src/types/index.ts` | **Edit** — add ScenarioTemplate type, DeploymentOptions, DeploymentResult |

---

## Implementation order

1. **Types** — extend `src/types/index.ts` first (all features depend on it)
2. **Scenarios data** — `src/data/scenarios.ts` (self-contained data)
3. **Wall detection util** — `src/utils/wallDetection.ts`
4. **Auto-deployment util** — `src/utils/autoDeployment.ts`
5. **Store** — add all new actions/state to `plannerStore.ts`
6. **ScenarioPanel** — simplest UI component
7. **AutoDeployPanel** — UI wired to store + algorithm
8. **FloorPlanSettings** — add detect-walls button and pending wall UI
9. **PlannerCanvas** — render pendingWalls + suggestedAPs overlays
10. **Sidebar** — wire all new panels
11. **Tests** — unit tests for wallDetection + autoDeployment algorithms
12. **Build + push**

---

## Non-goals / out-of-scope for this iteration

- No backend / server-side processing
- No LLM integration
- No real-time collaborative editing
- No multi-floor support
- WASM engine unchanged (auto-deploy uses JS path deliberately)
