import { Wifi, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlannerStore } from '../../store/plannerStore';
import type { AccessPoint, Band } from '../../types';
import { BAND_CHANNELS } from '../../types';

export function APPanel() {
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
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Floor Plan Scale</h4>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">px / meter:</label>
          <input
            type="number"
            min={5}
            max={200}
            value={pixelsPerMeter}
            onChange={e => setPixelsPerMeter(Number(e.target.value))}
            className="w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <p className="text-xs text-gray-400">
          1 grid cell = {(1).toFixed(1)}m = {pixelsPerMeter}px
        </p>
      </div>

      {/* Access points list */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Access Points ({accessPoints.length})
        </h4>

        {accessPoints.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <Wifi className="mx-auto mb-2 opacity-30" size={32} />
            <p>No access points placed yet.</p>
            <p className="text-xs mt-1">Select the AP tool and click on the floor plan.</p>
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
                onUpdate={(updates) => updateAccessPoint(ap.id, updates)}
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
  onUpdate: (updates: Partial<AccessPoint>) => void;
};

function APListItem({ ap, isSelected, onSelect, onToggle, onRemove }: APListItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-primary-50 border border-primary-200'
          : 'border border-transparent hover:bg-gray-50'
      }`}
    >
      {/* Color dot */}
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: ap.color, opacity: ap.enabled ? 1 : 0.4 }}
      />

      {/* AP info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate ${!ap.enabled ? 'text-gray-400' : 'text-gray-800'}`}>
            {ap.name}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {ap.band} · ch {ap.channel} · {ap.txPower}dBm
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="p-1 rounded hover:bg-gray-200 text-gray-500"
          title={ap.enabled ? 'Disable' : 'Enable'}
        >
          {ap.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
          title="Remove AP"
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
  const bands: Band[] = ['2.4GHz', '5GHz', '6GHz'];

  const handleBandChange = (band: Band) => {
    const channels = BAND_CHANNELS[band];
    onUpdate({ band, channel: channels[0] });
  };

  return (
    <div className="border border-primary-200 bg-primary-50 rounded-lg p-3 space-y-3">
      <h4 className="text-xs font-semibold text-primary-700 uppercase tracking-wider">
        Configure: {ap.name}
      </h4>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">Name</label>
        <input
          type="text"
          value={ap.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white"
        />
      </div>

      {/* Band */}
      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">Frequency Band</label>
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

      {/* Channel */}
      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">Channel</label>
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

      {/* TX Power */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-xs text-gray-600 font-medium">TX Power</label>
          <span className="text-xs text-gray-500">{ap.txPower} dBm ({Math.round(Math.pow(10, ap.txPower / 10))} mW)</span>
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
          <span>0 dBm (1mW)</span>
          <span>33 dBm (2W)</span>
        </div>
      </div>

      {/* Antenna Gain */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-xs text-gray-600 font-medium">Antenna Gain</label>
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
          <span>0 dBi (omni)</span>
          <span>15 dBi (directional)</span>
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-gray-600 font-medium">X (px)</label>
          <input
            type="number"
            value={Math.round(ap.x)}
            onChange={e => onUpdate({ x: Number(e.target.value) })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600 font-medium">Y (px)</label>
          <input
            type="number"
            value={Math.round(ap.y)}
            onChange={e => onUpdate({ y: Number(e.target.value) })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 bg-white"
          />
        </div>
      </div>

      {/* AP Color */}
      <div className="space-y-1">
        <label className="text-xs text-gray-600 font-medium">Color</label>
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
