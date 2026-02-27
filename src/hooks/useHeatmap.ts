import { useEffect, useRef, useCallback } from 'react';
import type { AccessPoint, Wall, Band } from '../types';
import { generateHeatmap, type CoverageStats } from '../utils/signalSimulation';
import { useWasmEngine } from '../context/WasmContext';

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

/**
 * Renders a WiFi coverage heatmap onto a canvas element.
 *
 * Uses the Rust/WASM engine when available for faster computation,
 * transparently falling back to the JS implementation otherwise.
 */
export function useHeatmap(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseHeatmapOptions,
) {
  const {
    width, height, resolution, accessPoints, walls,
    pixelsPerMeter, band, enabled, onStatsUpdate,
  } = options;

  const { engine } = useWasmEngine();
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

    let imageData: ImageData;
    let stats: CoverageStats;

    if (engine) {
      // ── WASM path (Rust propagation engine) ────────────────────────────────
      const result = engine.generateHeatmap(
        width, height, resolution,
        accessPoints, walls, pixelsPerMeter, band,
      );
      imageData = result.imageData;
      stats = result.stats;
    } else {
      // ── JS fallback ─────────────────────────────────────────────────────────
      const result = generateHeatmap(
        width, height, resolution,
        accessPoints, walls, pixelsPerMeter, band,
      );
      imageData = result.imageData;
      stats = result.stats;
    }

    statsRef.current = stats;
    if (onStatsUpdate) onStatsUpdate(stats);

    // Paint the low-res heatmap onto a temporary canvas, then scale it up
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, width, height);
  }, [
    engine, width, height, resolution,
    accessPoints, walls, pixelsPerMeter, band,
    enabled, onStatsUpdate, canvasRef,
  ]);

  useEffect(() => {
    if (workerRef.current) clearTimeout(workerRef.current);
    workerRef.current = setTimeout(redraw, 100);
    return () => {
      if (workerRef.current) clearTimeout(workerRef.current);
    };
  }, [redraw]);

  return { stats: statsRef.current };
}
