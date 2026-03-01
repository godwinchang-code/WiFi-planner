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

const MAX_HISTORY = 50;
const SUPPORTED_PLAN_VERSIONS = ['1.0', '1.1'];

type HistorySnapshot = {
  accessPoints: AccessPoint[];
  walls: Wall[];
};

type PlannerStore = {
  // ── Persistent state ──────────────────────────────────────────────────────
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

function generateAPId(): string {
  return `ap-${Date.now()}-${apCounter++}`;
}

function generateWallId(): string {
  return `wall-${Date.now()}-${wallCounter++}`;
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

const INITIAL_HISTORY: HistorySnapshot[] = [{ accessPoints: [], walls: [] }];

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ───────────────────────────────────────────────────────
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
        set({
          accessPoints: [], walls: [],
          floorPlan: DEFAULT_FLOOR_PLAN,
          selectedAPId: null, selectedWallId: null,
          activeTool: 'select',
          pendingWalls: null,
          suggestedAPs: null, suggestedAPOptions: null,
          _history: [{ accessPoints: [], walls: [] }],
          _historyIndex: 0,
        });
      },

      exportPlan: () => {
        const { accessPoints, walls, floorPlan, pixelsPerMeter } = get();
        return JSON.stringify({
          version: '1.1',
          accessPoints,
          walls,
          floorPlan: { ...floorPlan, imageData: null },
          pixelsPerMeter,
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

        const newAPs = Array.isArray(data.accessPoints) ? (data.accessPoints as AccessPoint[]) : [];
        const newWalls = Array.isArray(data.walls) ? (data.walls as Wall[]) : [];

        set({
          accessPoints: newAPs,
          walls: newWalls,
          pixelsPerMeter: typeof data.pixelsPerMeter === 'number' ? data.pixelsPerMeter : 20,
          selectedAPId: null, selectedWallId: null,
          pendingWalls: null,
          suggestedAPs: null, suggestedAPOptions: null,
          _history: [{ accessPoints: newAPs, walls: newWalls }],
          _historyIndex: 0,
        });
      },

      // ── Scenario loading ────────────────────────────────────────────────────

      loadScenario: (scenario) => {
        const newWalls: Wall[] = scenario.walls.map(w => ({
          ...w, id: generateWallId(),
        }));
        const newAPs: AccessPoint[] = scenario.accessPoints.map(ap => ({
          ...ap, id: generateAPId(),
        }));
        set({
          accessPoints: newAPs,
          walls: newWalls,
          floorPlan: {
            imageData: null,
            width: scenario.floorPlan.width,
            height: scenario.floorPlan.height,
            scale: 1 / scenario.pixelsPerMeter,
          },
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
      name: 'wifi-planner-storage',
      partialize: (state) => ({
        accessPoints: state.accessPoints,
        walls: state.walls,
        pixelsPerMeter: state.pixelsPerMeter,
        showHeatmap: state.showHeatmap,
        heatmapBand: state.heatmapBand,
        heatmapResolution: state.heatmapResolution,
      }),
    },
  ),
);
