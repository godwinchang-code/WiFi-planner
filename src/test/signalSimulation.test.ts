import { describe, it, expect } from 'vitest';
import {
  freeSpacePathLoss,
  calculateRSSI,
  getBestRSSI,
  rssiToColor,
  getSignalQuality,
} from '../utils/signalSimulation';
import type { AccessPoint, Wall } from '../types';

const makeAP = (overrides: Partial<AccessPoint> = {}): AccessPoint => ({
  id: 'test-ap',
  x: 100,
  y: 100,
  name: 'Test AP',
  band: '2.4GHz',
  channel: 6,
  txPower: 20,
  gain: 2,
  enabled: true,
  color: '#3b82f6',
  ...overrides,
});

describe('freeSpacePathLoss', () => {
  it('increases with distance', () => {
    const loss1 = freeSpacePathLoss(1, 2.437);
    const loss10 = freeSpacePathLoss(10, 2.437);
    expect(loss10).toBeGreaterThan(loss1);
  });

  it('is approximately 40 dB at 1m for 2.4GHz', () => {
    const loss = freeSpacePathLoss(1, 2.437);
    // FSPL at 1m, 2.437 GHz ≈ 40 dB
    expect(loss).toBeGreaterThan(35);
    expect(loss).toBeLessThan(45);
  });

  it('increases with frequency', () => {
    const loss24 = freeSpacePathLoss(10, 2.437);
    const loss5 = freeSpacePathLoss(10, 5.5);
    expect(loss5).toBeGreaterThan(loss24);
  });

  it('returns 0 for zero distance', () => {
    expect(freeSpacePathLoss(0, 2.437)).toBe(0);
  });
});

describe('calculateRSSI', () => {
  it('returns high RSSI very close to AP', () => {
    const ap = makeAP({ x: 100, y: 100 });
    const rssi = calculateRSSI(ap, 100, 101, 20, [], '2.4GHz');
    // At 0.05m distance, should be very strong
    expect(rssi).toBeGreaterThan(0);
  });

  it('decreases with distance', () => {
    const ap = makeAP({ x: 0, y: 0 });
    const rssiNear = calculateRSSI(ap, 20, 0, 20, [], '2.4GHz');  // 1m
    const rssiMid = calculateRSSI(ap, 200, 0, 20, [], '2.4GHz'); // 10m
    const rssiLong = calculateRSSI(ap, 1000, 0, 20, [], '2.4GHz'); // 50m
    expect(rssiNear).toBeGreaterThan(rssiMid);
    expect(rssiMid).toBeGreaterThan(rssiLong);
  });

  it('accounts for wall attenuation', () => {
    const ap = makeAP({ x: 0, y: 0 });
    const wall: Wall = {
      id: 'w1', x1: 50, y1: -50, x2: 50, y2: 50,
      type: 'concrete',
    };
    const rssiNoWall = calculateRSSI(ap, 200, 0, 20, [], '2.4GHz');
    const rssiWithWall = calculateRSSI(ap, 200, 0, 20, [wall], '2.4GHz');
    expect(rssiNoWall).toBeGreaterThan(rssiWithWall);
  });

  it('respects AP TX power', () => {
    const apLow = makeAP({ txPower: 10 });
    const apHigh = makeAP({ txPower: 30 });
    const rssiLow = calculateRSSI(apLow, 200, 100, 20, [], '2.4GHz');
    const rssiHigh = calculateRSSI(apHigh, 200, 100, 20, [], '2.4GHz');
    expect(rssiHigh).toBeGreaterThan(rssiLow);
  });
});

describe('getBestRSSI', () => {
  it('returns -Infinity when no APs', () => {
    const rssi = getBestRSSI({ x: 100, y: 100 }, [], [], 20, '2.4GHz');
    expect(rssi).toBe(-Infinity);
  });

  it('ignores disabled APs', () => {
    const ap = makeAP({ enabled: false, x: 0, y: 0 });
    const rssi = getBestRSSI({ x: 0, y: 1 }, [ap], [], 20, '2.4GHz');
    expect(rssi).toBe(-Infinity);
  });

  it('returns best signal from multiple APs', () => {
    const ap1 = makeAP({ id: 'ap1', x: 0, y: 0 });
    const ap2 = makeAP({ id: 'ap2', x: 1000, y: 1000 });
    const point = { x: 10, y: 0 }; // Close to ap1
    const rssi = getBestRSSI(point, [ap1, ap2], [], 20, '2.4GHz');
    const rssi1 = calculateRSSI(ap1, point.x, point.y, 20, [], '2.4GHz');
    expect(rssi).toBeCloseTo(rssi1, 1);
  });
});

describe('rssiToColor', () => {
  it('returns green for excellent signal', () => {
    const color = rssiToColor(-45);
    expect(color.g).toBeGreaterThan(color.r);
    expect(color.a).toBeGreaterThan(0.5);
  });

  it('returns transparent/no coverage for very weak signal', () => {
    const color = rssiToColor(-100);
    expect(color.a).toBeLessThan(0.1);
  });

  it('returns some color for medium signal', () => {
    const color = rssiToColor(-65);
    expect(color.a).toBeGreaterThan(0);
  });
});

describe('getSignalQuality', () => {
  it('classifies signal correctly', () => {
    expect(getSignalQuality(-40)).toBe('excellent');
    expect(getSignalQuality(-55)).toBe('good');
    expect(getSignalQuality(-65)).toBe('fair');
    expect(getSignalQuality(-75)).toBe('poor');
    expect(getSignalQuality(-85)).toBe('none');
  });
});
