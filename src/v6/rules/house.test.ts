import { describe, expect, it } from 'vitest';
import {
  HOLLOW_20, SCALES, adjacent, capacityOf, diameter, distance, doorsOf,
  isSpoke, landingOf, legalMoves, makeHouse, spokesOf,
} from './house.js';

describe('the house', () => {
  it('is 20 rooms over three floors', () => {
    expect(Object.keys(HOLLOW_20.rooms)).toHaveLength(20);
    expect(HOLLOW_20.landings).toEqual(['landing_0', 'landing_1', 'landing_2']);
    expect(Object.values(HOLLOW_20.rooms).filter((r) => r.kind === 'spoke')).toHaveLength(17);
  });

  it('holds diameter 4 at every scale the design lists', () => {
    for (const [players, spokes] of Object.entries(SCALES)) {
      const house = makeHouse(spokes);
      expect(diameter(house), `${players} players`).toBe(4);
    }
  });

  it('makes every spoke a dead end holding two', () => {
    for (const room of Object.values(HOLLOW_20.rooms)) {
      if (room.kind !== 'spoke') continue;
      expect(room.doors).toHaveLength(1);
      expect(room.capacity).toBe(2);
    }
  });

  it('leaves landings unbounded, because a trio has to be able to shelter somewhere', () => {
    for (const l of HOLLOW_20.landings) expect(capacityOf(HOLLOW_20, l)).toBe(Infinity);
  });

  it('gives a player in a spoke exactly one legal move', () => {
    // The whole trail mechanic rests on this: nobody hides in the dark two
    // nights running, so a sock in a spoke pins the villain to its landing on
    // the nights either side.
    for (const room of Object.values(HOLLOW_20.rooms)) {
      if (room.kind !== 'spoke') continue;
      expect(legalMoves(HOLLOW_20, room.id)).toEqual([landingOf(HOLLOW_20, room.id)]);
    }
  });

  it('chains the landings ground-upward and nowhere else', () => {
    expect(adjacent(HOLLOW_20, 'landing_0', 'landing_1')).toBe(true);
    expect(adjacent(HOLLOW_20, 'landing_1', 'landing_2')).toBe(true);
    expect(adjacent(HOLLOW_20, 'landing_0', 'landing_2')).toBe(false);
    expect(distance(HOLLOW_20, 'landing_0', 'landing_2')).toBe(2);
  });

  it('starts everyone on the ground landing, not in a spoke', () => {
    // A spoke holds two. Starting six players in one would break capacity on
    // night zero, and would make night one structurally take-free by funnelling
    // the whole house through a single exit.
    expect(HOLLOW_20.start).toBe('landing_0');
    expect(isSpoke(HOLLOW_20, HOLLOW_20.start)).toBe(false);
    expect(capacityOf(HOLLOW_20, HOLLOW_20.start)).toBe(Infinity);
  });

  it('walks the longest path spoke to spoke across the house', () => {
    expect(distance(HOLLOW_20, 's0_0', 's2_0')).toBe(4);
  });

  it('hangs the right spokes off each landing', () => {
    expect(spokesOf(HOLLOW_20, 'landing_0')).toHaveLength(6);
    expect(spokesOf(HOLLOW_20, 'landing_1')).toHaveLength(5);
    expect(spokesOf(HOLLOW_20, 'landing_2')).toHaveLength(6);
    expect(doorsOf(HOLLOW_20, 'landing_1')).toHaveLength(7); // 2 stairs + 5 spokes
  });

  it('reports Infinity when a door is wedged shut', () => {
    expect(distance(HOLLOW_20, 's0_0', 's2_0', (r) => r === 'landing_1')).toBe(Infinity);
  });

  it('refuses a house it cannot build', () => {
    expect(() => makeHouse([6])).toThrow(/two floors/);
    expect(() => makeHouse([6, 5], 0)).toThrow(/spokeCapacity/);
  });
});
