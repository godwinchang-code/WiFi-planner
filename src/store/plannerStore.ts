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

/**
 * Maximum number of undo steps kept in memory.
 * The timeline array can hold up to MAX_HISTORY + 1 entries (slot 0 = oldest
 * surviving baseline, slot MAX_HISTORY = current state).
 */
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

  /**
   * Timeline-based undo history (not persisted to localStorage).
   *
   * _history[i] = canvas state AFTER the i-th action.
   * _history[0] = initial empty state (or baseline after import/clear).
   * _historyIndex = pointer to the current position in the timeline.
   *
   * undo() → _historyIndex--, restore _history[_historyIndex]
   * redo() → _historyIndex++, restore _history[_historyIndex]
   * canUndo() → _historyIndex > 0
   * canRedo() → _historyIndex < _history.length - 1
   */
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
 * Append a new state snapshot to the timeline.
 *
 * @param history  Current history array
 * @param index    Current historyIndex (position of the currently shown state)
 * @param newState The state AFTER the action has been applied
 */
function pushHistory(
  history: HistorySnapshot[],
  index: number,
  newState: HistorySnapshot,
): { _history: HistorySnapshot[]; _historyIndex: number } {
  // Discard any redo tail above the current position
  const base = history.slice(0, index + 1);
  const next = [...base, newState];
  // Trim oldest entries if we exceed the cap
  if (next.length > MAX_HISTORY + 1) next.shift();
  return { _history: next, _historyIndex: next.length - 1 };
}

const INITIAL_HISTORY: HistorySnapshot[] = [{ accessPoints: [], walls: [] }];

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
      // Timeline starts with the empty canvas as the baseline (index 0)
      _history: INITIAL_HISTORY,
      _historyIndex: 0,

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
        const newAccessPoints = [...state.accessPoints, newAP];
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: newAccessPoints,
          walls: state.walls,
        });
        set({
          ...histEntry,
          accessPoints: newAccessPoints,
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
        const newAccessPoints = state.accessPoints.filter(ap => ap.id !== id);
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: newAccessPoints,
          walls: state.walls,
        });
        set({
          ...histEntry,
          accessPoints: newAccessPoints,
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
        const newWalls = [...state.walls, newWall];
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints,
          walls: newWalls,
        });
        set({
          ...histEntry,
          walls: newWalls,
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
        const newWalls = state.walls.filter(wall => wall.id !== id);
        const histEntry = pushHistory(state._history, state._historyIndex, {
          accessPoints: state.accessPoints,
          walls: newWalls,
        });
        set({
          ...histEntry,
          walls: newWalls,
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

      /**
       * Undo the last structural action (add/remove AP or wall).
       * Steps the timeline pointer one slot back and restores that state.
       */
      undo: () => {
        const { _history, _historyIndex } = get();
        if (_historyIndex <= 0) return; // already at the baseline
        const snapshot = _history[_historyIndex - 1];
        set({
          accessPoints: snapshot.accessPoints,
          walls: snapshot.walls,
          _historyIndex: _historyIndex - 1,
          selectedAPId: null,
          selectedWallId: null,
        });
      },

      /**
       * Redo the last undone action.
       * Steps the timeline pointer forward one slot and restores that state.
       */
      redo: () => {
        const { _history, _historyIndex } = get();
        if (_historyIndex >= _history.length - 1) return; // already at the tip
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

      clearAll: () => {
        set({
          accessPoints: [],
          walls: [],
          floorPlan: DEFAULT_FLOOR_PLAN,
          selectedAPId: null,
          selectedWallId: null,
          activeTool: 'select',
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

        const newAPs = Array.isArray(data.accessPoints) ? (data.accessPoints as AccessPoint[]) : [];
        const newWalls = Array.isArray(data.walls) ? (data.walls as Wall[]) : [];

        set({
          accessPoints: newAPs,
          walls: newWalls,
          pixelsPerMeter: typeof data.pixelsPerMeter === 'number' ? data.pixelsPerMeter : 20,
          selectedAPId: null,
          selectedWallId: null,
          // Reset timeline to the imported state as the new baseline
          _history: [{ accessPoints: newAPs, walls: newWalls }],
          _historyIndex: 0,
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
