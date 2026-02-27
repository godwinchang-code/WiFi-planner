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

      addAccessPoint: (x, y) => {
        const { accessPoints } = get();
        const id = generateAPId();
        const band = DEFAULT_BAND;
        const newAP: AccessPoint = {
          id,
          x,
          y,
          name: `AP ${accessPoints.length + 1}`,
          band,
          channel: BAND_CHANNELS[band][0],
          txPower: DEFAULT_AP_TX_POWER,
          gain: DEFAULT_AP_GAIN,
          enabled: true,
          color: getNextAPColor(accessPoints),
        };
        set(state => ({
          accessPoints: [...state.accessPoints, newAP],
          selectedAPId: id,
          activeTool: 'select',
        }));
      },

      updateAccessPoint: (id, updates) => {
        set(state => ({
          accessPoints: state.accessPoints.map(ap =>
            ap.id === id ? { ...ap, ...updates } : ap,
          ),
        }));
      },

      removeAccessPoint: (id) => {
        set(state => ({
          accessPoints: state.accessPoints.filter(ap => ap.id !== id),
          selectedAPId: state.selectedAPId === id ? null : state.selectedAPId,
        }));
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
        const id = generateWallId();
        const { selectedWallType } = get();
        const newWall: Wall = { id, x1, y1, x2, y2, type: selectedWallType };
        set(state => ({
          walls: [...state.walls, newWall],
        }));
      },

      updateWall: (id, updates) => {
        set(state => ({
          walls: state.walls.map(wall =>
            wall.id === id ? { ...wall, ...updates } : wall,
          ),
        }));
      },

      removeWall: (id) => {
        set(state => ({
          walls: state.walls.filter(wall => wall.id !== id),
          selectedWallId: state.selectedWallId === id ? null : state.selectedWallId,
        }));
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

      clearAll: () => {
        set({
          accessPoints: [],
          walls: [],
          floorPlan: DEFAULT_FLOOR_PLAN,
          selectedAPId: null,
          selectedWallId: null,
          activeTool: 'select',
        });
      },

      exportPlan: () => {
        const { accessPoints, walls, floorPlan, pixelsPerMeter } = get();
        return JSON.stringify({
          version: '1.0',
          accessPoints,
          walls,
          floorPlan: { ...floorPlan, imageData: null }, // Don't serialize image
          pixelsPerMeter,
          exportedAt: new Date().toISOString(),
        }, null, 2);
      },

      importPlan: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            accessPoints: data.accessPoints || [],
            walls: data.walls || [],
            pixelsPerMeter: data.pixelsPerMeter || 20,
            selectedAPId: null,
            selectedWallId: null,
          });
        } catch {
          console.error('Failed to import plan');
        }
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
