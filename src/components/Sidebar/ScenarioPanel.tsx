import { useState } from 'react';
import { LayoutTemplate, Home, Building2 } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';
import { SCENARIOS } from '../../data/scenarios';
import type { ScenarioTemplate } from '../../types';

type Category = 'residential' | 'smb';

export function ScenarioPanel() {
  const { accessPoints, walls, loadScenario } = usePlannerStore();
  const [activeCategory, setActiveCategory] = useState<Category>('residential');
  const [confirmScenario, setConfirmScenario] = useState<ScenarioTemplate | null>(null);

  const hasData = accessPoints.length > 0 || walls.length > 0;

  const filtered = SCENARIOS.filter(s => s.category === activeCategory);

  function handleSelect(scenario: ScenarioTemplate) {
    if (hasData) {
      setConfirmScenario(scenario);
    } else {
      loadScenario(scenario);
    }
  }

  function handleConfirm() {
    if (confirmScenario) {
      loadScenario(confirmScenario);
      setConfirmScenario(null);
    }
  }

  return (
    <div className="p-3 border-b border-gray-200 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
        <LayoutTemplate size={12} />
        场景模板 / Scenarios
      </h3>

      {/* Category tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        <button
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors ${
            activeCategory === 'residential'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => setActiveCategory('residential')}
        >
          <Home size={11} />
          家庭
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors ${
            activeCategory === 'smb'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => setActiveCategory('smb')}
        >
          <Building2 size={11} />
          商业
        </button>
      </div>

      {/* Scenario cards */}
      <div className="space-y-2">
        {filtered.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => handleSelect(scenario)}
            className="w-full text-left rounded-lg border border-gray-200 p-2.5 hover:border-primary-400 hover:bg-primary-50 transition-colors group"
          >
            <div className="flex items-start gap-2">
              {/* Mini floor plan thumbnail */}
              <ScenarioThumbnail scenario={scenario} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 leading-tight">
                  {scenario.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                  {scenario.description}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {scenario.accessPoints.length} APs · {scenario.walls.length} walls ·{' '}
                  {Math.round(scenario.floorPlan.width / scenario.pixelsPerMeter)}×
                  {Math.round(scenario.floorPlan.height / scenario.pixelsPerMeter)} m
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Confirmation dialog */}
      {confirmScenario && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full space-y-3">
            <h4 className="text-sm font-bold text-gray-800">加载场景模板？</h4>
            <p className="text-xs text-gray-600">
              当前画布上已有内容。加载"{confirmScenario.name}"将清除所有现有的AP和墙体。
            </p>
            <p className="text-xs text-gray-500 italic">
              This will replace all existing APs and walls with the scenario template.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmScenario(null)}
                className="flex-1 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消 / Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                确认加载 / Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Programmatic SVG thumbnail of the scenario's walls. */
function ScenarioThumbnail({ scenario }: { scenario: ScenarioTemplate }) {
  const W = 56;
  const H = 40;
  const { width: fw, height: fh } = scenario.floorPlan;
  const scaleX = (W - 2) / fw;
  const scaleY = (H - 2) / fh;
  const s = Math.min(scaleX, scaleY);
  const ox = (W - fw * s) / 2;
  const oy = (H - fh * s) / 2;

  const wallColor: Record<string, string> = {
    exterior: '#1e293b',
    concrete: '#475569',
    light: '#94a3b8',
    glass: '#7dd3fc',
  };

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="flex-shrink-0 rounded border border-gray-100 bg-gray-50"
    >
      {scenario.walls.map((wall, i) => (
        <line
          key={i}
          x1={ox + wall.x1 * s}
          y1={oy + wall.y1 * s}
          x2={ox + wall.x2 * s}
          y2={oy + wall.y2 * s}
          stroke={wallColor[wall.type] ?? '#94a3b8'}
          strokeWidth={wall.type === 'exterior' ? 1.5 : 0.8}
        />
      ))}
      {scenario.accessPoints.map((ap, i) => (
        <circle
          key={i}
          cx={ox + ap.x * s}
          cy={oy + ap.y * s}
          r={2}
          fill={ap.color}
        />
      ))}
    </svg>
  );
}
