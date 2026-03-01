import { useRef, useCallback, useEffect, useState } from 'react';
import { Upload, X, ImageIcon, ScanLine, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';
import { detectWallsFromImage } from '../../utils/wallDetection';

export function FloorPlanSettings() {
  const {
    floorPlan, setFloorPlan, clearFloorPlanImage,
    pendingWalls, setPendingWalls, applyPendingWalls, discardPendingWalls,
  } = usePlannerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [detecting, setDetecting] = useState(false);
  const [sensitivity, setSensitivity] = useState(30);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      const img = new Image();

      img.onload = () => {
        if (!mountedRef.current) return;
        const maxSize = 2000;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        setFloorPlan({ imageData, width, height });
      };

      img.onerror = () => {
        if (!mountedRef.current) return;
        alert('Failed to load image. The file may be corrupt or unsupported.');
      };

      img.src = imageData;
    };

    reader.onerror = () => {
      if (!mountedRef.current) return;
      alert('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  }, [setFloorPlan]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.target.value = '';
  }, [loadImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

  const handleDetectWalls = useCallback(async () => {
    if (!floorPlan.imageData) return;
    setDetecting(true);
    try {
      const segments = await detectWallsFromImage(
        floorPlan.imageData,
        floorPlan.width,
        floorPlan.height,
        { edgeThreshold: sensitivity, minLength: 40, maxGap: 8, mergeTolerance: 6 },
      );
      if (!mountedRef.current) return;
      setPendingWalls(segments, 'concrete');
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[detectWalls]', err);
      alert('Wall detection failed. Please try a different image or sensitivity setting.');
    } finally {
      if (mountedRef.current) setDetecting(false);
    }
  }, [floorPlan.imageData, floorPlan.width, floorPlan.height, sensitivity, setPendingWalls]);

  return (
    <div className="p-3 border-b border-gray-200 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Floor Plan</h3>

      {floorPlan.imageData ? (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img
              src={floorPlan.imageData}
              alt="Floor plan"
              className="w-full h-24 object-cover"
            />
            <button
              onClick={clearFloorPlanImage}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              title="Remove floor plan"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {floorPlan.width} × {floorPlan.height} px
          </p>

          {/* ── Wall detection ─────────────────────────────────────────────── */}
          <div className="space-y-2 rounded-lg border border-gray-200 p-2">
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <ScanLine size={12} />
              墙体识别 / Wall Detection
            </p>

            <div>
              <label className="text-xs text-gray-500">
                灵敏度 / Sensitivity: {sensitivity}
              </label>
              <input
                type="range"
                min={15} max={80} step={5}
                value={sensitivity}
                onChange={e => setSensitivity(Number(e.target.value))}
                className="w-full mt-1 accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400" style={{ marginTop: -2 }}>
                <span>高 High</span>
                <span>低 Low</span>
              </div>
            </div>

            <button
              onClick={handleDetectWalls}
              disabled={detecting || !!pendingWalls}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {detecting ? (
                <><Loader2 size={12} className="animate-spin" />识别中…</>
              ) : (
                <><ScanLine size={12} />自动识别墙体 / Detect Walls</>
              )}
            </button>

            {pendingWalls && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <CheckCircle size={12} />
                  检测到 {pendingWalls.length} 段墙体（黄色虚线显示）
                </p>
                <p className="text-xs text-amber-700">
                  Detected {pendingWalls.length} wall segments (yellow dashes on canvas).
                  Erase unwanted ones, then apply.
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={applyPendingWalls}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <CheckCircle size={11} />应用 / Apply
                  </button>
                  <button
                    onClick={discardPendingWalls}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <XCircle size={11} />丢弃 / Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
        >
          <ImageIcon className="mx-auto mb-2 text-gray-300" size={28} />
          <p className="text-xs text-gray-500 font-medium">Upload floor plan</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG up to 10MB</p>
          <button className="mt-2 flex items-center gap-1 mx-auto text-xs text-primary-600 font-medium">
            <Upload size={12} />
            Browse files
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Canvas size */}
      <div className="space-y-1">
        <label className="text-xs text-gray-500 font-medium">Canvas Size</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400">Width (px)</label>
            <input
              type="number" min={200} max={5000}
              value={floorPlan.width}
              onChange={e => setFloorPlan({ width: Number(e.target.value) })}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Height (px)</label>
            <input
              type="number" min={200} max={5000}
              value={floorPlan.height}
              onChange={e => setFloorPlan({ height: Number(e.target.value) })}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
