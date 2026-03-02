import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from '../store/plannerStore';

// Reset store before each test – includes history so tests are fully isolated
beforeEach(() => {
  usePlannerStore.setState({
    accessPoints: [],
    walls: [],
    selectedAPId: null,
    selectedWallId: null,
    activeTool: 'select',
    _history: [{ accessPoints: [], walls: [] }],
    _historyIndex: 0,
  });
});

describe('plannerStore - access points', () => {
  it('starts with no access points', () => {
    const { accessPoints } = usePlannerStore.getState();
    expect(accessPoints).toHaveLength(0);
  });

  it('adds an access point', () => {
    usePlannerStore.getState().addAccessPoint(100, 200);
    const { accessPoints } = usePlannerStore.getState();
    expect(accessPoints).toHaveLength(1);
    expect(accessPoints[0].x).toBe(100);
    expect(accessPoints[0].y).toBe(200);
  });

  it('assigns unique IDs to access points', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    usePlannerStore.getState().addAccessPoint(200, 200);
    const { accessPoints } = usePlannerStore.getState();
    expect(accessPoints[0].id).not.toBe(accessPoints[1].id);
  });

  it('removes an access point', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const { accessPoints, removeAccessPoint } = usePlannerStore.getState();
    removeAccessPoint(accessPoints[0].id);
    expect(usePlannerStore.getState().accessPoints).toHaveLength(0);
  });

  it('updates an access point', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const { accessPoints, updateAccessPoint } = usePlannerStore.getState();
    const id = accessPoints[0].id;
    updateAccessPoint(id, { name: 'Updated AP', txPower: 25 });
    const updated = usePlannerStore.getState().accessPoints.find(ap => ap.id === id);
    expect(updated?.name).toBe('Updated AP');
    expect(updated?.txPower).toBe(25);
  });

  it('toggles AP enabled state', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const id = usePlannerStore.getState().accessPoints[0].id;
    expect(usePlannerStore.getState().accessPoints[0].enabled).toBe(true);
    usePlannerStore.getState().toggleAPEnabled(id);
    expect(usePlannerStore.getState().accessPoints[0].enabled).toBe(false);
    usePlannerStore.getState().toggleAPEnabled(id);
    expect(usePlannerStore.getState().accessPoints[0].enabled).toBe(true);
  });

  it('selects an access point', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const id = usePlannerStore.getState().accessPoints[0].id;
    usePlannerStore.getState().selectAP(id);
    expect(usePlannerStore.getState().selectedAPId).toBe(id);
  });

  it('clears selection when AP is removed', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const id = usePlannerStore.getState().accessPoints[0].id;
    usePlannerStore.getState().selectAP(id);
    usePlannerStore.getState().removeAccessPoint(id);
    expect(usePlannerStore.getState().selectedAPId).toBeNull();
  });
});

describe('plannerStore - walls', () => {
  it('adds a wall', () => {
    usePlannerStore.getState().addWall(0, 0, 100, 100);
    const { walls } = usePlannerStore.getState();
    expect(walls).toHaveLength(1);
    expect(walls[0].x1).toBe(0);
    expect(walls[0].y1).toBe(0);
    expect(walls[0].x2).toBe(100);
    expect(walls[0].y2).toBe(100);
  });

  it('removes a wall', () => {
    usePlannerStore.getState().addWall(0, 0, 100, 100);
    const { walls, removeWall } = usePlannerStore.getState();
    removeWall(walls[0].id);
    expect(usePlannerStore.getState().walls).toHaveLength(0);
  });

  it('updates a wall type', () => {
    usePlannerStore.getState().addWall(0, 0, 100, 100);
    const id = usePlannerStore.getState().walls[0].id;
    usePlannerStore.getState().updateWall(id, { type: 'concrete' });
    const wall = usePlannerStore.getState().walls.find(w => w.id === id);
    expect(wall?.type).toBe('concrete');
  });
});

describe('plannerStore - tools', () => {
  it('changes active tool', () => {
    usePlannerStore.getState().setActiveTool('ap');
    expect(usePlannerStore.getState().activeTool).toBe('ap');
    usePlannerStore.getState().setActiveTool('wall');
    expect(usePlannerStore.getState().activeTool).toBe('wall');
  });

  it('clears selection when tool changes', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const id = usePlannerStore.getState().accessPoints[0].id;
    usePlannerStore.getState().selectAP(id);
    usePlannerStore.getState().setActiveTool('wall');
    expect(usePlannerStore.getState().selectedAPId).toBeNull();
  });
});

