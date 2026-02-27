import { useRef, useState, useCallback, useEffect } from 'react';
import { usePlannerStore } from '../../store/plannerStore';
import { HeatmapLayer } from './HeatmapLayer';
import { AccessPointMarker } from './AccessPointMarker';
import { WallLayer } from './WallLayer';
import { GridLayer } from './GridLayer';
import { screenToCanvas } from '../../utils/geometry';
import type { CoverageStats } from '../../utils/signalSimulation';

type Props = {
  onStatsUpdate: (stats: CoverageStats) => void;
};

export function PlannerCanvas({ onStatsUpdate }: Props) {
  const {
    accessPoints, walls, floorPlan,
    activeTool, selectedAPId, selectedWallId,
    showHeatmap, heatmapBand, heatmapResolution,
    canvasOffset, canvasZoom, pixelsPerMeter,
    addAccessPoint, updateAccessPoint, removeAccessPoint, selectAP,
    addWall, removeWall, selectWall,
    setCanvasOffset, setCanvasZoom,
    setActiveTool,
  } = usePlannerStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const { width, height } = floorPlan;

  const getCanvasPoint = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return screenToCanvas(
      e.clientX - rect.left,
      e.clientY - rect.top,
      canvasOffset,
      canvasZoom,
    );
  }, [canvasOffset, canvasZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle mouse pan
      e.preventDefault();
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    const pt = getCanvasPoint(e);

    if (activeTool === 'wall') {
      if (!wallStart) {
        setWallStart(pt);
      } else {
        addWall(wallStart.x, wallStart.y, pt.x, pt.y);
        setWallStart(null);
      }
    } else if (activeTool === 'ap') {
      // Check if within canvas bounds
      if (pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height) {
        addAccessPoint(pt.x, pt.y);
      }
    } else if (activeTool === 'erase') {
      // Check for AP proximity
      for (const ap of accessPoints) {
        const dist = Math.sqrt((ap.x - pt.x) ** 2 + (ap.y - pt.y) ** 2);
        if (dist < 25) {
          removeAccessPoint(ap.id);
          return;
        }
      }
      // Check for wall proximity
      for (const wall of walls) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        let t = ((pt.x - wall.x1) * dx + (pt.y - wall.y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const closestX = wall.x1 + t * dx;
        const closestY = wall.y1 + t * dy;
        const dist = Math.sqrt((pt.x - closestX) ** 2 + (pt.y - closestY) ** 2);
        if (dist < 12) {
          removeWall(wall.id);
          return;
        }
      }
    } else if (activeTool === 'select') {
      // Deselect on empty click
      selectAP(null);
      selectWall(null);
    }
  }, [
    activeTool, wallStart, width, height,
    accessPoints, walls,
    getCanvasPoint, addAccessPoint, addWall,
    removeAccessPoint, removeWall, selectAP, selectWall,
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      setCanvasOffset({ x: canvasOffset.x + dx, y: canvasOffset.y + dy });
      return;
    }

    const pt = getCanvasPoint(e);
    setMousePos(pt);
  }, [isPanning, canvasOffset, getCanvasPoint, setCanvasOffset]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      setIsPanning(false);
    }
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    const newZoom = Math.max(0.2, Math.min(5, canvasZoom * delta));

    const newOffset = {
      x: mouseX - (mouseX - canvasOffset.x) * (newZoom / canvasZoom),
      y: mouseY - (mouseY - canvasOffset.y) * (newZoom / canvasZoom),
    };

    setCanvasZoom(newZoom);
    setCanvasOffset(newOffset);
  }, [canvasZoom, canvasOffset, setCanvasZoom, setCanvasOffset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'Escape':
          if (activeTool === 'wall' && wallStart) {
            setWallStart(null);
          } else {
            setActiveTool('select');
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedAPId) removeAccessPoint(selectedAPId);
          if (selectedWallId) removeWall(selectedWallId);
          break;
        case '1': setActiveTool('select'); break;
        case '2': setActiveTool('ap'); break;
        case '3': setActiveTool('wall'); break;
        case '4': setActiveTool('erase'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, wallStart, selectedAPId, selectedWallId,
    setActiveTool, removeAccessPoint, removeWall]);

  const cursorStyle = () => {
    if (isPanning) return 'grabbing';
    switch (activeTool) {
      case 'ap': return 'crosshair';
      case 'wall': return 'crosshair';
      case 'erase': return 'not-allowed';
      default: return 'default';
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc', position: 'relative' }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setMousePos(null)}
    >
      {/* Heatmap canvas - behind SVG */}
      <div
        style={{
          position: 'absolute',
          transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`,
          transformOrigin: '0 0',
          width,
          height,
          pointerEvents: 'none',
        }}
      >
        {showHeatmap && (
          <HeatmapLayer
            width={width}
            height={height}
            resolution={heatmapResolution}
            accessPoints={accessPoints}
            walls={walls}
            pixelsPerMeter={pixelsPerMeter}
            band={heatmapBand}
            enabled={showHeatmap}
            onStatsUpdate={onStatsUpdate}
          />
        )}
      </div>

      {/* SVG overlay */}
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: cursorStyle(),
        }}
      >
        <g transform={`translate(${canvasOffset.x}, ${canvasOffset.y}) scale(${canvasZoom})`}>
          {/* Floor plan background */}
          <rect
            x={0} y={0}
            width={width} height={height}
            fill="white"
            stroke="#e2e8f0"
            strokeWidth={2 / canvasZoom}
            rx={2 / canvasZoom}
          />

          {/* Floor plan image */}
          {floorPlan.imageData && (
            <image
              href={floorPlan.imageData}
              x={0} y={0}
              width={width} height={height}
              preserveAspectRatio="xMidYMid meet"
              opacity={0.6}
            />
          )}

          {/* Grid */}
          <GridLayer
            width={width}
            height={height}
            pixelsPerMeter={pixelsPerMeter}
            zoom={canvasZoom}
          />

          {/* Walls */}
          <WallLayer
            walls={walls}
            selectedWallId={selectedWallId}
            onSelect={(id) => { selectWall(id); selectAP(null); }}
            zoom={canvasZoom}
          />

          {/* Wall being drawn (preview) */}
          {wallStart && mousePos && (
            <line
              x1={wallStart.x}
              y1={wallStart.y}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="#3b82f6"
              strokeWidth={3 / canvasZoom}
              strokeLinecap="round"
              strokeDasharray={`${8 / canvasZoom} ${4 / canvasZoom}`}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Wall start point */}
          {wallStart && (
            <circle
              cx={wallStart.x}
              cy={wallStart.y}
              r={5 / canvasZoom}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={2 / canvasZoom}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Access Points */}
          {accessPoints.map(ap => (
            <AccessPointMarker
              key={ap.id}
              ap={ap}
              isSelected={ap.id === selectedAPId}
              onSelect={() => { selectAP(ap.id); selectWall(null); }}
              onDragEnd={(x, y) => updateAccessPoint(ap.id, { x, y })}
              zoom={canvasZoom}
            />
          ))}

          {/* AP placement preview */}
          {activeTool === 'ap' && mousePos &&
            mousePos.x >= 0 && mousePos.x <= width &&
            mousePos.y >= 0 && mousePos.y <= height && (
              <circle
                cx={mousePos.x}
                cy={mousePos.y}
                r={18}
                fill="#3b82f6"
                fillOpacity={0.3}
                stroke="#3b82f6"
                strokeWidth={2 / canvasZoom}
                strokeDasharray={`${6 / canvasZoom} ${3 / canvasZoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )}
        </g>
      </svg>

      {/* Scale indicator */}
      <ScaleBar pixelsPerMeter={pixelsPerMeter} zoom={canvasZoom} />

      {/* Coordinate display */}
      {mousePos && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 11,
          color: '#64748b',
          fontFamily: 'monospace',
        }}>
          {(mousePos.x / pixelsPerMeter).toFixed(1)}m, {(mousePos.y / pixelsPerMeter).toFixed(1)}m
        </div>
      )}

      {/* Hint text */}
      {activeTool === 'wall' && !wallStart && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(59,130,246,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          Click to set wall start point
        </div>
      )}
      {activeTool === 'wall' && wallStart && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(59,130,246,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          Click to set wall end point · ESC to cancel
        </div>
      )}
      {activeTool === 'ap' && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(59,130,246,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          Click on the floor plan to place an access point
        </div>
      )}
    </div>
  );
}

