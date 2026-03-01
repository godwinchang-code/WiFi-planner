import { Download, Upload, Trash2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { usePlannerStore } from '../../store/plannerStore';
import { useI18n } from '../../i18n/I18nContext';

export function ExportPanel() {
  const { t } = useI18n();
  const {
    exportPlan, importPlan, clearAll,
    canvasZoom,
    setCanvasZoom, setCanvasOffset,
    floorPlan,
  } = usePlannerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const json = exportPlan();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wifi-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportPlan]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      importPlan(json);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importPlan]);

  const handleResetView = useCallback(() => {
    setCanvasZoom(1);
    setCanvasOffset({ x: 20, y: 20 });
  }, [setCanvasZoom, setCanvasOffset]);

  const handleFitView = useCallback(() => {
    const container = document.querySelector('.canvas-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const fitZoom = Math.min(
      (rect.width - 40) / floorPlan.width,
      (rect.height - 40) / floorPlan.height,
      2,
    );
    setCanvasZoom(fitZoom);
    setCanvasOffset({
      x: (rect.width - floorPlan.width * fitZoom) / 2,
      y: (rect.height - floorPlan.height * fitZoom) / 2,
    });
  }, [floorPlan, setCanvasZoom, setCanvasOffset]);

  const handleClearAll = useCallback(() => {
    if (window.confirm(t('confirmClear'))) {
      clearAll();
    }
  }, [clearAll, t]);

  return (
    <div className="p-3 border-t border-gray-200 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('viewFile')}</h3>

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCanvasZoom(Math.max(0.2, canvasZoom / 1.25))}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          title={t('zoomOut')}
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-xs text-gray-600 w-10 text-center font-mono">
          {Math.round(canvasZoom * 100)}%
        </span>
        <button
          onClick={() => setCanvasZoom(Math.min(5, canvasZoom * 1.25))}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          title={t('zoomIn')}
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleFitView}
          className="ml-1 p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          title={t('fitToView')}
        >
          <Maximize size={14} />
        </button>
        <button
          onClick={handleResetView}
          className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
        >
          {t('reset')}
        </button>
      </div>

      {/* File operations */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-1.5 px-2 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors"
        >
          <Download size={14} />
          {t('exportPlan')}
        </button>
        <button
          onClick={handleImportClick}
          className="flex items-center justify-center gap-1.5 px-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
        >
          <Upload size={14} />
          {t('importPlan')}
        </button>
      </div>

      <button
        onClick={handleClearAll}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors border border-red-200"
      >
        <Trash2 size={14} />
        {t('clearAll')}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}