describe('plannerStore - undo/redo', () => {
  it('canUndo() is false at the initial baseline', () => {
    expect(usePlannerStore.getState().canUndo()).toBe(false);
  });

  it('canRedo() is false when nothing has been undone', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    expect(usePlannerStore.getState().canRedo()).toBe(false);
  });

  it('undoes addAccessPoint', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    expect(usePlannerStore.getState().accessPoints).toHaveLength(1);
    expect(usePlannerStore.getState().canUndo()).toBe(true);

    usePlannerStore.getState().undo();
    expect(usePlannerStore.getState().accessPoints).toHaveLength(0);
    expect(usePlannerStore.getState().canUndo()).toBe(false);
  });

  it('redoes after undo', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    usePlannerStore.getState().undo();
    expect(usePlannerStore.getState().accessPoints).toHaveLength(0);
    expect(usePlannerStore.getState().canRedo()).toBe(true);

    usePlannerStore.getState().redo();
    expect(usePlannerStore.getState().accessPoints).toHaveLength(1);
  });

  it('redo is cleared when a new action is taken after undo', () => {
    usePlannerStore.getState().addAccessPoint(100, 100); // step 1
    usePlannerStore.getState().addAccessPoint(200, 200); // step 2
    usePlannerStore.getState().undo();                   // back to step 1
    expect(usePlannerStore.getState().canRedo()).toBe(true);

    usePlannerStore.getState().addWall(0, 0, 50, 50);   // branch – discards redo tail
    expect(usePlannerStore.getState().canRedo()).toBe(false);
    // Should have 1 AP (from step 1) and 1 wall (new branch)
    expect(usePlannerStore.getState().accessPoints).toHaveLength(1);
    expect(usePlannerStore.getState().walls).toHaveLength(1);
  });

  it('undoes addWall', () => {
    usePlannerStore.getState().addWall(0, 0, 100, 100);
    expect(usePlannerStore.getState().walls).toHaveLength(1);
    usePlannerStore.getState().undo();
    expect(usePlannerStore.getState().walls).toHaveLength(0);
  });

  it('undoes removeAccessPoint', () => {
    usePlannerStore.getState().addAccessPoint(50, 50);
    const id = usePlannerStore.getState().accessPoints[0].id;
    usePlannerStore.getState().removeAccessPoint(id);
    expect(usePlannerStore.getState().accessPoints).toHaveLength(0);
    usePlannerStore.getState().undo();
    expect(usePlannerStore.getState().accessPoints).toHaveLength(1);
  });

  it('multiple undo/redo cycles are stable', () => {
    usePlannerStore.getState().addAccessPoint(100, 100); // 1 AP
    usePlannerStore.getState().addAccessPoint(200, 200); // 2 APs
    usePlannerStore.getState().addWall(0, 0, 50, 50);   // 2 APs + 1 wall

    usePlannerStore.getState().undo(); // back to 2 APs
    expect(usePlannerStore.getState().accessPoints).toHaveLength(2);
    expect(usePlannerStore.getState().walls).toHaveLength(0);

    usePlannerStore.getState().undo(); // back to 1 AP
    expect(usePlannerStore.getState().accessPoints).toHaveLength(1);

    usePlannerStore.getState().redo(); // forward to 2 APs
    expect(usePlannerStore.getState().accessPoints).toHaveLength(2);

    usePlannerStore.getState().redo(); // forward to 2 APs + 1 wall
    expect(usePlannerStore.getState().accessPoints).toHaveLength(2);
    expect(usePlannerStore.getState().walls).toHaveLength(1);
  });
});

describe('plannerStore - export/import', () => {
  it('exports plan as JSON', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    usePlannerStore.getState().addWall(0, 0, 200, 200);
    const json = usePlannerStore.getState().exportPlan();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.2');
    expect(parsed.floors).toBeInstanceOf(Array);
    expect(parsed.floors.length).toBeGreaterThan(0);
    const activeFloor = parsed.floors.find((f: { id: string }) => f.id === parsed.activeFloorId);
    expect(activeFloor.accessPoints).toHaveLength(1);
    expect(activeFloor.walls).toHaveLength(1);
  });

  it('imports plan from JSON', () => {
    const json = JSON.stringify({
      version: '1.0',
      accessPoints: [{ id: 'ap-1', x: 50, y: 50, name: 'AP 1', band: '5GHz', channel: 36, txPower: 20, gain: 2, enabled: true, color: '#3b82f6' }],
      walls: [],
      pixelsPerMeter: 20,
    });
    usePlannerStore.getState().importPlan(json);
    const { accessPoints } = usePlannerStore.getState();
    expect(accessPoints).toHaveLength(1);
    expect(accessPoints[0].name).toBe('AP 1');
    expect(accessPoints[0].band).toBe('5GHz');
  });

  it('import resets undo history', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    const json = JSON.stringify({ version: '1.1', accessPoints: [], walls: [], pixelsPerMeter: 20 });
    usePlannerStore.getState().importPlan(json);
    // After import the history should be reset – nothing to undo
    expect(usePlannerStore.getState().canUndo()).toBe(false);
  });

  it('clears all data', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    usePlannerStore.getState().addWall(0, 0, 200, 200);
    usePlannerStore.getState().clearAll();
    const { accessPoints, walls } = usePlannerStore.getState();
    expect(accessPoints).toHaveLength(0);
    expect(walls).toHaveLength(0);
  });
});
