/**
 * Built-in floor plan scenario templates.
 *
 * Coordinate system: pixels, origin at top-left.
 * All wall and AP positions are in canvas pixels.
 * pixelsPerMeter converts between pixels and real-world metres.
 *
 * Residential scenarios use 80 px/m so a typical apartment fits
 * in a 900–1200 px canvas with readable detail.
 * SMB scenarios use 30–40 px/m to show larger floor plates.
 */

import type { ScenarioTemplate } from '../types';

// ─── Scenario 1: Home Apartment (家庭公寓) ────────────────────────────────────
// ~80 m²  (10 m × 8 m)  →  800 × 640 px @ 80 px/m
// Layout:
//   Top half:    Living / Dining Room (full width)
//   Bottom-left: Master Bedroom
//   Bottom-right top: Kitchen
//   Bottom-right bot: Bathroom
const homeApartment: ScenarioTemplate = {
  id: 'home-apartment',
  name: '家庭公寓 / Apartment',
  category: 'residential',
  description: '两居室公寓，约80㎡ | Two-bedroom apartment ~80 m²',
  floorPlan: { width: 800, height: 640 },
  pixelsPerMeter: 80,
  walls: [
    // Exterior perimeter
    { x1:   0, y1:   0, x2: 800, y2:   0, type: 'exterior' },
    { x1: 800, y1:   0, x2: 800, y2: 640, type: 'exterior' },
    { x1: 800, y1: 640, x2:   0, y2: 640, type: 'exterior' },
    { x1:   0, y1: 640, x2:   0, y2:   0, type: 'exterior' },
    // Horizontal concrete separator (living / bedroom zone)
    { x1:   0, y1: 320, x2: 800, y2: 320, type: 'concrete' },
    // Vertical: master bedroom / kitchen-bath divide
    { x1: 480, y1: 320, x2: 480, y2: 640, type: 'light' },
    // Horizontal: kitchen / bathroom divide (right column)
    { x1: 480, y1: 480, x2: 800, y2: 480, type: 'light' },
  ],
  accessPoints: [
    {
      x: 400, y: 160, name: 'AP 1', band: '2.4GHz', channel: 6,
      txPower: 20, gain: 2, enabled: true, color: '#3b82f6',
    },
  ],
};

// ─── Scenario 2: 3-Bedroom Home (三居室住宅) ─────────────────────────────────
// ~120 m²  (15 m × 8 m)  →  1200 × 640 px @ 80 px/m
// Layout:
//   Top half (y 0-320):  Living / Dining Room (full width)
//   Mid row  (y 320-500): Bedroom 1 | Bedroom 2 | Bedroom 3
//   Bottom   (y 500-640): Kitchen+Dining | Bathroom | Bathroom
const home3BR: ScenarioTemplate = {
  id: 'home-3br',
  name: '三居室住宅 / 3-Bedroom Home',
  category: 'residential',
  description: '三居室住宅，约120㎡ | Three-bedroom home ~120 m²',
  floorPlan: { width: 1200, height: 640 },
  pixelsPerMeter: 80,
  walls: [
    // Exterior perimeter
    { x1:    0, y1:   0, x2: 1200, y2:   0, type: 'exterior' },
    { x1: 1200, y1:   0, x2: 1200, y2: 640, type: 'exterior' },
    { x1: 1200, y1: 640, x2:    0, y2: 640, type: 'exterior' },
    { x1:    0, y1: 640, x2:    0, y2:   0, type: 'exterior' },
    // Horizontal concrete: living / bedroom zone
    { x1:    0, y1: 320, x2: 1200, y2: 320, type: 'concrete' },
    // Horizontal light: bedroom / service zone
    { x1:    0, y1: 500, x2: 1200, y2: 500, type: 'light' },
    // Bedroom dividers (mid row)
    { x1:  380, y1: 320, x2:  380, y2: 500, type: 'light' },
    { x1:  800, y1: 320, x2:  800, y2: 500, type: 'light' },
    // Service zone dividers
    { x1:  560, y1: 500, x2:  560, y2: 640, type: 'light' },
    { x1:  880, y1: 500, x2:  880, y2: 640, type: 'light' },
  ],
  accessPoints: [
    {
      x: 600, y: 160, name: 'AP 1', band: '2.4GHz', channel: 1,
      txPower: 20, gain: 2, enabled: true, color: '#3b82f6',
    },
    {
      x: 600, y: 410, name: 'AP 2', band: '2.4GHz', channel: 6,
      txPower: 20, gain: 2, enabled: true, color: '#10b981',
    },
  ],
};

