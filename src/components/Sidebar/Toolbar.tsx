import { MousePointer, Wifi, Minus, Eraser, Ruler, Radio } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';
import { useI18n } from '../../i18n/I18nContext';
import type { Tool, WallType } from '../../types';
import { WALL_CONFIGS } from '../../types';

const TOOLS: { id: Tool; labelKey: 'toolSelectMove' | 'toolPlaceAp' | 'toolDrawWall' | 'toolErase' | 'toolMeasure' | 'toolStation'; icon: React.ReactNode; shortcut: string }[] = [
  { id: 'select', labelKey: 'toolSelectMove', icon: <MousePointer size={18} />, shortcut: '1' },
  { id: 'ap', labelKey: 'toolPlaceAp', icon: <Wifi size={18} />, shortcut: '2' },
  { id: 'wall', labelKey: 'toolDrawWall', icon: <Minus size={18} />, shortcut: '3' },
  { id: 'erase', labelKey: 'toolErase', icon: <Eraser size={18} />, shortcut: '4' },
  { id: 'measure', labelKey: 'toolMeasure', icon: <Ruler size={18} />, shortcut: '5' },
  { id: 'station', labelKey: 'toolStation', icon: <Radio size={18} />, shortcut: '6' },
];

const WALL_TYPES: WallType[] = ['light', 'glass', 'concrete', 'exterior'];

const WALL_LABEL_KEYS: Record<WallType, 'wallLight' | 'wallGlass' | 'wallConcrete' | 'wallExterior'> = {
  light: 'wallLight',
  glass: 'wallGlass',
  concrete: 'wallConcrete',
  exterior: 'wallExterior',
};

export function Toolbar() {
  const { t } = useI18n();
  const { activeTool, selectedWallType, setActiveTool, setSelectedWallType } = usePlannerStore();

  return (
    <div className="p-3 border-b border-gray-200 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('tools')}</h3>

      {/* Tool buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={`${t(tool.labelKey)} (${tool.shortcut})`}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTool === tool.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tool.icon}
            <span className="truncate">{t(tool.labelKey)}</span>
            <span className={`ml-auto text-xs rounded px-1 ${
              activeTool === tool.id ? 'bg-primary-500 text-primary-100' : 'bg-gray-200 text-gray-500'
            }`}>
              {tool.shortcut}
            </span>
          </button>
        ))}
      </div>

      {/* Wall type selector - only shown when wall tool active */}
      {activeTool === 'wall' && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-gray-500">{t('wallType')}</h4>
          <div className="space-y-1">
            {WALL_TYPES.map(type => {
              const config = WALL_CONFIGS[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedWallType(type)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                    selectedWallType === type
                      ? 'bg-primary-50 border border-primary-200 text-primary-800'
                      : 'border border-transparent text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: config.width * 2,
                      height: 12,
                      background: config.color,
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  />
                  <span className="flex-1 text-left">{t(WALL_LABEL_KEYS[type])}</span>
                  <span className="text-xs text-gray-400">-{config.attenuation}dB</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 space-y-0.5">
        <p>• {t('keyboardHintPanZoom')}</p>
        <p>• {t('keyboardHintDelete')}</p>
        <p>• {t('keyboardHintEsc')}</p>
      </div>
    </div>
  );
}
