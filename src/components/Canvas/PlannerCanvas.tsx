import { useRef, useState, useCallback, useEffect } from 'react';
import { usePlannerStore } from '../../store/plannerStore';
import { HeatmapLayer } from './HeatmapLayer';
import { AccessPointMarker } from './AccessPointMarker';
import { WallLayer } from './WallLayer';
import { GridLayer } from './GridLayer';
import { screenToCanvas } from '../../utils/geometry';
import { calculateRSSI, getSignalQuality, getSignalQualityColor } from '../../utils/signalSimulation';
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
    undo, redo, canUndo, canRedo,
    pendingWalls, suggestedAPs,
  } = usePlannerStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Measure tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureLine, setMeasureLine] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);

  // Station tool state
  const [stationPoint, setStationPoint] = useState<{ x: number; y: number } | null>(null);
  const stationDragging = useRef(false);

  // Refs that always hold the latest zoom/offset values.
  // The wheel event fires many times per frame on trackpads; if the handler
  // closes over React state, rapid events all see the same stale snapshot
  // and produce jumpy / uncontrolled zoom.  Reading from refs avoids this.
  const zoomRef = useRef(canvasZoom);
  const offsetRef = useRef(canvasOffset);
  zoomRef.current = canvasZoom;
  offsetRef.current = canvasOffset;

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
    } else if (activeTool === 'measure') {
      if (!measureStart) {
        setMeasureStart(pt);
        setMeasureLine(null);
      } else {
        setMeasureLine({ start: measureStart, end: pt });
        setMeasureStart(null);
      }
    } else if (activeTool === 'station') {
      if (stationPoint) {
        const distCanvas = Math.sqrt((pt.x - stationPoint.x) ** 2 + (pt.y - stationPoint.y) ** 2);
        const distScreen = distCanvas * canvasZoom;
        if (distScreen < 20) {
          stationDragging.current = true;
        } else {
          setStationPoint(pt);
        }
      } else {
        setStationPoint(pt);
      }
    }
  }, [
    activeTool, wallStart, width, height,
    accessPoints, walls, canvasZoom,
    measureStart, stationPoint,
    getCanvasPoint, addAccessPoint, addWall,
    removeAccessPoint, removeWall, selectAP, selectWall,
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      // Use ref so rapid mousemove events always see the latest offset
      const cur = offsetRef.current;
      setCanvasOffset({ x: cur.x + dx, y: cur.y + dy });
      return;
    }

    if (stationDragging.current) {
      setStationPoint(getCanvasPoint(e));
      return;
    }

    const pt = getCanvasPoint(e);
    setMousePos(pt);
  }, [isPanning, getCanvasPoint, setCanvasOffset]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      setIsPanning(false);
    }
    stationDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Read refs — never stale, even when many wheel events arrive before a
    // re-render (common with smooth-scrolling trackpads).
    const zoom   = zoomRef.current;
    const offset = offsetRef.current;

    const factor  = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, zoom * factor));
    const scale   = newZoom / zoom;

    // Keep the canvas point that sits under the cursor fixed in screen space.
    const newOffset = {
      x: mouseX - (mouseX - offset.x) * scale,
      y: mouseY - (mouseY - offset.y) * scale,
    };

    setCanvasZoom(newZoom);
    setCanvasOffset(newOffset);
  }, [setCanvasZoom, setCanvasOffset]); // Stable — no zoom/offset deps needed

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

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      switch (e.key) {
        case 'Escape':
          if (activeTool === 'wall' && wallStart) {
            setWallStart(null);
          } else if (activeTool === 'measure') {
            if (measureStart) {
              setMeasureStart(null);
            } else {
              setMeasureLine(null);
              setActiveTool('select');
            }
          } else if (activeTool === 'station') {
            setStationPoint(null);
            setActiveTool('select');
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
        case '5': setActiveTool('measure'); break;
        case '6': setActiveTool('station'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, wallStart, measureStart, selectedAPId, selectedWallId,
    setActiveTool, removeAccessPoint, removeWall,
    undo, redo, canUndo, canRedo]);

  const cursorStyle = () => {
    if (isPanning) return 'grabbing';
    switch (activeTool) {
      case 'ap': return 'crosshair';
      case 'wall': return 'crosshair';
      case 'erase': return 'not-allowed';
      case 'measure': return 'crosshair';
      case 'station': return 'crosshair';
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
      onMouseLeave={() => { setMousePos(null); stationDragging.current = false; }}
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

          {/* ── Measurement overlay ─────────────────────────────────────── */}
          {measureLine && (() => {
            const dx = measureLine.end.x - measureLine.start.x;
            const dy = measureLine.end.y - measureLine.start.y;
            const dist = Math.sqrt(dx * dx + dy * dy) / pixelsPerMeter;
            const label = dist < 1 ? `${(dist * 100).toFixed(0)} cm` : `${dist.toFixed(2)} m`;
            const mx = (measureLine.start.x + measureLine.end.x) / 2;
            const my = (measureLine.start.y + measureLine.end.y) / 2;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={measureLine.start.x} y1={measureLine.start.y}
                  x2={measureLine.end.x} y2={measureLine.end.y}
                  stroke="#7c3aed"
                  strokeWidth={2 / canvasZoom}
                  strokeDasharray={`${8 / canvasZoom} ${4 / canvasZoom}`}
                  strokeLinecap="round"
                />
                <circle cx={measureLine.start.x} cy={measureLine.start.y} r={4 / canvasZoom} fill="#7c3aed" stroke="white" strokeWidth={1.5 / canvasZoom} />
                <circle cx={measureLine.end.x} cy={measureLine.end.y} r={4 / canvasZoom} fill="#7c3aed" stroke="white" strokeWidth={1.5 / canvasZoom} />
                <text
                  x={mx} y={my - 10 / canvasZoom}
                  textAnchor="middle"
                  fontSize={12 / canvasZoom}
                  fill="#7c3aed"
                  stroke="white"
                  strokeWidth={3 / canvasZoom}
                  paintOrder="stroke"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {label}
                </text>
              </g>
            );
          })()}

          {/* Measure preview – first point placed, hovering second */}
          {activeTool === 'measure' && measureStart && mousePos && (() => {
            const dx = mousePos.x - measureStart.x;
            const dy = mousePos.y - measureStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy) / pixelsPerMeter;
            const label = dist < 1 ? `${(dist * 100).toFixed(0)} cm` : `${dist.toFixed(2)} m`;
            const mx = (measureStart.x + mousePos.x) / 2;
            const my = (measureStart.y + mousePos.y) / 2;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={measureStart.x} y1={measureStart.y}
                  x2={mousePos.x} y2={mousePos.y}
                  stroke="#7c3aed"
                  strokeWidth={1.5 / canvasZoom}
                  strokeDasharray={`${6 / canvasZoom} ${3 / canvasZoom}`}
                  strokeOpacity={0.6}
                />
                <circle cx={measureStart.x} cy={measureStart.y} r={4 / canvasZoom} fill="#7c3aed" stroke="white" strokeWidth={1.5 / canvasZoom} />
                <text
                  x={mx} y={my - 10 / canvasZoom}
                  textAnchor="middle"
                  fontSize={11 / canvasZoom}
                  fill="#7c3aed"
                  stroke="white"
                  strokeWidth={3 / canvasZoom}
                  paintOrder="stroke"
                  fontFamily="system-ui, sans-serif"
                  opacity={0.8}
                >
                  {label}
                </text>
              </g>
            );
          })()}

          {/* ── Station overlay ──────────────────────────────────────────── */}
          {stationPoint && (() => {
            const topAPs = accessPoints
              .filter(ap => ap.enabled)
              .map(ap => ({
                ap,
                rssi: calculateRSSI(ap, stationPoint.x, stationPoint.y, pixelsPerMeter, walls, heatmapBand),
              }))
              .sort((a, b) => b.rssi - a.rssi)
              .slice(0, 2);

            return (
              <g>
                {/* Lines from station to top 2 APs */}
                {topAPs.map(({ ap, rssi }) => {
                  const quality = getSignalQuality(rssi);
                  const lineColor = getSignalQualityColor(quality);
                  const mx = (stationPoint.x + ap.x) / 2;
                  const my = (stationPoint.y + ap.y) / 2;
                  return (
                    <g key={ap.id} style={{ pointerEvents: 'none' }}>
                      <line
                        x1={stationPoint.x} y1={stationPoint.y}
                        x2={ap.x} y2={ap.y}
                        stroke={ap.color}
                        strokeWidth={2 / canvasZoom}
                        strokeDasharray={`${8 / canvasZoom} ${4 / canvasZoom}`}
                        strokeLinecap="round"
                        opacity={0.85}
                      />
                      <text
                        x={mx} y={my - 9 / canvasZoom}
                        textAnchor="middle"
                        fontSize={11 / canvasZoom}
                        fill={lineColor}
                        stroke="white"
                        strokeWidth={3 / canvasZoom}
                        paintOrder="stroke"
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                      >
                        {rssi.toFixed(0)} dBm
                      </text>
                      <text
                        x={mx} y={my + 5 / canvasZoom}
                        textAnchor="middle"
                        fontSize={9 / canvasZoom}
                        fill="#64748b"
                        stroke="white"
                        strokeWidth={2.5 / canvasZoom}
                        paintOrder="stroke"
                        fontFamily="system-ui, sans-serif"
                      >
                        {ap.name}
                      </text>
                    </g>
                  );
                })}

                {/* Station marker */}
                <g style={{ cursor: activeTool === 'station' ? 'grab' : 'default' }}>
                  <circle
                    cx={stationPoint.x} cy={stationPoint.y}
                    r={14 / canvasZoom}
                    fill="#f97316"
                    fillOpacity={0.15}
                    stroke="#f97316"
                    strokeWidth={2 / canvasZoom}
                  />
                  <circle
                    cx={stationPoint.x} cy={stationPoint.y}
                    r={5 / canvasZoom}
                    fill="#f97316"
                  />
                  <text
                    x={stationPoint.x} y={stationPoint.y + 26 / canvasZoom}
                    textAnchor="middle"
                    fontSize={10 / canvasZoom}
                    fill="#ea580c"
                    stroke="white"
                    strokeWidth={2.5 / canvasZoom}
                    paintOrder="stroke"
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    Station
                  </text>
                </g>
              </g>
            );
          })()}

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

          {/* ── Pending walls (detected, awaiting confirmation) ──────────── */}
          {pendingWalls && pendingWalls.map(wall => (
            <line
              key={wall.id}
              x1={wall.x1} y1={wall.y1}
              x2={wall.x2} y2={wall.y2}
              stroke="#f59e0b"
              strokeWidth={3 / canvasZoom}
              strokeDasharray={`${10 / canvasZoom} ${5 / canvasZoom}`}
              strokeLinecap="round"
              opacity={0.85}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {/* ── Suggested AP positions (auto-deployment, ghosted) ──────────── */}
          {suggestedAPs && suggestedAPs.map((pos, i) => (
            <g key={i} style={{ pointerEvents: 'none' }} opacity={0.75}>
              <circle
                cx={pos.x} cy={pos.y}
                r={20}
                fill="#3b82f6"
                fillOpacity={0.15}
                stroke="#3b82f6"
                strokeWidth={2 / canvasZoom}
                strokeDasharray={`${6 / canvasZoom} ${3 / canvasZoom}`}
              />
              <circle
                cx={pos.x} cy={pos.y}
                r={5}
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <text
                x={pos.x} y={pos.y + 32}
                textAnchor="middle"
                fontSize={10 / canvasZoom}
                fill="#1d4ed8"
                stroke="white"
                strokeWidth={2.5 / canvasZoom}
                paintOrder="stroke"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
              >
                建议
              </text>
            </g>
          ))}
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
      {activeTool === 'measure' && !measureStart && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(124,58,237,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          点击起始点 / Click to set start point
        </div>
      )}
      {activeTool === 'measure' && measureStart && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(124,58,237,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          点击终止点 / Click to set end point · ESC to cancel
        </div>
      )}
      {activeTool === 'station' && !stationPoint && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(234,88,12,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          点击放置 Station / Click to place station
        </div>
      )}
      {activeTool === 'station' && stationPoint && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(234,88,12,0.9)',
          color: 'white',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 13,
          pointerEvents: 'none',
        }}>
          拖动移动 / Drag to move · ESC to clear
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
