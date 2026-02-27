import type { Wall } from '../../types';
import { WALL_CONFIGS } from '../../types';

type Props = {
  walls: Wall[];
  selectedWallId: string | null;
  onSelect: (id: string) => void;
  zoom: number;
};

export function WallLayer({ walls, selectedWallId, onSelect, zoom }: Props) {
  return (
    <g>
      {walls.map(wall => {
        const config = WALL_CONFIGS[wall.type];
        const isSelected = wall.id === selectedWallId;
        return (
          <g key={wall.id}>
            {/* Hit area */}
            <line
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke="transparent"
              strokeWidth={Math.max(16, config.width * 2) / zoom}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(wall.id);
              }}
            />
            {/* Actual wall */}
            <line
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke={isSelected ? '#f59e0b' : config.color}
              strokeWidth={config.width / zoom}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
            {/* Selection indicator */}
            {isSelected && (
              <line
                x1={wall.x1}
                y1={wall.y1}
                x2={wall.x2}
                y2={wall.y2}
                stroke="#f59e0b"
                strokeWidth={(config.width + 4) / zoom}
                strokeLinecap="round"
                strokeOpacity={0.3}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
