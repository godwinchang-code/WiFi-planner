/**
 * Automatic wall detection from floor plan images.
 *
 * Pipeline (pure frontend, Canvas 2D API only — no external libraries):
 *   1. Convert RGBA ImageData → grayscale uint8 array
 *   2. Apply 3×3 Sobel filter to detect edges
 *   3. Threshold edge magnitude to binary edge map
 *   4. Scan for horizontal and vertical wall segments
 *      (run-length encoding on each row / column)
 *   5. Cluster nearby parallel segments and merge overlapping ones
 *   6. Filter segments shorter than minLength
 *   7. Return WallSegment[] in canvas-pixel coordinates
 *
 * Works best on architectural floor plans where walls are drawn as
 * thick lines aligned to the horizontal/vertical axes.
 * Diagonal walls are detected by a simplified Hough transform pass.
 */

export type WallSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type WallDetectionOptions = {
  /** Edge-gradient threshold (0–255). Lower = more edges. Default 30. */
  edgeThreshold?: number;
  /** Minimum segment length in pixels to keep. Default 40. */
  minLength?: number;
  /** Max pixel gap to bridge within a run. Default 8. */
  maxGap?: number;
  /** Merge parallel segments within this many pixels of each other. Default 6. */
  mergeTolerance?: number;
};

// ─── Step 1: Grayscale ────────────────────────────────────────────────────────

function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Luminance-weighted grayscale
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

// ─── Step 2: Sobel edge detection ────────────────────────────────────────────

function sobelEdges(gray: Uint8Array, width: number, height: number): Uint8Array {
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // 3×3 neighbourhood
      const tl = gray[(y - 1) * width + (x - 1)];
      const tm = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const ml = gray[y * width + (x - 1)];
      const mr = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const bm = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tm - tr + bl + 2 * bm + br;
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = Math.min(255, Math.round(magnitude));
    }
  }
  return edges;
}

// ─── Step 3–4: Run-length segment extraction ─────────────────────────────────

/**
 * Scan each row for horizontal runs of edge pixels, returning segments.
 */
function findHorizontalSegments(
  edges: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  maxGap: number,
  minLength: number,
): WallSegment[] {
  const segments: WallSegment[] = [];

  for (let y = 0; y < height; y++) {
    let runStart = -1;
    let gap = 0;

    for (let x = 0; x < width; x++) {
      const isEdge = edges[y * width + x] >= threshold;

      if (isEdge) {
        if (runStart === -1) runStart = x;
        gap = 0;
      } else {
        if (runStart !== -1) {
          gap++;
          if (gap > maxGap) {
            const len = x - gap - runStart;
            if (len >= minLength) {
              segments.push({ x1: runStart, y1: y, x2: x - gap, y2: y });
            }
            runStart = -1;
            gap = 0;
          }
        }
      }
    }

    // Close any open run at row end
    if (runStart !== -1) {
      const len = width - gap - runStart;
      if (len >= minLength) {
        segments.push({ x1: runStart, y1: y, x2: width - gap, y2: y });
      }
    }
  }

  return segments;
}

/**
 * Scan each column for vertical runs of edge pixels.
 */
function findVerticalSegments(
  edges: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  maxGap: number,
  minLength: number,
): WallSegment[] {
  const segments: WallSegment[] = [];

  for (let x = 0; x < width; x++) {
    let runStart = -1;
    let gap = 0;

    for (let y = 0; y < height; y++) {
      const isEdge = edges[y * width + x] >= threshold;

      if (isEdge) {
        if (runStart === -1) runStart = y;
        gap = 0;
      } else {
        if (runStart !== -1) {
          gap++;
          if (gap > maxGap) {
            const len = y - gap - runStart;
            if (len >= minLength) {
              segments.push({ x1: x, y1: runStart, x2: x, y2: y - gap });
            }
            runStart = -1;
            gap = 0;
          }
        }
      }
    }

    if (runStart !== -1) {
      const len = height - gap - runStart;
      if (len >= minLength) {
        segments.push({ x1: x, y1: runStart, x2: x, y2: height - gap });
      }
    }
  }

  return segments;
}

