import type { AccessPoint, Wall, Point, Band } from '../types';
import { BAND_FREQUENCY_GHZ, WALL_CONFIGS } from '../types';

const SPEED_OF_LIGHT = 3e8; // m/s

/**
 * Free Space Path Loss (FSPL) in dB
 * FSPL(dB) = 20*log10(d) + 20*log10(f) + 20*log10(4π/c)
 */
export function freeSpacePathLoss(distanceMeters: number, frequencyGHz: number): number {
  if (distanceMeters <= 0) return 0;
  const f = frequencyGHz * 1e9;
  return 20 * Math.log10(distanceMeters) + 20 * Math.log10(f) + 20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT);
}

/**
 * Calculate received signal strength (RSSI) at a point from an AP
 */
export function calculateRSSI(
  ap: AccessPoint,
  targetX: number,
  targetY: number,
  pixelsPerMeter: number,
  walls: Wall[],
  band: Band,
): number {
  const dx = targetX - ap.x;
  const dy = targetY - ap.y;
  const distancePx = Math.sqrt(dx * dx + dy * dy);
  const distanceM = distancePx / pixelsPerMeter;

  if (distanceM < 0.01) return ap.txPower + ap.gain;

  const freq = BAND_FREQUENCY_GHZ[band];
  const fspl = freeSpacePathLoss(distanceM, freq);

  // Wall attenuation
  const wallAttenuation = calculateWallAttenuation(ap, targetX, targetY, walls);

  // RSSI = Tx Power + Antenna Gain - Path Loss - Wall Attenuation
  return ap.txPower + ap.gain - fspl - wallAttenuation;
}

/**
 * Count wall intersections and calculate total attenuation for a signal path
 */
export function calculateWallAttenuation(
  ap: AccessPoint,
  targetX: number,
  targetY: number,
  walls: Wall[],
): number {
  let totalAttenuation = 0;

  for (const wall of walls) {
    if (lineSegmentsIntersect(
      ap.x, ap.y, targetX, targetY,
      wall.x1, wall.y1, wall.x2, wall.y2,
    )) {
      totalAttenuation += WALL_CONFIGS[wall.type].attenuation;
    }
  }

  return totalAttenuation;
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-10) return false;

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return ua > 0 && ua < 1 && ub > 0 && ub < 1;
}

/**
 * Get the best RSSI across all enabled APs at a point
 */
export function getBestRSSI(
  point: Point,
  accessPoints: AccessPoint[],
  walls: Wall[],
  pixelsPerMeter: number,
  band: Band,
): number {
  let best = -Infinity;
  for (const ap of accessPoints) {
    if (!ap.enabled) continue;
    const rssi = calculateRSSI(ap, point.x, point.y, pixelsPerMeter, walls, band);
    if (rssi > best) best = rssi;
  }
  return best;
}

/**
 * Map RSSI value to a color for heatmap visualization
 * Good: > -60 dBm (green)
 * Fair: -60 to -70 dBm (yellow)
 * Poor: -70 to -80 dBm (orange)
 * Very Poor: < -80 dBm (red/none)
 */
export function rssiToColor(rssi: number): { r: number; g: number; b: number; a: number } {
  // Define thresholds
  const excellent = -50;  // dBm
  const good = -60;
  const fair = -70;
  const poor = -80;
  const none = -90;

  if (rssi >= excellent) {
    return { r: 0, g: 200, b: 0, a: 0.75 };
  } else if (rssi >= good) {
    const t = (rssi - good) / (excellent - good);
    return { r: Math.round(200 * (1 - t)), g: 200, b: 0, a: 0.72 };
  } else if (rssi >= fair) {
    const t = (rssi - fair) / (good - fair);
    return { r: 220, g: Math.round(180 * t), b: 0, a: 0.68 };
  } else if (rssi >= poor) {
    const t = (rssi - poor) / (fair - poor);
    return { r: 230, g: Math.round(80 * t), b: 0, a: 0.6 };
  } else if (rssi >= none) {
    const t = (rssi - none) / (poor - none);
    return { r: 200, g: 0, b: 0, a: 0.5 * t };
  }

  return { r: 0, g: 0, b: 0, a: 0 };
}

