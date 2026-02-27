import type { Point } from '../types';

export function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function pointNearLine(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
  threshold = 8,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance({ x: px, y: py }, { x: x1, y: y1 }) < threshold;

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return distance({ x: px, y: py }, { x: closestX, y: closestY }) < threshold;
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert screen coordinates to canvas coordinates accounting for zoom and offset
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  offset: Point,
  zoom: number,
): Point {
  return {
    x: (screenX - offset.x) / zoom,
    y: (screenY - offset.y) / zoom,
  };
}

/**
 * Convert canvas coordinates to screen coordinates
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  offset: Point,
  zoom: number,
): Point {
  return {
    x: canvasX * zoom + offset.x,
    y: canvasY * zoom + offset.y,
  };
}
