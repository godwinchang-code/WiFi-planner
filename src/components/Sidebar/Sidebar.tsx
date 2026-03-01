import { Wifi } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { APPanel } from './APPanel';
import { HeatmapSettings } from './HeatmapSettings';
import { FloorPlanSettings } from './FloorPlanSettings';
import { ExportPanel } from './ExportPanel';
import { WasmBadge } from './WasmBadge';
import { ScenarioPanel } from './ScenarioPanel';
import { AutoDeployPanel } from './AutoDeployPanel';
import type { CoverageStats } from '../../utils/signalSimulation';

type Props = {
  stats: CoverageStats | null;
};

export function Sidebar({ stats }: Props) {
  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-primary-600">
        <div className="flex items-center gap-2">
          <Wifi className="text-white" size={22} />
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-base leading-tight">WiFi Planner</h1>
            <p className="text-primary-200 text-xs">Network Coverage Planning</p>
          </div>
          <WasmBadge />
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
