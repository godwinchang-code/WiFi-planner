import { useEffect, useRef, useCallback } from 'react';
import type { AccessPoint, Wall, Band } from '../types';
import { generateHeatmap, type CoverageStats } from '../utils/signalSimulation';

type UseHeatmapOptions = {
  width: number;
  height: number;
  resolution: number;
  accessPoints: AccessPoint[];
  walls: Wall[];
  pixelsPerMeter: number;
  band: Band;
  enabled: boolean;
  onStatsUpdate?: (stats: CoverageStats) => void;
};

export function useHeatmap(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseHeatmapOptions,
) {
  const {
    width, height, resolution, accessPoints, walls,
    pixelsPerMeter, band, enabled, onStatsUpdate,
  } = options;

  const workerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsRef = useRef<CoverageStats | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!enabled || accessPoints.filter(ap => ap.enabled).length === 0) {
      return;
    }

    const { imageData, stats } = generateHeatmap(
      width, height, resolution,
      accessPoints, walls, pixelsPerMeter, band,
    );

    statsRef.current = stats;
    if (onStatsUpdate) onStatsUpdate(stats);

    // Create a temporary canvas to hold the small heatmap, then scale it up
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.ceil(width / resolution);
    tempCanvas.height = Math.ceil(height / resolution);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Scale up with smooth interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, width, height);
  }, [width, height, resolution, accessPoints, walls, pixelsPerMeter, band, enabled, onStatsUpdate, canvasRef]);

  useEffect(() => {
    // Debounce heatmap generation for performance
    if (workerRef.current) clearTimeout(workerRef.current);
    workerRef.current = setTimeout(redraw, 100);

    return () => {
      if (workerRef.current) clearTimeout(workerRef.current);
    };
  }, [redraw]);

  return { stats: statsRef.current };
}
