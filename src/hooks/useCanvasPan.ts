import { useRef, useCallback, useEffect } from 'react';
import type { Point } from '../types';

type UseCanvasPanOptions = {
  onOffsetChange: (offset: Point) => void;
  onZoomChange: (zoom: number) => void;
  zoom: number;
  offset: Point;
  minZoom?: number;
  maxZoom?: number;
};

export function useCanvasPan(
  containerRef: React.RefObject<HTMLElement>,
  options: UseCanvasPanOptions,
) {
  const { onOffsetChange, onZoomChange, zoom, offset, minZoom = 0.25, maxZoom = 4 } = options;
  const isPanning = useRef(false);
  const lastPanPoint = useRef<Point>({ x: 0, y: 0 });

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * delta));

    // Zoom towards mouse position
    const newOffset = {
      x: mouseX - (mouseX - offset.x) * (newZoom / zoom),
      y: mouseY - (mouseY - offset.y) * (newZoom / zoom),
    };

    onZoomChange(newZoom);
    onOffsetChange(newOffset);
  }, [zoom, offset, minZoom, maxZoom, onZoomChange, onOffsetChange, containerRef]);

  const handleMiddleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    onOffsetChange({ x: offset.x + dx, y: offset.y + dy });
  }, [offset, onOffsetChange]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 1) isPanning.current = false;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMiddleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMiddleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, handleWheel, handleMiddleMouseDown, handleMouseMove, handleMouseUp]);

  return { isPanning: isPanning.current };
}
