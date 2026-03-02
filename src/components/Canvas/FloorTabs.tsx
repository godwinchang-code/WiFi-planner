import { useState, useRef, useEffect } from 'react';
import { usePlannerStore } from '../../store/plannerStore';

export function FloorTabs() {
  const { floors, activeFloorId, switchFloor, addFloor, deleteFloor, renameFloor, moveFloor } =
    usePlannerStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const commitEdit = () => {
    if (editingId) {
      const trimmed = editName.trim();
      if (trimmed) renameFloor(editingId, trimmed);
      setEditingId(null);
    }
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f1f5f9',
        borderBottom: '1px solid #e2e8f0',
        padding: '4px 8px',
        gap: 2,
        overflowX: 'auto',
        flexShrink: 0,
        minHeight: 36,
        userSelect: 'none',
      }}
    >
      {/* Floor label */}
      <span
        style={{
          fontSize: 11,
          color: '#94a3b8',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginRight: 6,
          flexShrink: 0,
        }}
      >
        楼层
      </span>

      {/* Floor tabs */}
      {floors.map((floor, idx) => (
        <div
          key={floor.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
          }}
        >
          {editingId === floor.id ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              style={{
                width: 52,
                fontSize: 12,
                padding: '2px 6px',
                border: '1px solid #3b82f6',
                borderRadius: 4,
                outline: 'none',
                background: 'white',
              }}
            />
          ) : (
            <button
              onClick={() => switchFloor(floor.id)}
              onDoubleClick={() => startEdit(floor.id, floor.name)}
              title="单击切换楼层，双击重命名"
              style={{
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: floor.id === activeFloorId ? 600 : 400,
                background: floor.id === activeFloorId ? 'white' : 'transparent',
                border:
                  floor.id === activeFloorId
                    ? '1px solid #cbd5e1'
                    : '1px solid transparent',
                borderBottom:
                  floor.id === activeFloorId ? '1px solid white' : '1px solid transparent',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                color: floor.id === activeFloorId ? '#1d4ed8' : '#64748b',
                position: 'relative',
                top: floor.id === activeFloorId ? 1 : 0,
                transition: 'background 0.1s',
                whiteSpace: 'nowrap',
              }}
            >
              {floor.name}
            </button>
          )}

          {/* Reorder / delete buttons shown on active floor or hover via group */}
          {floor.id === activeFloorId && floors.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {idx > 0 && (
                <button
                  onClick={() => moveFloor(floor.id, 'up')}
                  title="上移"
                  style={iconBtnStyle}
                >
                  ‹
                </button>
              )}
              {idx < floors.length - 1 && (
                <button
                  onClick={() => moveFloor(floor.id, 'down')}
                  title="下移"
                  style={iconBtnStyle}
                >
                  ›
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm(`删除楼层 "${floor.name}"？此操作不可撤销。`)) {
                    deleteFloor(floor.id);
                  }
                }}
                title="删除此楼层"
                style={{ ...iconBtnStyle, color: '#ef4444' }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add floor button */}
      <button
        onClick={addFloor}
        title="添加楼层"
        style={{
          padding: '3px 10px',
          fontSize: 12,
          background: 'none',
          border: '1px dashed #cbd5e1',
          borderRadius: 4,
          cursor: 'pointer',
          color: '#64748b',
          flexShrink: 0,
          marginLeft: 4,
          transition: 'background 0.1s, border-color 0.1s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'none';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#cbd5e1';
        }}
      >
        + 添加楼层
      </button>

      {/* Floor count info */}
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: '#94a3b8',
          flexShrink: 0,
          paddingLeft: 8,
        }}
      >
        {floors.length} 层
      </span>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#94a3b8',
  fontSize: 14,
  lineHeight: 1,
  padding: '0 2px',
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
};
