import { Wifi, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';
import { useI18n } from '../../i18n/I18nContext';
import type { AccessPoint, Band } from '../../types';
import { BAND_CHANNELS } from '../../types';

export function APPanel() {
  const { t } = useI18n();
  const {
    accessPoints, selectedAPId, pixelsPerMeter,
    selectAP, updateAccessPoint, removeAccessPoint, toggleAPEnabled,
    setPixelsPerMeter,
  } = usePlannerStore();

  const selectedAP = accessPoints.find(ap => ap.id === selectedAPId);

  return (
    <div className="p-3 space-y-3 flex-1 overflow-y-auto">
      {/* Scale settings */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('floorScale')}</h4>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">{t('pxPerMeter')}</label>
          <input
            type="number"
            min={1}
            max={500}
            step={1}
            value={pixelsPerMeter}
            onChange={e => setPixelsPerMeter(Number(e.target.value))}
            className="w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <p className="text-xs text-gray-400">
          {t('gridCellScale', { meters: (1).toFixed(1), pixels: pixelsPerMeter })}
        </p>
      </div>

      {/* Access points list */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {t('accessPoints', { count: accessPoints.length })}
        </h4>

        {accessPoints.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <Wifi className="mx-auto mb-2 opacity-30" size={32} />
            <p>{t('noAccessPoints')}</p>
            <p className="text-xs mt-1">{t('placeApHint')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {accessPoints.map(ap => (
              <APListItem
                key={ap.id}
                ap={ap}
                isSelected={ap.id === selectedAPId}
                onSelect={() => selectAP(ap.id === selectedAPId ? null : ap.id)}
                onToggle={() => toggleAPEnabled(ap.id)}
                onRemove={() => removeAccessPoint(ap.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected AP details */}
      {selectedAP && (
        <APDetailPanel
          ap={selectedAP}
          onUpdate={(updates) => updateAccessPoint(selectedAP.id, updates)}
        />
      )}
    </div>
  );
}

type APListItemProps = {
  ap: AccessPoint;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
};

function APListItem({ ap, isSelected, onSelect, onToggle, onRemove }: APListItemProps) {
  const { t } = useI18n();

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-primary-50 border border-primary-200'
          : 'border border-transparent hover:bg-gray-50'
      }`}
    >
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: ap.color, opacity: ap.enabled ? 1 : 0.4 }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate ${!ap.enabled ? 'text-gray-400' : 'text-gray-800'}`}>
            {ap.name}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {ap.band} · {t('channelShort')} {ap.channel} · {ap.txPower}dBm
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="p-1 rounded hover:bg-gray-200 text-gray-500"
          title={ap.enabled ? t('disable') : t('enable')}
        >
          {ap.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
          title={t('removeAp')}
        >
          <Trash2 size={14} />
        </button>
        <span className="text-gray-300">
          {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>
    </div>
  );
}

type APDetailProps = {
  ap: AccessPoint;
  onUpdate: (updates: Partial<AccessPoint>) => void;
};

function APDetailPanel({ ap, onUpdate }: APDetailProps) {
  const { t } = useI18n();
  const bands: Band[] = ['2.4GHz', '5GHz', '6GHz'];

  const handleBandChange = (band: Band) => {
    const channels = BAND_CHANNELS[band];
    onUpdate({ band, channel: channels[0] });
  };

  return (
    <div className="border border-primary-200 bg-primary-50 rounded-lg p-3 space-y-3">
      <h4 className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
        {t('configureAp', { name: ap.name })}
      </h4>

      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">{t('name')}</label>
        <input
          type="text"
          value={ap.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">{t('frequencyBand')}</label>
        <div className="grid grid-cols-3 gap-1">
          {bands.map(b => (
            <button
              key={b}
              onClick={() => handleBandChange(b)}
              className={`text-xs py-1.5 rounded font-medium transition-all ${
                ap.band === b
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">{t('channel')}</label>
        <select
          value={ap.channel}
          onChange={e => onUpdate({ channel: Number(e.target.value) })}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-primary-500 bg-white"
        >
          {BAND_CHANNELS[ap.band].map((ch: number) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-xs text-gray-600 font-medium">{t('txPower')}</label>
          <span className="text-xs text-gray-500">
            {t('txPowerValue', { dbm: ap.txPower, mw: Math.round(Math.pow(10, ap.txPower / 10)) })}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={33}
          step={1}
          value={ap.txPower}
          onChange={e => onUpdate({ txPower: Number(e.target.value) })}
          className="w-full accent-primary-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{t('txPowerMin')}</span>
          <span>{t('txPowerMax')}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-xs text-gray-600 font-medium">{t('antennaGain')}</label>
          <span className="text-xs text-gray-500">{ap.gain} dBi</span>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={ap.gain}
          onChange={e => onUpdate({ gain: Number(e.target.value) })}
          className="w-full accent-primary-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{t('omni')}</span>
          <span>{t('directional')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-gray-600 font-medium">{t('xPx')}</label>
          <input
            type="number"
            value={Math.round(ap.x)}
            onChange={e => onUpdate({ x: Number(e.target.value) })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600 font-medium">{t('yPx')}</label>
          <input
            type="number"
            value={Math.round(ap.y)}
            onChange={e => onUpdate({ y: Number(e.target.value) })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 bg-white"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">{t('color')}</label>
        <input
          type="color"
          value={ap.color}
          onChange={e => onUpdate({ color: e.target.value })}
          className="w-full h-8 rounded border border-gray-300 cursor-pointer"
        />
      </div>
    </div>
  );
}
