import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { randomBot } from '../bots/random.js';
import { HOLLOW_HOUSE } from '../rules/houses/hollow.js';
import { viableRoomsAt, solve, reachableInFourHops } from './safeLies.js';
import type { GameRecord } from '../rules/game.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number): GameRecord => playGame(makeConfig(), seed, bots);

describe('reachableInFourHops', () => {
  it('cannot enter a dead-end bedroom whose one door cannot make a three-edge round trip', () => {
    expect(reachableInFourHops(HOLLOW_HOUSE, 'east_hall', 'bed_clem')).toBe(false);
    expect(reachableInFourHops(HOLLOW_HOUSE, 'landing', 'bed_wren')).toBe(false);
    expect(reachableInFourHops(HOLLOW_HOUSE, 'sewing_room', 'bed_moss')).toBe(false);
    expect(reachableInFourHops(HOLLOW_HOUSE, 'attic', 'bed_moss')).toBe(false);
  });

  it('enters a dead-end bedroom whose neighbour can make the three-edge round trip', () => {
    expect(reachableInFourHops(HOLLOW_HOUSE, 'west_hall', 'bed_bell')).toBe(true);
  });
});

describe('viableRoomsAt', () => {
  it('never marks a room viable when a lit-room witness saw the villain elsewhere', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = play(seed);
      g.nights.forEach((n, i) => {
        const seen = ROSTER.some((p) =>
          p !== g.villain && n.sightings[p]!.lit && n.sightings[p]!.named.includes(g.villain));
        if (!seen) return;
        const truth = n.midnightPositions[g.villain]!;
        expect(viableRoomsAt(g, i + 1)).toEqual([truth]);
      });
    }
  });

  it('always includes the villain\'s true room — the truth is never contradicted', () => {
    for (let seed = 0; seed < 60; seed++) {
      const g = play(seed);
      g.nights.forEach((n, i) => {
        expect(viableRoomsAt(g, i + 1)).toContain(n.midnightPositions[g.villain]);
      });
    }
  });

  it('refutes a lit room whose occupants did not name the villain', () => {
    const g = play(3);
    const night = g.nights[1]!;
    const occupied = ROSTER.find((p) =>
      p !== g.villain && night.sightings[p]!.lit &&
      night.midnightPositions[p] !== night.midnightPositions[g.villain]);
    if (!occupied) return;
    expect(viableRoomsAt(g, 2)).not.toContain(night.midnightPositions[occupied]);
  });
});

describe('solve', () => {
  it('reports a hiding space for every night played', () => {
    const g = play(11);
    const r = solve(g);
    expect(r.hidingSpace).toHaveLength(g.nights.length);
    for (const n of r.hidingSpace) expect(n).toBeGreaterThanOrEqual(0);
  });

  it('never reports a forced contradiction, since the truth is always available', () => {
    // The true claim history is always consistent, so no game can be "forced"
    // unless a constraint is wrong. This is the solver's own correctness check.
    for (let seed = 0; seed < 100; seed++) {
      expect(solve(play(seed)).forcedNight).toBeNull();
    }
  });

  it('collapses the hiding space to one when the villain is fully witnessed', () => {
    const g = play(5);
    const r = solve(g);
    g.nights.forEach((n, i) => {
      const witnessed = ROSTER.some((p) =>
        p !== g.villain && n.sightings[p]!.lit && n.sightings[p]!.named.includes(g.villain));
      if (witnessed) expect(r.hidingSpace[i]).toBe(1);
    });
  });
});