export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

export function getSignalQuality(rssi: number): SignalQuality {
  if (rssi >= -50) return 'excellent';
  if (rssi >= -60) return 'good';
  if (rssi >= -70) return 'fair';
  if (rssi >= -80) return 'poor';
  return 'none';
}

export function getSignalQualityColor(quality: SignalQuality): string {
  switch (quality) {
    case 'excellent': return '#16a34a';
    case 'good': return '#65a30d';
    case 'fair': return '#d97706';
    case 'poor': return '#dc2626';
    case 'none': return '#6b7280';
  }
}

export type CoverageStats = {
  totalCells: number;
  excellentCells: number;
  goodCells: number;
  fairCells: number;
  poorCells: number;
  noCoverageCells: number;
  excellentPercent: number;
  goodPercent: number;
  fairPercent: number;
  poorPercent: number;
  noCoveragePercent: number;
  avgRSSI: number;
};

/**
 * Generate a heatmap as ImageData for a canvas
 */
export function generateHeatmap(
  width: number,
  height: number,
  resolution: number,
  accessPoints: AccessPoint[],
  walls: Wall[],
  pixelsPerMeter: number,
  band: Band,
): { imageData: ImageData; stats: CoverageStats } {
  const canvas = new OffscreenCanvas(
    Math.ceil(width / resolution),
    Math.ceil(height / resolution),
  );
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(canvas.width, canvas.height);

  const stats: CoverageStats = {
    totalCells: 0,
    excellentCells: 0,
    goodCells: 0,
    fairCells: 0,
    poorCells: 0,
    noCoverageCells: 0,
    excellentPercent: 0,
    goodPercent: 0,
    fairPercent: 0,
    poorPercent: 0,
    noCoveragePercent: 0,
    avgRSSI: 0,
  };

  let rssiSum = 0;
  let rssiCount = 0;

  const enabledAPs = accessPoints.filter(ap => ap.enabled);
  if (enabledAPs.length === 0) {
    return { imageData: imgData, stats };
  }

  for (let row = 0; row < canvas.height; row++) {
    for (let col = 0; col < canvas.width; col++) {
      const px = (col + 0.5) * resolution;
      const py = (row + 0.5) * resolution;

      const rssi = getBestRSSI({ x: px, y: py }, enabledAPs, walls, pixelsPerMeter, band);
      const quality = getSignalQuality(rssi);
      const color = rssiToColor(rssi);

      const idx = (row * canvas.width + col) * 4;
      imgData.data[idx] = color.r;
      imgData.data[idx + 1] = color.g;
      imgData.data[idx + 2] = color.b;
      imgData.data[idx + 3] = Math.round(color.a * 255);

      stats.totalCells++;
      if (quality === 'excellent') stats.excellentCells++;
      else if (quality === 'good') stats.goodCells++;
      else if (quality === 'fair') stats.fairCells++;
      else if (quality === 'poor') stats.poorCells++;
      else stats.noCoverageCells++;

      if (rssi > -90) {
        rssiSum += rssi;
        rssiCount++;
      }
    }
  }

  if (stats.totalCells > 0) {
    stats.excellentPercent = (stats.excellentCells / stats.totalCells) * 100;
    stats.goodPercent = (stats.goodCells / stats.totalCells) * 100;
    stats.fairPercent = (stats.fairCells / stats.totalCells) * 100;
    stats.poorPercent = (stats.poorCells / stats.totalCells) * 100;
    stats.noCoveragePercent = (stats.noCoverageCells / stats.totalCells) * 100;
  }

  stats.avgRSSI = rssiCount > 0 ? rssiSum / rssiCount : -90;

  return { imageData: imgData, stats };
}
