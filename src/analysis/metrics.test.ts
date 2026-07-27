import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { heuristicBot } from '../bots/heuristic.js';
import { measure } from './metrics.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));
const play = (seed: number) => playGame(makeConfig(), seed, bots);

describe('measure', () => {
  it('counts trail hits as a subset of trail namings', () => {
    for (let seed = 0; seed < 60; seed++) {
      const m = measure(play(seed));
      expect(m.trailHits).toBeLessThanOrEqual(m.trailNamings);
      expect(m.trailHits).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts live Calls as a subset of posted Calls, and caught as a subset of live', () => {
    for (let seed = 0; seed < 60; seed++) {
      const m = measure(play(seed));
      expect(m.callsLive).toBeLessThanOrEqual(m.callsPosted);
      expect(m.callsCaught).toBeLessThanOrEqual(m.callsLive);
    }
  });

  it('reports one hiding-space entry per night played', () => {
    const g = play(3);
    expect(measure(g).hidingSpace).toHaveLength(g.nights.length);
  });

  it('never reports more thefts than active nights', () => {
    const c = makeConfig();
    for (let seed = 0; seed < 60; seed++) {
      expect(measure(play(seed)).thefts).toBeLessThanOrEqual(c.activeNights);
    }
  });

  it('agrees with the recorded outcome', () => {
    const g = play(8);
    const m = measure(g);
    expect(m.winner).toBe(g.outcome.winner);
    expect(m.how).toBe(g.outcome.how);
    expect(m.nights).toBe(g.nights.length);
  });

  it('reports an encounter rate between 0 and 1', () => {
    for (let seed = 0; seed < 40; seed++) {
      const r = measure(play(seed)).encounterRate;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  // The brief's self-consistency checks not already covered above: a self-snuff
  // is one of the thefts that produced it, and a derived count can never go
  // negative even though nothing here clamps it away from the caller's view.
  it('counts self-snuffs as a subset of thefts', () => {
    for (let seed = 0; seed < 60; seed++) {
      const m = measure(play(seed));
      expect(m.selfSnuffs).toBeLessThanOrEqual(m.thefts);
      expect(m.selfSnuffs).toBeGreaterThanOrEqual(0);
    }
  });

  it('never reports a negative marking count', () => {
    for (let seed = 0; seed < 60; seed++) {
      expect(measure(play(seed)).markings).toBeGreaterThanOrEqual(0);
    }
  });
});
