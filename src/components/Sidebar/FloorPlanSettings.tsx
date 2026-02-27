import { useRef, useCallback } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';

export function FloorPlanSettings() {
  const { floorPlan, setFloorPlan, clearFloorPlanImage } = usePlannerStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        const maxSize = 2000;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        setFloorPlan({ imageData, width, height });
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  }, [setFloorPlan]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxSize = 2000;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        setFloorPlan({ imageData, width, height });
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
  }, [setFloorPlan]);

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
