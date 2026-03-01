import { Wifi } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { APPanel } from './APPanel';
import { HeatmapSettings } from './HeatmapSettings';
import { FloorPlanSettings } from './FloorPlanSettings';
import { ExportPanel } from './ExportPanel';
import { WasmBadge } from './WasmBadge';
import { ScenarioPanel } from './ScenarioPanel';
import { AutoDeployPanel } from './AutoDeployPanel';
import { useI18n, type Locale } from '../../i18n/I18nContext';
import type { CoverageStats } from '../../utils/signalSimulation';

type Props = {
  stats: CoverageStats | null;
};

export function Sidebar({ stats }: Props) {
  const { t, locale, setLocale } = useI18n();

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-primary-600">
        <div className="flex items-center gap-2 mb-2">
          <Wifi className="text-white" size={22} />
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight">{t('appTitle')}</h1>
            <p className="text-primary-200 text-xs">{t('appSubtitle')}</p>
          </div>
          <WasmBadge />
        </div>
        <div className="flex items-center justify-end gap-2">
          <label className="text-[11px] text-primary-200">{t('languageLabel')}</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="text-[11px] bg-white/90 text-gray-700 rounded px-1.5 py-0.5 border border-white/40"
          >
            <option value="en">English</option>
            <option value="zh-CN">中文</option>
          </select>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <ScenarioPanel />
        <FloorPlanSettings />
        <Toolbar />
        <APPanel />
        <AutoDeployPanel />
        <HeatmapSettings stats={stats} />
        <ExportPanel />
      </div>
    </aside>
  );
}