// ─── Scenario 3: SMB Open Office (SMB开放办公) ────────────────────────────────
// ~350 m²  (46 m × 8 m)  →  1380 × 720 px @ 30 px/m
// Layout:
//   Top zone  (y 0-480):  Open-plan office space
//   Bot-left  (y 480-720): Server Room | Conference Room
//   Bot-right (y 480-720): Reception / Lobby
const smbOpenOffice: ScenarioTemplate = {
  id: 'smb-open-office',
  name: 'SMB开放办公 / Open Office',
  category: 'smb',
  description: '中小企业开放式办公，约350㎡ | SMB open-plan office ~350 m²',
  floorPlan: { width: 1380, height: 720 },
  pixelsPerMeter: 30,
  walls: [
    // Exterior perimeter
    { x1:    0, y1:   0, x2: 1380, y2:   0, type: 'exterior' },
    { x1: 1380, y1:   0, x2: 1380, y2: 720, type: 'exterior' },
    { x1: 1380, y1: 720, x2:    0, y2: 720, type: 'exterior' },
    { x1:    0, y1: 720, x2:    0, y2:   0, type: 'exterior' },
    // Horizontal concrete: office / ancillary zone
    { x1:    0, y1: 480, x2: 1380, y2: 480, type: 'concrete' },
    // Server room (left, secure)
    { x1:  210, y1: 480, x2:  210, y2: 720, type: 'concrete' },
    // Conference room separator
    { x1:  570, y1: 480, x2:  570, y2: 720, type: 'light' },
    // Reception separator
    { x1:  870, y1: 480, x2:  870, y2: 720, type: 'light' },
    // Internal office divider (loose partitions)
    { x1:  690, y1:   0, x2:  690, y2: 480, type: 'glass' },
  ],
  accessPoints: [
    {
      x: 300, y: 240, name: 'AP 1', band: '5GHz', channel: 36,
      txPower: 23, gain: 3, enabled: true, color: '#3b82f6',
    },
    {
      x: 830, y: 240, name: 'AP 2', band: '5GHz', channel: 48,
      txPower: 23, gain: 3, enabled: true, color: '#10b981',
    },
    {
      x: 1180, y: 240, name: 'AP 3', band: '5GHz', channel: 36,
      txPower: 23, gain: 3, enabled: true, color: '#f59e0b',
    },
    {
      x: 720, y: 600, name: 'AP 4', band: '2.4GHz', channel: 6,
      txPower: 20, gain: 2, enabled: true, color: '#8b5cf6',
    },
  ],
};

// ─── Scenario 4: SMB Floor Plan (SMB楼层) ─────────────────────────────────────
// ~600 m²  (50 m × 12 m)  →  1500 × 840 px @ 30 px/m
// Layout:
//   Corridor (y 0-150, full width)
//   Upper offices (y 150-570): Conf A | Office A | Office B | Open Work | Office C
//   Lower offices (y 570-840): Meeting | Open Work 2 | Pantry | Washroom
const smbFloor: ScenarioTemplate = {
  id: 'smb-floor',
  name: 'SMB楼层 / Office Floor',
  category: 'smb',
  description: '中小企业完整楼层，约600㎡ | SMB full floor ~600 m²',
  floorPlan: { width: 1500, height: 840 },
  pixelsPerMeter: 30,
  walls: [
    // Exterior perimeter
    { x1:    0, y1:   0, x2: 1500, y2:   0, type: 'exterior' },
    { x1: 1500, y1:   0, x2: 1500, y2: 840, type: 'exterior' },
    { x1: 1500, y1: 840, x2:    0, y2: 840, type: 'exterior' },
    { x1:    0, y1: 840, x2:    0, y2:   0, type: 'exterior' },
    // Corridor horizontal walls
    { x1:    0, y1: 150, x2: 1500, y2: 150, type: 'concrete' },
    { x1:    0, y1: 570, x2: 1500, y2: 570, type: 'concrete' },
    // Upper office dividers (y 150-570)
    { x1:  240, y1: 150, x2:  240, y2: 570, type: 'light' },
    { x1:  480, y1: 150, x2:  480, y2: 570, type: 'light' },
    { x1:  720, y1: 150, x2:  720, y2: 570, type: 'light' },
    { x1: 1140, y1: 150, x2: 1140, y2: 570, type: 'light' },
    // Lower zone dividers (y 570-840)
    { x1:  360, y1: 570, x2:  360, y2: 840, type: 'light' },
    { x1:  840, y1: 570, x2:  840, y2: 840, type: 'light' },
    { x1: 1140, y1: 570, x2: 1140, y2: 840, type: 'light' },
  ],
  accessPoints: [
    // Corridor AP
    {
      x: 750, y: 75, name: 'AP 1', band: '2.4GHz', channel: 1,
      txPower: 20, gain: 2, enabled: true, color: '#3b82f6',
    },
    // Upper left offices
    {
      x: 360, y: 360, name: 'AP 2', band: '5GHz', channel: 36,
      txPower: 23, gain: 3, enabled: true, color: '#10b981',
    },
    // Open work area
    {
      x: 930, y: 360, name: 'AP 3', band: '5GHz', channel: 48,
      txPower: 23, gain: 3, enabled: true, color: '#f59e0b',
    },
    // Right offices
    {
      x: 1320, y: 360, name: 'AP 4', band: '5GHz', channel: 36,
      txPower: 23, gain: 3, enabled: true, color: '#ef4444',
    },
    // Lower zone
    {
      x: 600, y: 705, name: 'AP 5', band: '5GHz', channel: 44,
      txPower: 23, gain: 3, enabled: true, color: '#8b5cf6',
    },
    {
      x: 990, y: 705, name: 'AP 6', band: '2.4GHz', channel: 11,
      txPower: 20, gain: 2, enabled: true, color: '#ec4899',
    },
  ],
};

export const SCENARIOS: ScenarioTemplate[] = [
  homeApartment,
  home3BR,
  smbOpenOffice,
  smbFloor,
];
