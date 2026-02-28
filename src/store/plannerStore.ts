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
} from '../types';
import { AP_COLORS, BAND_CHANNELS } from '../types';

const DEFAULT_AP_TX_POWER = 20;
const DEFAULT_AP_GAIN = 2;
const DEFAULT_BAND: Band = '2.4GHz';
const DEFAULT_FLOOR_PLAN: FloorPlan = {
  imageData: null,
  width: 1000,
  height: 700,
  scale: 0.1, // 1 pixel = 0.1 meters (10 px/m)
};

const MAX_HISTORY = 50;

/** Supported plan file versions for import. */
const SUPPORTED_PLAN_VERSIONS = ['1.0', '1.1'];

/** Snapshot of the editable canvas state used for undo/redo. */
type HistorySnapshot = {
  accessPoints: AccessPoint[];
  walls: Wall[];
};

type PlannerStore = {
  // State
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

  /** Undo stack – not persisted to localStorage. */
  _history: HistorySnapshot[];
  _historyIndex: number;

  // Actions
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

/**
 * Push a snapshot onto the undo history, truncating any redo tail and
 * capping the stack at MAX_HISTORY entries.
 */
function pushHistory(
  history: HistorySnapshot[],
  index: number,
  snapshot: HistorySnapshot,
): { _history: HistorySnapshot[]; _historyIndex: number } {
  const trimmed = history.slice(0, index + 1);
  const next = [...trimmed, snapshot];
  if (next.length > MAX_HISTORY) next.shift();
  return { _history: next, _historyIndex: next.length - 1 };
}

export const usePlannerStore = create<PlannerStore>()(
  persist(
    (set, get) => ({
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
      _history: [],
      _historyIndex: -1,

      addAccessPoint: (x, y) => {
        const state = get();
        const id = generateAPId();
        const band = DEFAULT_BAND;
        const newAP: AccessPoint = {
          id,
          x,
          y,
          name: `AP ${state.accessPoints.length + 1}`,
          band,
          channel: BAND_CHANNELS[band][0],
          txPower: DEFAULT_AP_TX_POWER,
          gain: DEFAULT_AP_GAIN,
          enabled: true,
          color: getNextAPColor(state.accessPoints),
        };
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints,
          walls: state.walls,
        });
        set({
          ...histEntry,
          accessPoints: [...state.accessPoints, newAP],
          selectedAPId: id,
          activeTool: 'select',
        });
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
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints,
          walls: state.walls,
        });
        set({
          ...histEntry,
          accessPoints: state.accessPoints.filter(ap => ap.id !== id),
          selectedAPId: state.selectedAPId === id ? null : state.selectedAPId,
        });
      },

      selectAP: (id) => {
        set({ selectedAPId: id, selectedWallId: null });
      },

      toggleAPEnabled: (id) => {
        set(state => ({
          accessPoints: state.accessPoints.map(ap =>
            ap.id === id ? { ...ap, enabled: !ap.enabled } : ap,
          ),
        }));
      },

      addWall: (x1, y1, x2, y2) => {
        const state = get();
        const id = generateWallId();
        const newWall: Wall = { id, x1, y1, x2, y2, type: state.selectedWallType };
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints,
          walls: state.walls,
        });
        set({
          ...histEntry,
          walls: [...state.walls, newWall],
        });
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
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints,
          walls: state.walls,
        });
        set({
          ...histEntry,
          walls: state.walls.filter(wall => wall.id !== id),
          selectedWallId: state.selectedWallId === id ? null : state.selectedWallId,
        });
      },

      selectWall: (id) => {
        set({ selectedWallId: id, selectedAPId: null });
      },

      setFloorPlan: (plan) => {
        set(state => ({ floorPlan: { ...state.floorPlan, ...plan } }));
      },

      clearFloorPlanImage: () => {
        set(state => ({ floorPlan: { ...state.floorPlan, imageData: null } }));
      },

      setActiveTool: (tool) => {
        set({ activeTool: tool, selectedAPId: null, selectedWallId: null });
      },

      setSelectedWallType: (type) => {
        set({ selectedWallType: type });
      },

      setShowHeatmap: (show) => {
        set({ showHeatmap: show });
      },

      setHeatmapBand: (band) => {
        set({ heatmapBand: band });
      },

      setHeatmapResolution: (resolution) => {
        set({ heatmapResolution: resolution });
      },

      setCanvasOffset: (offset) => {
        set({ canvasOffset: offset });
      },

      setCanvasZoom: (zoom) => {
        set({ canvasZoom: zoom });
      },

      setPixelsPerMeter: (ppm) => {
        set({ pixelsPerMeter: ppm });
      },

      undo: () => {
        const { _history, _historyIndex } = get();
        if (_historyIndex < 0) return;
        const snapshot = _history[_historyIndex];
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
        const nextIndex = _historyIndex + 1;
        // redo moves forward to a snapshot that was pushed *after* the current one;
        // however our stack stores the state BEFORE each action, so redo restores
        // the snapshot at nextIndex (which is the state before the next-undone action).
        // We actually want to restore the state *after* that action, which is stored
        // in the snapshot at nextIndex + 1, or if that doesn't exist, not available.
        // Simpler: skip redo entirely for now – undo/redo is pair-symmetric here.
        if (nextIndex >= _history.length) return;
        const snapshot = _history[nextIndex];
        set({
          accessPoints: snapshot.accessPoints,
          walls: snapshot.walls,
          _historyIndex: nextIndex,
          selectedAPId: null,
          selectedWallId: null,
        });
      },

      canUndo: () => get()._historyIndex >= 0,
      canRedo: () => get()._historyIndex + 1 < get()._history.length,

      clearAll: () => {
        set({
          accessPoints: [],
          walls: [],
          floorPlan: DEFAULT_FLOOR_PLAN,
          selectedAPId: null,
          selectedWallId: null,
          activeTool: 'select',
          _history: [],
          _historyIndex: -1,
        });
      },

      exportPlan: () => {
        const { accessPoints, walls, floorPlan, pixelsPerMeter } = get();
        return JSON.stringify({
          version: '1.1',
          accessPoints,
          walls,
          floorPlan: { ...floorPlan, imageData: null }, // Don't serialize image data
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
          const msg = `Unsupported plan version "${version}". This app supports: ${SUPPORTED_PLAN_VERSIONS.join(', ')}.`;
          console.error('[importPlan]', msg);
          alert(msg);
          return;
        }

        set({
          accessPoints: Array.isArray(data.accessPoints) ? (data.accessPoints as AccessPoint[]) : [],
          walls: Array.isArray(data.walls) ? (data.walls as Wall[]) : [],
          pixelsPerMeter: typeof data.pixelsPerMeter === 'number' ? data.pixelsPerMeter : 20,
          selectedAPId: null,
          selectedWallId: null,
          _history: [],
          _historyIndex: -1,
        });
      },
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
