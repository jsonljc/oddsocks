import { describe, it, expect } from 'vitest';
import { HOLLOW_HOUSE } from './houses/hollow.js';
import {
  doorsOf, isBedroom, ownerOf, bedroomOf, floorOf, adjacent,
  legalPaths, isLegalPath, distance, roomsWithin,
} from './map.js';

const H = HOLLOW_HOUSE;
const ROOMS = Object.keys(H.rooms);

describe('Hollow House', () => {
  it('has 12 rooms: 6 bedrooms and 6 commons', () => {
    expect(ROOMS).toHaveLength(12);
    expect(ROOMS.filter((r) => isBedroom(H, r))).toHaveLength(6);
    expect(ROOMS.filter((r) => !isBedroom(H, r))).toHaveLength(6);
  });

  it('gives every child exactly one owned bedroom', () => {
    for (const p of ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss']) {
      const bed = bedroomOf(H, p);
      expect(bed).toBe(`bed_${p}`);
      expect(ownerOf(H, bed)).toBe(p);
    }
  });

  it('has every door bidirectional', () => {
    for (const a of ROOMS) {
      for (const b of doorsOf(H, a)) {
        expect(doorsOf(H, b)).toContain(a);
      }
    }
  });

  it('has 14 edges', () => {
    const total = ROOMS.reduce((n, r) => n + doorsOf(H, r).length, 0);
    expect(total).toBe(28);
  });

  it('is fully connected with diameter 4', () => {
    let max = 0;
    for (const a of ROOMS) {
      for (const b of ROOMS) {
        const d = distance(H, a, b);
        expect(d).toBeLessThan(Infinity);
        max = Math.max(max, d);
      }
    }
    expect(max).toBe(4);
  });

  it('has two staircases and no others', () => {
    const stairs: string[] = [];
    for (const a of ROOMS) {
      for (const b of doorsOf(H, a)) {
        if (floorOf(H, a) !== floorOf(H, b) && a < b) stairs.push(`${a}->${b}`);
      }
    }
    expect(stairs.sort()).toEqual(['east_hall->sewing_room', 'landing->west_hall']);
  });
});

describe('paths', () => {
  it('treats a two-edge path as legal only if both steps are through doors', () => {
    expect(isLegalPath(H, 'bed_bell', ['west_hall', 'kitchen'])).toBe(true);
    expect(isLegalPath(H, 'bed_bell', ['kitchen', 'west_hall'])).toBe(false);
    expect(isLegalPath(H, 'bed_bell', ['west_hall', 'attic'])).toBe(false);
  });

  it('lets you stay home by stepping out and back', () => {
    expect(isLegalPath(H, 'bed_bell', ['west_hall', 'bed_bell'])).toBe(true);
  });

  it('enumerates every legal path from a room', () => {
    // bed_bell has one door (west_hall, degree 4) -> 4 paths.
    expect(legalPaths(H, 'bed_bell')).toHaveLength(4);
    // Every enumerated path must itself be legal.
    for (const room of ROOMS) {
      for (const p of legalPaths(H, room)) {
        expect(isLegalPath(H, room, p)).toBe(true);
      }
    }
  });

  it('can always stay home from any room', () => {
    for (const room of ROOMS) {
      const home = legalPaths(H, room).filter((p) => p[1] === room);
      expect(home.length).toBeGreaterThan(0);
    }
  });
});

describe('roomsWithin', () => {
  it('includes the room itself and its neighbours at radius 1', () => {
    expect(roomsWithin(H, 'bed_bell', 1).sort()).toEqual(['bed_bell', 'west_hall']);
    expect(roomsWithin(H, 'attic', 1).sort()).toEqual(['attic', 'bed_moss', 'landing']);
  });
});