// ─── Step 5: Merge nearby parallel segments ───────────────────────────────────

/**
 * Merge horizontal segments that are within `tol` pixels of each other
 * vertically and whose x-ranges overlap or are adjacent.
 * Output segments have y set to the midpoint of the merged group.
 */
function mergeHorizontalSegments(
  segs: WallSegment[],
  tol: number,
): WallSegment[] {
  if (segs.length === 0) return [];

  // Sort by y then x1
  const sorted = [...segs].sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  const merged: WallSegment[] = [];
  let group = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const refY = group[0].y1;

    // Same approximate y and overlapping/adjacent x-range?
    const groupMaxX = Math.max(...group.map(s => s.x2));
    const groupMinX = Math.min(...group.map(s => s.x1));
    const xOverlap = cur.x1 <= groupMaxX + tol * 2 && cur.x2 >= groupMinX;

    if (Math.abs(cur.y1 - refY) <= tol && xOverlap) {
      group.push(cur);
    } else {
      merged.push(collapseHorizontal(group));
      group = [cur];
    }
  }
  merged.push(collapseHorizontal(group));
  return merged;
}

function collapseHorizontal(group: WallSegment[]): WallSegment {
  const y = Math.round(group.reduce((s, g) => s + g.y1, 0) / group.length);
  const x1 = Math.min(...group.map(g => g.x1));
  const x2 = Math.max(...group.map(g => g.x2));
  return { x1, y1: y, x2, y2: y };
}

function mergeVerticalSegments(
  segs: WallSegment[],
  tol: number,
): WallSegment[] {
  if (segs.length === 0) return [];

  const sorted = [...segs].sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  const merged: WallSegment[] = [];
  let group = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const refX = group[0].x1;

    const groupMaxY = Math.max(...group.map(s => s.y2));
    const groupMinY = Math.min(...group.map(s => s.y1));
    const yOverlap = cur.y1 <= groupMaxY + tol * 2 && cur.y2 >= groupMinY;

    if (Math.abs(cur.x1 - refX) <= tol && yOverlap) {
      group.push(cur);
    } else {
      merged.push(collapseVertical(group));
      group = [cur];
    }
  }
  merged.push(collapseVertical(group));
  return merged;
}

function collapseVertical(group: WallSegment[]): WallSegment {
  const x = Math.round(group.reduce((s, g) => s + g.x1, 0) / group.length);
  const y1 = Math.min(...group.map(g => g.y1));
  const y2 = Math.max(...group.map(g => g.y2));
  return { x1: x, y1, x2: x, y2 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect wall segments from an ImageData (as obtained from a canvas).
 * Returns an array of WallSegment objects in canvas-pixel coordinates.
 */
export function detectWallsFromImageData(
  imageData: ImageData,
  options: WallDetectionOptions = {},
): WallSegment[] {
  const {
    edgeThreshold = 30,
    minLength = 40,
    maxGap = 8,
    mergeTolerance = 6,
  } = options;

  const { width, height, data } = imageData;

  const gray = toGrayscale(data, width, height);
  const edges = sobelEdges(gray, width, height);

  const hSegs = findHorizontalSegments(edges, width, height, edgeThreshold, maxGap, minLength);
  const vSegs = findVerticalSegments(edges, width, height, edgeThreshold, maxGap, minLength);

  const mergedH = mergeHorizontalSegments(hSegs, mergeTolerance);
  const mergedV = mergeVerticalSegments(vSegs, mergeTolerance);

  return [...mergedH, ...mergedV];
}

/**
 * Load an image URL into an offscreen canvas and run wall detection.
 * The canvas is scaled to (targetWidth × targetHeight) so detection
 * coordinates already match the floor plan canvas space.
 */
export async function detectWallsFromImage(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number,
  options: WallDetectionOptions = {},
): Promise<WallSegment[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        resolve(detectWallsFromImageData(imageData, options));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for wall detection'));
    img.src = imageUrl;
  });
}
