import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AccessPoint,
  Wall,
  WallType,
  Tool,
  Band,
  FloorPlan,
  Point,
  Floor,
  ScenarioTemplate,
  DeploymentOptions,
} from '../types';
import { AP_COLORS, BAND_CHANNELS } from '../types';
import type { WallSegment } from '../utils/wallDetection';

const DEFAULT_AP_TX_POWER = 20;
const DEFAULT_AP_GAIN = 2;
const DEFAULT_BAND: Band = '2.4GHz';
const DEFAULT_FLOOR_PLAN: FloorPlan = {
  imageData: null,
  width: 1000,
  height: 700,
  scale: 0.1,
};

const DEFAULT_FLOOR_ID = 'floor-1';
const INITIAL_FLOOR: Floor = {
  id: DEFAULT_FLOOR_ID,
  name: '1F',
  walls: [],
  accessPoints: [],
  floorPlan: DEFAULT_FLOOR_PLAN,
  pixelsPerMeter: 20,
};

const MAX_HISTORY = 50;
const SUPPORTED_PLAN_VERSIONS = ['1.0', '1.1', '1.2'];

type HistorySnapshot = {
  accessPoints: AccessPoint[];
  walls: Wall[];
};

type PlannerStore = {
  // ── Persistent state ──────────────────────────────────────────────────────
  floors: Floor[];
  activeFloorId: string;
  accessPoints: AccessPoint[];
  walls: Wall[];
  floorPlan: FloorPlan;
  activeTool: Tool;
  selectedAPId: string | null;
  selectedWallId: string | null;
  selectedWallType: WallType;
  showHeatmap: boolean;
  heatmapBand: Band;
  heatmapResolution: number;
  canvasOffset: Point;
  canvasZoom: number;
  pixelsPerMeter: number;
  _history: HistorySnapshot[];
  _historyIndex: number;

  // ── Ephemeral state (not persisted, not in undo history) ──────────────────
  pendingWalls: Wall[] | null;
  suggestedAPs: Array<{ x: number; y: number }> | null;
  suggestedAPOptions: DeploymentOptions | null;

  // ── Floor management ──────────────────────────────────────────────────────
  addFloor: () => void;
  deleteFloor: (id: string) => void;
  renameFloor: (id: string, name: string) => void;
  switchFloor: (id: string) => void;
  moveFloor: (id: string, direction: 'up' | 'down') => void;

  // ── Actions ───────────────────────────────────────────────────────────────
  addAccessPoint: (x: number, y: number) => void;
  updateAccessPoint: (id: string, updates: Partial<AccessPoint>) => void;
  removeAccessPoint: (id: string) => void;
  selectAP: (id: string | null) => void;
  toggleAPEnabled: (id: string) => void;

  addWall: (x1: number, y1: number, x2: number, y2: number) => void;
  updateWall: (id: string, updates: Partial<Wall>) => void;
  removeWall: (id: string) => void;
  selectWall: (id: string | null) => void;

  setFloorPlan: (plan: Partial<FloorPlan>) => void;
  clearFloorPlanImage: () => void;

  setActiveTool: (tool: Tool) => void;
  setSelectedWallType: (type: WallType) => void;
  setShowHeatmap: (show: boolean) => void;
  setHeatmapBand: (band: Band) => void;
  setHeatmapResolution: (resolution: number) => void;

  setCanvasOffset: (offset: Point) => void;
  setCanvasZoom: (zoom: number) => void;
  setPixelsPerMeter: (ppm: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  clearAll: () => void;
  exportPlan: () => string;
  importPlan: (json: string) => void;

  // Scenario
  loadScenario: (scenario: ScenarioTemplate) => void;

  // Wall detection
  setPendingWalls: (segments: WallSegment[] | null, wallType?: WallType) => void;
  applyPendingWalls: () => void;
  discardPendingWalls: () => void;

  // Auto-deployment
  setSuggestedAPs: (
    positions: Array<{ x: number; y: number }> | null,
    opts: DeploymentOptions | null,
  ) => void;
  applySuggestedAPs: () => void;
  clearSuggestedAPs: () => void;
};

let apCounter = 1;
let wallCounter = 1;
let floorCounter = 2;

function generateAPId(): string {
  return `ap-${Date.now()}-${apCounter++}`;
}

function generateWallId(): string {
  return `wall-${Date.now()}-${wallCounter++}`;
}

function generateFloorId(): string {
  return `floor-${Date.now()}-${floorCounter++}`;
}

function getNextAPColor(existingAPs: AccessPoint[]): string {
  const usedColors = new Set(existingAPs.map(ap => ap.color));
  for (const color of AP_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  return AP_COLORS[existingAPs.length % AP_COLORS.length];
}

function pushHistory(
  history: HistorySnapshot[],
  index: number,
  newState: HistorySnapshot,
): { _history: HistorySnapshot[]; _historyIndex: number } {
  const base = history.slice(0, index + 1);
  const next = [...base, newState];
  if (next.length > MAX_HISTORY + 1) next.shift();
  return { _history: next, _historyIndex: next.length - 1 };
}

// Sync working state into the active floor (strips imageData to save space)
function syncCurrentFloor(state: PlannerStore): Floor[] {
  return state.floors.map(f =>
    f.id === state.activeFloorId
      ? {
          ...f,
          walls: state.walls,
          accessPoints: state.accessPoints,
          floorPlan: { ...state.floorPlan, imageData: null },
          pixelsPerMeter: state.pixelsPerMeter,
        }
      : f,
  );
}

const INITIAL_HISTORY: HistorySnapshot[] = [{ accessPoints: [], walls: [] }];

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ───────────────────────────────────────────────────────
      floors: [{ ...INITIAL_FLOOR }],
      activeFloorId: DEFAULT_FLOOR_ID,
      accessPoints: [],
      walls: [],
      floorPlan: DEFAULT_FLOOR_PLAN,
      activeTool: 'select',
      selectedAPId: null,
      selectedWallId: null,
      selectedWallType: 'light',
      showHeatmap: true,
      heatmapBand: '2.4GHz',
      heatmapResolution: 8,
      canvasOffset: { x: 0, y: 0 },
      canvasZoom: 1,
      pixelsPerMeter: 20,
      _history: INITIAL_HISTORY,
      _historyIndex: 0,
      pendingWalls: null,
      suggestedAPs: null,
      suggestedAPOptions: null,

      // ── Floor management ────────────────────────────────────────────────────

      addFloor: () => {
        const state = get();
        const synced = syncCurrentFloor(state);
        const id = generateFloorId();
        const count = state.floors.length;
        const newFloor: Floor = {
          id,
          name: `${count + 1}F`,
          walls: [],
          accessPoints: [],
          floorPlan: { ...DEFAULT_FLOOR_PLAN },
          pixelsPerMeter: state.pixelsPerMeter,
        };
        set({
          floors: [...synced, newFloor],
          activeFloorId: id,
          walls: [],
          accessPoints: [],
          floorPlan: { ...DEFAULT_FLOOR_PLAN },
          pixelsPerMeter: state.pixelsPerMeter,
          selectedAPId: null, selectedWallId: null,
          pendingWalls: null, suggestedAPs: null, suggestedAPOptions: null,
          canvasOffset: { x: 0, y: 0 }, canvasZoom: 1,
          _history: INITIAL_HISTORY,
          _historyIndex: 0,
        });
      },

      deleteFloor: (id) => {
        const state = get();
        if (state.floors.length <= 1) return;

        if (id === state.activeFloorId) {
          const remaining = state.floors.filter(f => f.id !== id);
          const idx = state.floors.findIndex(f => f.id === id);
          const newActive = remaining[Math.max(0, idx - 1)];
          set({
            floors: remaining,
            activeFloorId: newActive.id,
            walls: newActive.walls,
            accessPoints: newActive.accessPoints,
            floorPlan: newActive.floorPlan,
            pixelsPerMeter: newActive.pixelsPerMeter,
            selectedAPId: null, selectedWallId: null,
            pendingWalls: null, suggestedAPs: null, suggestedAPOptions: null,
            _history: [{ accessPoints: newActive.accessPoints, walls: newActive.walls }],
            _historyIndex: 0,
          });
        } else {
          const synced = syncCurrentFloor(state);
          set({ floors: synced.filter(f => f.id !== id) });
        }
      },

      renameFloor: (id, name) => {
        set(state => ({
          floors: state.floors.map(f => f.id === id ? { ...f, name } : f),
        }));
      },

      switchFloor: (id) => {
        const state = get();
        if (id === state.activeFloorId) return;
        const synced = syncCurrentFloor(state);
        const newFloor = synced.find(f => f.id === id)!;
        set({
          floors: synced,
          activeFloorId: id,
          walls: newFloor.walls,
          accessPoints: newFloor.accessPoints,
          floorPlan: newFloor.floorPlan,
          pixelsPerMeter: newFloor.pixelsPerMeter,
          selectedAPId: null, selectedWallId: null,
          pendingWalls: null, suggestedAPs: null, suggestedAPOptions: null,
          _history: [{ accessPoints: newFloor.accessPoints, walls: newFloor.walls }],
          _historyIndex: 0,
        });
      },

      moveFloor: (id, direction) => {
        const state = get();
        const synced = syncCurrentFloor(state);
        const idx = synced.findIndex(f => f.id === id);
        if (direction === 'up' && idx > 0) {
          const arr = [...synced];
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          set({ floors: arr });
        } else if (direction === 'down' && idx < synced.length - 1) {
          const arr = [...synced];
          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
          set({ floors: arr });
        }
      },

      // ── AP actions ──────────────────────────────────────────────────────────

      addAccessPoint: (x, y) => {
        const state = get();
        const id = generateAPId();
        const band = DEFAULT_BAND;
        const newAP: AccessPoint = {
          id, x, y,
          name: `AP ${state.accessPoints.length + 1}`,
          band,
          channel: BAND_CHANNELS[band][0],
          txPower: DEFAULT_AP_TX_POWER,
          gain: DEFAULT_AP_GAIN,
          enabled: true,
          color: getNextAPColor(state.accessPoints),
        };
        const newAccessPoints = [...state.accessPoints, newAP];
        const hist = pushHistory(state._history, state._historyIndex, {
          accessPoints: newAccessPoints, walls: state.walls,
        });
        set({ ...hist, accessPoints: newAccessPoints, selectedAPId: id, activeTool: 'select' });
      },

      updateAccessPoint: (id, updates) => {
        set(state => ({
          accessPoints: state.accessPoints.map(ap =>
            ap.id === id ? { ...ap, ...updates } : ap,
          ),
        }));
      },

      removeAccessPoint: (id) => {
        const state = get();
        const newAccessPoints = state.accessPoints.filter(ap => ap.id !== id);
        const hist = pushHistory(state._history, state._historyIndex, {
          accessPoints: newAccessPoints, walls: state.walls,
        });
        set({
          ...hist,
          accessPoints: newAccessPoints,
          selectedAPId: state.selectedAPId === id ? null : state.selectedAPId,
        });
      },

      selectAP: (id) => set({ selectedAPId: id, selectedWallId: null }),

      toggleAPEnabled: (id) => {
        set(state => ({
          accessPoints: state.accessPoints.map(ap =>
            ap.id === id ? { ...ap, enabled: !ap.enabled } : ap,
          ),
        }));
      },

      // ── Wall actions ────────────────────────────────────────────────────────

      addWall: (x1, y1, x2, y2) => {
        const state = get();
        const id = generateWallId();
        const newWall: Wall = { id, x1, y1, x2, y2, type: state.selectedWallType };
        const newWalls = [...state.walls, newWall];
        const hist = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints, walls: newWalls,
        });
        set({ ...hist, walls: newWalls });
      },

      updateWall: (id, updates) => {
        set(state => ({
          walls: state.walls.map(wall =>
            wall.id === id ? { ...wall, ...updates } : wall,
          ),
        }));
      },

      removeWall: (id) => {
        const state = get();
        const newWalls = state.walls.filter(wall => wall.id !== id);
        const hist = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints, walls: newWalls,
        });
        set({
          ...hist, walls: newWalls,
          selectedWallId: state.selectedWallId === id ? null : state.selectedWallId,
        });
      },

      selectWall: (id) => set({ selectedWallId: id, selectedAPId: null }),

      // ── Floor plan ──────────────────────────────────────────────────────────

      setFloorPlan: (plan) => {
        set(state => ({ floorPlan: { ...state.floorPlan, ...plan } }));
      },

      clearFloorPlanImage: () => {
        set(state => ({ floorPlan: { ...state.floorPlan, imageData: null } }));
      },

      // ── UI state ────────────────────────────────────────────────────────────

      setActiveTool: (tool) => set({ activeTool: tool, selectedAPId: null, selectedWallId: null }),
      setSelectedWallType: (type) => set({ selectedWallType: type }),
      setShowHeatmap: (show) => set({ showHeatmap: show }),
      setHeatmapBand: (band) => set({ heatmapBand: band }),
      setHeatmapResolution: (resolution) => set({ heatmapResolution: resolution }),
      setCanvasOffset: (offset) => set({ canvasOffset: offset }),
      setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),
      setPixelsPerMeter: (ppm) => set({ pixelsPerMeter: ppm }),

      // ── Undo / Redo ─────────────────────────────────────────────────────────

      undo: () => {
        const { _history, _historyIndex } = get();
        if (_historyIndex <= 0) return;
        const snapshot = _history[_historyIndex - 1];
        set({
          accessPoints: snapshot.accessPoints,
          walls: snapshot.walls,
          _historyIndex: _historyIndex - 1,
          selectedAPId: null,
          selectedWallId: null,
        });
      },

      redo: () => {
        const { _history, _historyIndex } = get();
        if (_historyIndex >= _history.length - 1) return;
        const snapshot = _history[_historyIndex + 1];
        set({
          accessPoints: snapshot.accessPoints,
          walls: snapshot.walls,
          _historyIndex: _historyIndex + 1,
          selectedAPId: null,
          selectedWallId: null,
        });
      },

      canUndo: () => get()._historyIndex > 0,
      canRedo: () => get()._historyIndex < get()._history.length - 1,

      // ── Bulk operations ─────────────────────────────────────────────────────

      clearAll: () => {
        const emptyFloor: Floor = { ...INITIAL_FLOOR };
        set({
          floors: [emptyFloor],
          activeFloorId: DEFAULT_FLOOR_ID,
          accessPoints: [], walls: [],
          floorPlan: DEFAULT_FLOOR_PLAN,
          pixelsPerMeter: 20,
          selectedAPId: null, selectedWallId: null,
          activeTool: 'select',
          pendingWalls: null,
          suggestedAPs: null, suggestedAPOptions: null,
          _history: [{ accessPoints: [], walls: [] }],
          _historyIndex: 0,
        });
      },

      exportPlan: () => {
        const state = get();
        const synced = syncCurrentFloor(state);
        return JSON.stringify({
          version: '1.2',
          floors: synced,
          activeFloorId: state.activeFloorId,
          exportedAt: new Date().toISOString(),
        }, null, 2);
      },

      importPlan: (json) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(json) as Record<string, unknown>;
        } catch {
          const msg = 'Invalid JSON – the file does not appear to be a WiFi Planner file.';
          console.error('[importPlan]', msg);
          alert(msg);
          return;
        }

        const version = typeof data.version === 'string' ? data.version : undefined;
        if (version && !SUPPORTED_PLAN_VERSIONS.includes(version)) {
          const msg = `Unsupported plan version "${version}". Supported: ${SUPPORTED_PLAN_VERSIONS.join(', ')}.`;
          console.error('[importPlan]', msg);
          alert(msg);
          return;
        }

        if (version === '1.2') {
          const floors = (data.floors as Floor[]) || [];
          if (floors.length === 0) {
            alert('No floor data found in this file.');
            return;
          }
          const activeFloorId = (data.activeFloorId as string) || floors[0].id;
          const activeFloor = floors.find(f => f.id === activeFloorId) || floors[0];
          set({
            floors,
            activeFloorId: activeFloor.id,
            walls: activeFloor.walls || [],
            accessPoints: activeFloor.accessPoints || [],
            floorPlan: activeFloor.floorPlan || DEFAULT_FLOOR_PLAN,
            pixelsPerMeter: activeFloor.pixelsPerMeter || 20,
            selectedAPId: null, selectedWallId: null,
            pendingWalls: null,
            suggestedAPs: null, suggestedAPOptions: null,
            _history: [{ accessPoints: activeFloor.accessPoints || [], walls: activeFloor.walls || [] }],
            _historyIndex: 0,
          });
        } else {
          // Legacy v1.0 / v1.1 — single floor
          const newAPs = Array.isArray(data.accessPoints) ? (data.accessPoints as AccessPoint[]) : [];
          const newWalls = Array.isArray(data.walls) ? (data.walls as Wall[]) : [];
          const ppm = typeof data.pixelsPerMeter === 'number' ? data.pixelsPerMeter : 20;
          const singleFloor: Floor = {
            id: DEFAULT_FLOOR_ID,
            name: '1F',
            walls: newWalls,
            accessPoints: newAPs,
            floorPlan: DEFAULT_FLOOR_PLAN,
            pixelsPerMeter: ppm,
          };
          set({
            floors: [singleFloor],
            activeFloorId: DEFAULT_FLOOR_ID,
            accessPoints: newAPs,
            walls: newWalls,
            floorPlan: DEFAULT_FLOOR_PLAN,
            pixelsPerMeter: ppm,
            selectedAPId: null, selectedWallId: null,
            pendingWalls: null,
            suggestedAPs: null, suggestedAPOptions: null,
            _history: [{ accessPoints: newAPs, walls: newWalls }],
            _historyIndex: 0,
          });
        }
      },

      // ── Scenario loading ────────────────────────────────────────────────────

      loadScenario: (scenario) => {
        const state = get();
        const newWalls: Wall[] = scenario.walls.map(w => ({
          ...w, id: generateWallId(),
        }));
        const newAPs: AccessPoint[] = scenario.accessPoints.map(ap => ({
          ...ap, id: generateAPId(),
        }));
        const newFloorPlan: FloorPlan = {
          imageData: null,
          width: scenario.floorPlan.width,
          height: scenario.floorPlan.height,
          scale: 1 / scenario.pixelsPerMeter,
        };
        const updatedFloors = state.floors.map(f =>
          f.id === state.activeFloorId
            ? { ...f, walls: newWalls, accessPoints: newAPs, floorPlan: newFloorPlan, pixelsPerMeter: scenario.pixelsPerMeter }
            : f,
        );
        set({
          floors: updatedFloors,
          accessPoints: newAPs,
          walls: newWalls,
          floorPlan: newFloorPlan,
          pixelsPerMeter: scenario.pixelsPerMeter,
          selectedAPId: null, selectedWallId: null,
          activeTool: 'select',
          canvasOffset: { x: 0, y: 0 },
          canvasZoom: 1,
          pendingWalls: null,
          suggestedAPs: null, suggestedAPOptions: null,
          _history: [{ accessPoints: newAPs, walls: newWalls }],
          _historyIndex: 0,
        });
      },

      // ── Wall detection (pending walls) ──────────────────────────────────────

      setPendingWalls: (segments, wallType = 'concrete') => {
        if (segments === null) {
          set({ pendingWalls: null });
          return;
        }
        const pending: Wall[] = segments.map(seg => ({
          id: generateWallId(),
          x1: seg.x1, y1: seg.y1,
          x2: seg.x2, y2: seg.y2,
          type: wallType,
        }));
        set({ pendingWalls: pending });
      },

      applyPendingWalls: () => {
        const state = get();
        if (!state.pendingWalls || state.pendingWalls.length === 0) return;
        const newWalls = [...state.walls, ...state.pendingWalls];
        const hist = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints, walls: newWalls,
        });
        set({ ...hist, walls: newWalls, pendingWalls: null });
      },

      discardPendingWalls: () => set({ pendingWalls: null }),

      // ── Auto-deployment ─────────────────────────────────────────────────────

      setSuggestedAPs: (positions, opts) => {
        set({ suggestedAPs: positions, suggestedAPOptions: opts });
      },

      applySuggestedAPs: () => {
        const state = get();
        if (!state.suggestedAPs || state.suggestedAPs.length === 0) return;
        const opts = state.suggestedAPOptions;
        const band: Band = opts?.band ?? '2.4GHz';
        const txPower = opts?.txPower ?? DEFAULT_AP_TX_POWER;
        const gain = opts?.gain ?? DEFAULT_AP_GAIN;
        const baseCount = state.accessPoints.length;

        const newAPs: AccessPoint[] = state.suggestedAPs.map((pos, i) => ({
          id: generateAPId(),
          x: pos.x, y: pos.y,
          name: `Auto AP ${baseCount + i + 1}`,
          band,
          channel: BAND_CHANNELS[band][i % BAND_CHANNELS[band].length],
          txPower, gain,
          enabled: true,
          color: AP_COLORS[(baseCount + i) % AP_COLORS.length],
        }));

        const newAccessPoints = [...state.accessPoints, ...newAPs];
        const hist = pushHistory(state._history, state._historyIndex, {
          accessPoints: newAccessPoints, walls: state.walls,
        });
        set({
          ...hist,
          accessPoints: newAccessPoints,
          suggestedAPs: null, suggestedAPOptions: null,
        });
      },

      clearSuggestedAPs: () => set({ suggestedAPs: null, suggestedAPOptions: null }),
    }),
    {
      name: 'wifi-planner-storage-v2',
      partialize: (state) => ({
        floors: syncCurrentFloor(state),
        activeFloorId: state.activeFloorId,
        // Also persist active floor's working state for immediate hydration
        walls: state.walls,
        accessPoints: state.accessPoints,
        pixelsPerMeter: state.pixelsPerMeter,
        showHeatmap: state.showHeatmap,
        heatmapBand: state.heatmapBand,
        heatmapResolution: state.heatmapResolution,
      }),
    },
  ),
);
