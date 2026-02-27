export type Point = {
  x: number;
  y: number;
};

export type Band = '2.4GHz' | '5GHz' | '6GHz';

export type APModel = {
  name: string;
  txPower: number; // dBm
  gain: number;    // dBi
  bands: Band[];
};

export type AccessPoint = {
  id: string;
  x: number;
  y: number;
  name: string;
  band: Band;
  channel: number;
  txPower: number;  // dBm
  gain: number;     // dBi antenna gain
  enabled: boolean;
  color: string;
};

export type Wall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: WallType;
};

export type WallType = 'light' | 'concrete' | 'exterior' | 'glass';

export type WallConfig = {
  label: string;
  attenuation: number; // dB per wall
  color: string;
  width: number;
};

export const WALL_CONFIGS: Record<WallType, WallConfig> = {
  light: { label: 'Light Wall', attenuation: 3, color: '#94a3b8', width: 3 },
  glass: { label: 'Glass', attenuation: 2, color: '#7dd3fc', width: 2 },
  concrete: { label: 'Concrete', attenuation: 15, color: '#475569', width: 6 },
  exterior: { label: 'Exterior Wall', attenuation: 20, color: '#1e293b', width: 8 },
};

export const BAND_CHANNELS: Record<Band, number[]> = {
  '2.4GHz': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  '5GHz': [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165],
  '6GHz': [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85, 89, 93],
};

export const BAND_FREQUENCY_GHZ: Record<Band, number> = {
  '2.4GHz': 2.437,
  '5GHz': 5.5,
  '6GHz': 6.5,
};

export const AP_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const AP_MODELS: APModel[] = [
  { name: 'Generic 2.4GHz', txPower: 20, gain: 2, bands: ['2.4GHz'] },
  { name: 'Generic 5GHz', txPower: 20, gain: 2, bands: ['5GHz'] },
  { name: 'Dual-Band (2.4+5)', txPower: 23, gain: 3, bands: ['2.4GHz', '5GHz'] },
  { name: 'Tri-Band (2.4+5+6)', txPower: 26, gain: 4, bands: ['2.4GHz', '5GHz', '6GHz'] },
  { name: 'Enterprise AP', txPower: 30, gain: 5, bands: ['2.4GHz', '5GHz'] },
  { name: 'Outdoor AP', txPower: 33, gain: 8, bands: ['2.4GHz', '5GHz'] },
];

export type Tool = 'select' | 'ap' | 'wall' | 'erase';

export type FloorPlan = {
  imageData: string | null;
  width: number;
  height: number;
  scale: number; // meters per pixel
};

export type PlannerState = {
  accessPoints: AccessPoint[];
  walls: Wall[];
  floorPlan: FloorPlan;
  activeTool: Tool;
  selectedAPId: string | null;
  selectedWallType: WallType;
  showHeatmap: boolean;
  heatmapBand: Band;
  heatmapResolution: number;
  canvasOffset: Point;
  canvasZoom: number;
};
