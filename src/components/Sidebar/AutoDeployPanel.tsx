import { useState, useCallback } from 'react';
import { Wand2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';
import { computeAutoDeployment } from '../../utils/autoDeployment';
import type { Band, DeploymentOptions } from '../../types';

const RSSI_PRESETS = [
  { label: '极好 -60 dBm', value: -60 },
  { label: '良好 -65 dBm', value: -65 },
  { label: '一般 -70 dBm', value: -70 },
  { label: '自定义 / Custom', value: 'custom' as const },
];

export function AutoDeployPanel() {
  const {
    floorPlan, walls, pixelsPerMeter,
    accessPoints,
    suggestedAPs, suggestedAPOptions,
    setSuggestedAPs, applySuggestedAPs, clearSuggestedAPs,
  } = usePlannerStore();

  const [band, setBand] = useState<Band>('2.4GHz');
  // 'custom' means the user has selected the free-input option
  const [rssiPreset, setRssiPreset] = useState<number | 'custom'>(-65);
  const [customRSSI, setCustomRSSI] = useState(-65);
  const [minSepM, setMinSepM] = useState(8);
  const [maxAPs, setMaxAPs] = useState(6);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ pct: number; count: number } | null>(null);

  const targetRSSI = rssiPreset === 'custom' ? customRSSI : rssiPreset;

  const handleCalculate = useCallback(() => {
    setRunning(true);
    // Run on next tick so the spinner renders first
    setTimeout(() => {
      const opts: DeploymentOptions = {
        band,
        txPower: 20,
        gain: 3,
        targetRSSI,
        minSeparationM: minSepM,
        targetCoveragePct: 0.9,
        maxAPs,
      };
      // Pass existing APs so the separation check includes them
      const result = computeAutoDeployment(floorPlan, walls, pixelsPerMeter, opts, accessPoints);
      setSuggestedAPs(result.positions, opts);
      setLastResult({
        pct: Math.round(result.achievedCoveragePct * 100),
        count: result.positions.length,
      });
      setRunning(false);
    }, 20);
  }, [band, targetRSSI, minSepM, maxAPs, floorPlan, walls, pixelsPerMeter, accessPoints, setSuggestedAPs]);

  const handleApply = useCallback(() => {
    applySuggestedAPs();
    setLastResult(null);
  }, [applySuggestedAPs]);

  const handleClear = useCallback(() => {
    clearSuggestedAPs();
    setLastResult(null);
  }, [clearSuggestedAPs]);

  return (
    <div className="p-3 border-b border-gray-200 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
        <Wand2 size={12} />
        AP自动部署 / Auto Deploy
      </h3>

      {/* Parameters */}
      <div className="space-y-2">
        {/* Band */}
        <div>
          <label className="text-xs text-gray-500 font-medium">频段 / Band</label>
          <div className="flex gap-1 mt-1">
            {(['2.4GHz', '5GHz', '6GHz'] as Band[]).map(b => (
              <button
                key={b}
                onClick={() => setBand(b)}
                className={`flex-1 py-1 text-xs rounded border transition-colors ${
                  band === b
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Target RSSI — preset selector + optional custom input */}
        <div>
          <label className="text-xs text-gray-500 font-medium">目标信号 / Target RSSI</label>
          <select
            value={rssiPreset}
            onChange={e => {
              const v = e.target.value;
              setRssiPreset(v === 'custom' ? 'custom' : Number(v));
            }}
            className="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-primary-500"
          >
            {RSSI_PRESETS.map(o => (
              <option key={String(o.value)} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Custom RSSI input — only shown when "custom" is selected */}
          {rssiPreset === 'custom' && (
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                min={-100} max={-30} step={1}
                value={customRSSI}
                onChange={e => setCustomRSSI(Number(e.target.value))}
                className="w-24 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-400">dBm（-100 ~ -30）</span>
            </div>
          )}
        </div>

        {/* Min separation and max APs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 font-medium">最小间距 (m)</label>
            <input
              type="number"
              min={3} max={30} step={1}
              value={minSepM}
              onChange={e => setMinSepM(Number(e.target.value))}
              className="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">最多AP数</label>
            <input
              type="number"
              min={1} max={20} step={1}
              value={maxAPs}
              onChange={e => setMaxAPs(Number(e.target.value))}
              className="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Calculate button */}
      <button
        onClick={handleCalculate}
        disabled={running}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {running ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            计算中…
          </>
        ) : (
          <>
            <Wand2 size={13} />
            计算部署方案 / Calculate
          </>
        )}
      </button>

      {/* Results */}
      {lastResult && suggestedAPs && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle size={13} className="text-emerald-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-emerald-800">
              建议部署 {lastResult.count} 个AP，预计覆盖 {lastResult.pct}%
            </p>
          </div>
          <p className="text-xs text-emerald-700">
            Suggested {lastResult.count} AP{lastResult.count !== 1 ? 's' : ''},{' '}
            estimated {lastResult.pct}% coverage at ≥{Math.abs(targetRSSI)} dBm.
          </p>
          <p className="text-xs text-emerald-600">
            蓝色虚线圆圈为建议位置。确认后点击"应用"。<br />
            Blue dashed circles show suggested positions.
          </p>
          {suggestedAPOptions && (
            <p className="text-xs text-gray-500">
              Band: {suggestedAPOptions.band} · Tx: {suggestedAPOptions.txPower} dBm
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle size={12} />
              应用 / Apply
            </button>
            <button
              onClick={handleClear}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <XCircle size={12} />
              取消 / Clear
            </button>
          </div>
        </div>
      )}

      {/* Clear if suggestions visible but result panel was dismissed */}
      {suggestedAPs && !lastResult && (
        <button
          onClick={handleClear}
          className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          清除建议位置 / Clear suggestions
        </button>
      )}
    </div>
  );
}
