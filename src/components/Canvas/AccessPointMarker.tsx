import { useState, useRef, useEffect } from 'react';
import type { AccessPoint } from '../../types';

type Props = {
  ap: AccessPoint;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  zoom: number;
};

export function AccessPointMarker({ ap, isSelected, onSelect, onDragEnd, zoom }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  // Keep a stable reference to the live handlers so the unmount cleanup
  // can always remove the most-recently-attached listeners, even if the
  // component unmounts mid-drag.
  const activeHandlers = useRef<{
    mousemove: ((e: MouseEvent) => void) | null;
    mouseup: ((e: MouseEvent) => void) | null;
  }>({ mousemove: null, mouseup: null });

  // Remove any dangling window listeners when the component unmounts.
  // We intentionally read .current at unmount time to get the most-recently-
  // registered handlers. The eslint-disable below suppresses the false-positive
  // "ref value will have changed" warning – that change is exactly what we need.
  useEffect(() => {
    const handlers = activeHandlers; // capture the stable ref object (not .current)
    return () => {
      if (handlers.current.mousemove) {
        window.removeEventListener('mousemove', handlers.current.mousemove);
      }
      if (handlers.current.mouseup) {
        window.removeEventListener('mouseup', handlers.current.mouseup);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startAPX = ap.x;
    const startAPY = ap.y;
    let moved = false;

    setIsDragging(true);

    const handleMouseMove = (me: MouseEvent) => {
      const dx = (me.clientX - startX) / zoom;
      const dy = (me.clientY - startY) / zoom;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      if (moved) {
        onDragEnd(startAPX + dx, startAPY + dy);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      activeHandlers.current.mousemove = null;
      activeHandlers.current.mouseup = null;
    };

    // Register handlers and track them for unmount cleanup
    activeHandlers.current.mousemove = handleMouseMove;
    activeHandlers.current.mouseup = handleMouseUp;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const size = 20;
  const opacity = ap.enabled ? 1 : 0.4;

  return (
    <g
      transform={`translate(${ap.x}, ${ap.y})`}
      onMouseDown={handleMouseDown}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity,
        userSelect: 'none',
      }}
    >
      {/* Outer ring - selection indicator */}
      {isSelected && (
        <circle
          r={size + 6}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2 / zoom}
          strokeDasharray={`${4 / zoom} ${2 / zoom}`}
        />
      )}

      {/* Coverage radius ring (faint) */}
      <circle
        r={size + 4}
        fill={ap.color}
        fillOpacity={0.08}
        stroke={ap.color}
        strokeWidth={1 / zoom}
        strokeOpacity={0.3}
      />

      {/* Main circle */}
      <circle
        r={size}
        fill={ap.color}
        stroke={isSelected ? '#ffffff' : ap.color}
        strokeWidth={isSelected ? 2 / zoom : 1 / zoom}
        strokeOpacity={isSelected ? 1 : 0.8}
        fillOpacity={0.9}
      />

      {/* WiFi icon */}
      <WifiIcon size={size} zoom={zoom} />

      {/* AP name label */}
      <text
        y={size + 12}
        textAnchor="middle"
        fontSize={11 / zoom}
        fill="#1e293b"
        stroke="white"
        strokeWidth={3 / zoom}
        paintOrder="stroke"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {ap.name}
      </text>

      {/* Band label */}
      <text
        y={size + 22}
        textAnchor="middle"
        fontSize={9 / zoom}
        fill="#64748b"
        stroke="white"
        strokeWidth={2 / zoom}
        paintOrder="stroke"
        fontFamily="system-ui, sans-serif"
      >
        {ap.band} · {ap.txPower}dBm
      </text>
    </g>
  );
}

function WifiIcon({ size, zoom }: { size: number; zoom: number }) {
  const s = size * 0.55;
  const strokeW = 2 / zoom;

  return (
    <g fill="none" stroke="white" strokeWidth={strokeW} strokeLinecap="round">
      {/* WiFi arcs */}
      <path d={`M ${-s * 0.9} ${-s * 0.2} A ${s * 0.9} ${s * 0.9} 0 0 1 ${s * 0.9} ${-s * 0.2}`} />
      <path d={`M ${-s * 0.6} ${s * 0.1} A ${s * 0.6} ${s * 0.6} 0 0 1 ${s * 0.6} ${s * 0.1}`} />
      <path d={`M ${-s * 0.3} ${s * 0.35} A ${s * 0.3} ${s * 0.3} 0 0 1 ${s * 0.3} ${s * 0.35}`} />
      {/* Dot */}
      <circle cx={0} cy={s * 0.65} r={s * 0.1} fill="white" stroke="none" />
    </g>
  );
}
