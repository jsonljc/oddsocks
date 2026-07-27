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

  // Under the default config, the heuristic bot's villain never self-snuffs
  // (selfSnuffCostsNight: true means it never pays off), so selfSnuffs is
  // always 0 above — the subset check holds no matter what selfSnuffs counts,
  // including a wrong count (even "every theft is a self-snuff" satisfies a
  // subset-of-itself bound). Make snuffing free so real self-snuffs occur, and
  // pin the exact count against an expected value derived independently in
  // this test — straight off `victim`/`villain` on the raw record, never
  // through measure()'s own internals — so a wrong predicate (e.g. inverted,
  // or "every theft counts") diverges from it on the very first seed that has
  // both a self-snuff and an ordinary theft.
  it('counts exactly the theft nights whose victim is the villain', () => {
    const freeSnuffConfig = makeConfig({ selfSnuffCostsNight: false });
    let sawSelfSnuff = false;
    for (let seed = 0; seed < 60; seed++) {
      const g = playGame(freeSnuffConfig, seed, bots);
      const m = measure(g);
      const expected = g.nights.filter((n) =>
        n.events.some((e) => e.t === 'theft' && e.victim === g.villain)).length;
      expect(m.selfSnuffs).toBe(expected);
      expect(m.selfSnuffs).toBeLessThanOrEqual(m.thefts);
      if (m.selfSnuffs > 0) sawSelfSnuff = true;
    }
    // A villain owns exactly one bedroom, so a game has at most one self-snuff —
    // but across 60 seeds with snuffing free, at least one must land, or the
    // equality above is only ever confirming 0 === 0.
    expect(sawSelfSnuff).toBe(true);
  });

  // thefts <= activeNights and markings >= 0 individually are both satisfiable
  // by a broken measure() (e.g. markings := thefts, or markings := activeNights
  // outright) as long as neither goes negative — the non-negativity clamp in
  // the implementation would hide exactly that regression. Pin the exact
  // identity instead, using only g.nights.length (never measure()'s own
  // internals): night 1 is always safe, so every other night played is active
  // and lands in exactly one of these two buckets, no third option.
  it('splits every active night exactly between a theft and a marking', () => {
    for (let seed = 0; seed < 60; seed++) {
      const g = play(seed);
      const m = measure(g);
      expect(m.thefts + m.markings).toBe(g.nights.length - 1);
    }
  });
});
