import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from '../store/plannerStore';

// Reset store before each test
beforeEach(() => {
  usePlannerStore.setState({
    accessPoints: [],
    walls: [],
    selectedAPId: null,
    selectedWallId: null,
    activeTool: 'select',
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

describe('plannerStore - export/import', () => {
  it('exports plan as JSON', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    usePlannerStore.getState().addWall(0, 0, 200, 200);
    const json = usePlannerStore.getState().exportPlan();
    const parsed = JSON.parse(json);
    expect(parsed.accessPoints).toHaveLength(1);
    expect(parsed.walls).toHaveLength(1);
    expect(parsed.version).toBe('1.0');
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

  it('clears all data', () => {
    usePlannerStore.getState().addAccessPoint(100, 100);
    usePlannerStore.getState().addWall(0, 0, 200, 200);
    usePlannerStore.getState().clearAll();
    const { accessPoints, walls } = usePlannerStore.getState();
    expect(accessPoints).toHaveLength(0);
    expect(walls).toHaveLength(0);
  });
});
