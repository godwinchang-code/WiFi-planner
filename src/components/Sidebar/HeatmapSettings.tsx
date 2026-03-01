import { usePlannerStore } from '../../store/plannerStore';
import { useI18n } from '../../i18n/I18nContext';
import type { Band } from '../../types';
import type { CoverageStats } from '../../utils/signalSimulation';
import { getSignalQualityColor } from '../../utils/signalSimulation';

const BANDS: Band[] = ['2.4GHz', '5GHz', '6GHz'];

type Props = {
  stats: CoverageStats | null;
};

export function HeatmapSettings({ stats }: Props) {
  const { t } = useI18n();
  const {
    showHeatmap, heatmapBand, heatmapResolution, heatmapOpacity,
    setShowHeatmap, setHeatmapBand, setHeatmapResolution, setHeatmapOpacity,
  } = usePlannerStore();

  return (
    <div className="p-3 border-t border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('heatmap')}</h3>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <div
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              showHeatmap ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              showHeatmap ? 'translate-x-4' : 'translate-x-1'
            }`} />
          </div>
          <span className="text-xs text-gray-600">{showHeatmap ? t('on') : t('off')}</span>
        </label>
      </div>

      {showHeatmap && (
        <>
          {/* Band selection */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">{t('band')}</label>
            <div className="grid grid-cols-3 gap-1">
              {BANDS.map(band => (
                <button
                  key={band}
                  onClick={() => setHeatmapBand(band)}
                  className={`text-xs py-1 rounded font-medium transition-all ${
                    heatmapBand === band
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {band}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-gray-500 font-medium">{t('resolution')}</label>
              <span className="text-xs text-gray-400">
                {heatmapResolution === 4 ? t('resolutionHigh') : heatmapResolution === 8 ? t('resolutionMedium') : t('resolutionLow')}
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={20}
              step={4}
              value={heatmapResolution}
              onChange={e => setHeatmapResolution(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{t('resolutionHigh')}</span>
              <span>{t('lowFaster')}</span>
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-gray-500 font-medium">{t('opacity')}</label>
              <span className="text-xs text-gray-400">{Math.round(heatmapOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={Math.round(heatmapOpacity * 100)}
              onChange={e => setHeatmapOpacity(Number(e.target.value) / 100)}
              className="w-full accent-primary-600"
            />
          </div>

          {/* Legend */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">{t('signalLegend')}</label>
            <div className="space-y-1">
              {[
                { label: t('excellent'), range: '> -50 dBm', color: '#00c800' },
                { label: t('good'), range: '-50 to -60', color: '#c8c800' },
                { label: t('fair'), range: '-60 to -70', color: '#dc6400' },
                { label: t('poor'), range: '-70 to -80', color: '#e60000' },
                { label: t('noSignal'), range: '< -80 dBm', color: '#6b7280' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: item.color, opacity: 0.8 }}
                  />
                  <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                  <span className="text-xs text-gray-400">{item.range}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Coverage Stats */}
      {stats && stats.totalCells > 0 && showHeatmap && (
        <CoverageStatsPanel stats={stats} />
      )}
    </div>
  );
}

function CoverageStatsPanel({ stats }: { stats: CoverageStats }) {
  const { t } = useI18n();
  const covered = stats.excellentPercent + stats.goodPercent + stats.fairPercent;

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('coverageStats')}</h4>

      {/* Coverage bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">{t('totalCoverage')}</span>
          <span className="font-semibold text-gray-800">{covered.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-gray-200 flex">
          <div style={{ width: `${stats.excellentPercent}%`, background: '#00c800' }} />
          <div style={{ width: `${stats.goodPercent}%`, background: '#c8c800' }} />
          <div style={{ width: `${stats.fairPercent}%`, background: '#dc6400' }} />
          <div style={{ width: `${stats.poorPercent}%`, background: '#e60000' }} />
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        {[
          { label: t('excellent'), value: stats.excellentPercent, quality: 'excellent' as const },
          { label: t('good'), value: stats.goodPercent, quality: 'good' as const },
          { label: t('fair'), value: stats.fairPercent, quality: 'fair' as const },
          { label: t('poor'), value: stats.poorPercent, quality: 'poor' as const },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <span style={{ color: getSignalQualityColor(item.quality) }} className="font-medium">
              {item.label}
            </span>
            <span className="text-gray-600">{item.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs border-t border-gray-100 pt-2">
        <span className="text-gray-500">{t('avgRssi')}</span>
        <span className="font-medium text-gray-700">{stats.avgRSSI.toFixed(1)} dBm</span>
      </div>
    </div>
  );
}
