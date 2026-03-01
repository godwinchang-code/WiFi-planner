import { useRef, useCallback } from 'react';
import { useHeatmap } from '../../hooks/useHeatmap';
import type { AccessPoint, Wall, Band } from '../../types';
import type { CoverageStats } from '../../utils/signalSimulation';

type Props = {
  width: number;
  height: number;
  resolution: number;
  accessPoints: AccessPoint[];
  walls: Wall[];
  pixelsPerMeter: number;
  band: Band;
  opacity: number;
  enabled: boolean;
  onStatsUpdate: (stats: CoverageStats) => void;
};

export function HeatmapLayer({
  width, height, resolution, accessPoints, walls,
  pixelsPerMeter, band, opacity, enabled, onStatsUpdate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stableOnStatsUpdate = useCallback(onStatsUpdate, [onStatsUpdate]);

  useHeatmap(canvasRef, {
    width, height, resolution, accessPoints, walls,
    pixelsPerMeter, band, opacity, enabled, onStatsUpdate: stableOnStatsUpdate,
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
