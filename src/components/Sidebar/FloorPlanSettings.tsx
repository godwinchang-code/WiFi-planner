import { useRef, useCallback, useEffect } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';

export function FloorPlanSettings() {
  const { floorPlan, setFloorPlan, clearFloorPlanImage } = usePlannerStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /**
   * Read an image File, determine its display dimensions (capped at 2000 px
   * on the longest side), and update the floor-plan store entry.
   * Guards against calling setState after the component has unmounted and
   * surfaces a user-visible message on load failure.
   */
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
    // Always reset so the same file can be re-selected
    e.target.value = '';
  }, [loadImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  }, [loadImageFile]);

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
              type="number"
              min={200}
              max={5000}
              value={floorPlan.width}
              onChange={e => setFloorPlan({ width: Number(e.target.value) })}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Height (px)</label>
            <input
              type="number"
              min={200}
              max={5000}
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
