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
    // Night 1 is safe, so the active nights are every other night on the clock.
    const activeNights = makeConfig().totalNights - 1;
    for (let seed = 0; seed < 60; seed++) {
      expect(measure(play(seed)).thefts).toBeLessThanOrEqual(activeNights);
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

  // `markings` used to be derived as `activeNights - thefts`, on the stated
  // grounds that an active night with no theft must have been a marking. There
  // is a third option, and it is the common one: the villain ends midnight with
  // no lit bedroom to rob and no company in the dark, and nothing happens at
  // all. Pin markings against the record's own field, and require the two
  // measures to actually disagree somewhere in the sample — otherwise this test
  // would pass just as happily on the derivation it replaced.
  it('counts exactly the nights the villain marked somebody', () => {
    let sawSubtractionDisagree = false;
    let totalMarkings = 0;
    for (let seed = 0; seed < 60; seed++) {
      const g = play(seed);
      const m = measure(g);
      expect(m.markings).toBe(g.nights.filter((n) => n.marked !== null).length);
      totalMarkings += m.markings;
      if (m.thefts + m.markings !== g.nights.length - 1) sawSubtractionDisagree = true;
    }
    expect(totalMarkings).toBeGreaterThan(0);
    expect(sawSubtractionDisagree).toBe(true);
  });

  // Spec §6.2 #6 asks for the pool that can physically join a Call: a stock.
  // Counting `itemTaken` events answers a different question (how many people
  // picked something up tonight) and, because an item stays in the hand that
  // took it, a much smaller one.
  it('reports the Call-eligible pool as a stock, not a night\'s pickups', () => {
    let poolTotal = 0, pickupTotal = 0, nights = 0;
    for (let seed = 0; seed < 40; seed++) {
      const g = play(seed);
      const expected = g.nights.reduce((n, x) => n + x.callPool.length, 0) / g.nights.length;
      expect(measure(g).meanCallPool).toBeCloseTo(expected, 9);

      for (const night of g.nights) {
        nights++;
        poolTotal += night.callPool.length;
        pickupTotal += new Set(night.events
          .filter((e) => e.t === 'itemTaken')
          .map((e) => (e as { player: string }).player)).size;
      }
    }
    // The stock is strictly the larger measure, and it clears the two hands a
    // Call needs on average — which the pickup flow does not.
    expect(poolTotal / nights).toBeGreaterThan(pickupTotal / nights);
    expect(poolTotal / nights).toBeGreaterThan(makeConfig().callHandsRequired);
  });

  // Spec §6.2 #7, never implemented until now: a live Call the target simply
  // walked away from.
  it('counts a dodge as a live Call the named child did not attend', () => {
    let total = 0;
    for (let seed = 0; seed < 60; seed++) {
      const g = play(seed);
      const expected = g.nights.reduce((n, x) => n + x.events
        .filter((e) => e.t === 'callResolved' && e.outcome === 'noShow').length, 0);
      expect(measure(g).dodges).toBe(expected);
      total += expected;
    }
    expect(total).toBeGreaterThan(0);
  });
});