function ScaleBar({ pixelsPerMeter, zoom }: { pixelsPerMeter: number; zoom: number }) {
  // Calculate a nice scale bar length
  const targetWidthPx = 80; // target screen pixels
  const metersPerPx = 1 / (pixelsPerMeter * zoom);
  const rawMeters = targetWidthPx * metersPerPx;

  // Round to nice number
  const niceMeters = Math.pow(10, Math.floor(Math.log10(rawMeters))) *
    [1, 2, 5].reduce((best, v) => {
      const scaled = v * Math.pow(10, Math.floor(Math.log10(rawMeters)));
      return Math.abs(scaled - rawMeters) < Math.abs(best - rawMeters) ? scaled : best;
    }, Infinity);

  const barWidthPx = niceMeters * pixelsPerMeter * zoom;

  return (
    <div style={{
      position: 'absolute',
      bottom: 8,
      left: 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 2,
    }}>
      <div style={{
        width: barWidthPx,
        height: 3,
        background: '#475569',
        borderLeft: '2px solid #475569',
        borderRight: '2px solid #475569',
      }} />
      <span style={{
        fontSize: 10,
        color: '#475569',
        fontFamily: 'monospace',
      }}>
        {niceMeters < 1 ? `${niceMeters * 100}cm` : `${niceMeters}m`}
      </span>
    </div>
  );
}
