import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from './config.js';
import { playGame } from './game.js';
import type { Path } from './types.js';
import type { Bot } from '../bots/types.js';
import { randomBot } from '../bots/random.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number, over = {}) => playGame(makeConfig(over), seed, bots);

// randomBot always submits `snuffOwn: false` — it can never trigger a genuine
// self-snuff, which makes the `overrun` filter in the test below always empty
// and its assertions vacuous. This bot stays home every phase and deliberately
// snuffs its own light the moment it's the villain and it's legal to (night 2
// onward — night 1 is safe), so the free-self-snuff overrun actually fires.
const stayHomeAndSelfSnuff: Bot = {
  dusk(k) {
    const home = k.position;
    const door = k.config.house.rooms[home]!.doors[0]!;
    return { path: [door, home] as Path, pickUp: false };
  },
  midnight(k) {
    const home = k.position;
    const door = k.config.house.rooms[home]!.doors[0]!;
    return { path: [door, home] as Path, joinCall: false, snuffOwn: k.isVillain };
  },
  morning(k) {
    return { claim: k.position, call: null, itemUses: [] };
  },
};
const stayBots = Object.fromEntries(ROSTER.map((p) => [p, stayHomeAndSelfSnuff]));

describe('playGame', () => {
  it('always terminates with a winner', () => {
    for (let seed = 0; seed < 300; seed++) {
      const g = play(seed);
      expect(['children', 'oddsocks']).toContain(g.outcome.winner);
      expect(['caught', 'survived', 'lightsOut']).toContain(g.outcome.how);
    }
  });

  it('never runs past the configured night count', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(play(seed).nights.length).toBeLessThanOrEqual(makeConfig().totalNights);
    }
  });

  it('records one entry per night played, with claims and sightings', () => {
    const g = play(1);
    g.nights.forEach((n, i) => {
      expect(n.night).toBe(i + 1);
      expect(Object.keys(n.midnightPositions).sort()).toEqual([...ROSTER].sort());
      expect(Object.keys(n.sightings).sort()).toEqual([...ROSTER].sort());
      expect(Object.keys(n.claims).sort()).toEqual([...ROSTER].sort());
    });
  });

  it('is byte-identical for the same seed', () => {
    expect(JSON.stringify(play(77).nights)).toBe(JSON.stringify(play(77).nights));
  });

  it('produces different games across seeds', () => {
    const shapes = new Set(Array.from({ length: 40 }, (_, i) =>
      `${play(i).villain}:${play(i).nights.length}:${play(i).outcome.how}`));
    expect(shapes.size).toBeGreaterThan(3);
  });

  it('gives the children the survival win when the deadline passes', () => {
    const survivals = Array.from({ length: 200 }, (_, i) => play(i))
      .filter((g) => g.outcome.how === 'survived');
    for (const g of survivals) {
      expect(g.nights.length).toBe(makeConfig().totalNights);
      expect(g.outcome.winner).toBe('children');
    }
  });

  it('extends the deadline by one night when a free self-snuff happens', () => {
    // With selfSnuffCostsNight false, a villain who snuffs their own light does
    // not spend a night on it, so the game may run one night past totalNights.
    const c = makeConfig({ selfSnuffCostsNight: false });
    const overrun = Array.from({ length: 200 }, (_, i) => playGame(c, i, bots))
      .filter((g) => g.nights.length > c.totalNights);
    for (const g of overrun) {
      expect(g.nights.length).toBe(c.totalNights + 1);
      // A self-snuff is publicly identical to a theft (R16): it never gets its own
      // event type, only a 'theft' event whose victim is the villain themself.
      expect(g.nights.some((n) =>
        n.events.some((e) => e.t === 'theft' && e.victim === g.villain))).toBe(true);
    }
  });

  it('actually overruns on a deliberate self-snuff, so the test above is not vacuous', () => {
    // With randomBot the `overrun` array above is always empty (see the note on
    // stayHomeAndSelfSnuff), so that test's per-game assertions never execute.
    // This drives the exact scenario directly: every player stays in their own
    // lit bedroom forever, so no other light is ever at risk, and the villain
    // self-snuffs the first legal chance (night 2). The game must then run
    // exactly one night past the deadline and still end in survival.
    const c = makeConfig({ selfSnuffCostsNight: false });
    for (let seed = 0; seed < 20; seed++) {
      const g = playGame(c, seed, stayBots);
      expect(g.nights.length).toBe(c.totalNights + 1);
      expect(g.outcome).toEqual({ winner: 'children', how: 'survived' });
      expect(g.nights[1]!.events.some((e) => e.t === 'theft' && e.victim === g.villain)).toBe(true);
    }
  });

  it('never extends the deadline when a self-snuff costs a night', () => {
    const c = makeConfig();
    expect(c.selfSnuffCostsNight).toBe(true);
    for (let seed = 0; seed < 200; seed++) {
      expect(playGame(c, seed, bots).nights.length).toBeLessThanOrEqual(c.totalNights);
    }
  });

  it('hands each bot a frozen snapshot: mySightings and claims never grow after handoff', () => {
    // knowledgeFor must return a point-in-time view. If mySightings/claims were
    // handed over by reference instead of copied, a bot that kept an old
    // Knowledge object would see later nights' data appear in it retroactively —
    // "sees the future" via aliasing rather than via timing.
    const captured: { sightings: unknown[]; sightingsLenAtCapture: number;
      claims: unknown[]; claimsLenAtCapture: number }[] = [];
    const spy: Bot = {
      dusk(k, rng) {
        captured.push({ sightings: k.mySightings, sightingsLenAtCapture: k.mySightings.length,
          claims: k.claims, claimsLenAtCapture: k.claims.length });
        return randomBot.dusk(k, rng);
      },
      midnight(k, rng) {
        captured.push({ sightings: k.mySightings, sightingsLenAtCapture: k.mySightings.length,
          claims: k.claims, claimsLenAtCapture: k.claims.length });
        return randomBot.midnight(k, rng);
      },
      morning(k, rng) {
        captured.push({ sightings: k.mySightings, sightingsLenAtCapture: k.mySightings.length,
          claims: k.claims, claimsLenAtCapture: k.claims.length });
        return randomBot.morning(k, rng);
      },
    };
    const spyBots = Object.fromEntries(ROSTER.map((p) => [p, spy]));
    playGame(makeConfig(), 5, spyBots);

    expect(captured.length).toBeGreaterThan(0);
    for (const c of captured) {
      expect(c.sightings.length).toBe(c.sightingsLenAtCapture);
      expect(c.claims.length).toBe(c.claimsLenAtCapture);
    }
  });

  it('never leaves a hushed child making a claim under hushMode silent', () => {
    for (let seed = 0; seed < 50; seed++) {
      const g = play(seed);
      const hushed = new Set<string>();
      for (const night of g.nights) {
        for (const p of ROSTER) {
          if (hushed.has(p)) expect(night.claims[p]).toBeNull();
        }
        // A self-snuff records as a 'theft' event with the villain as victim
        // (R16) — no separate event type exists, so this branch already covers it.
        for (const e of night.events) {
          if (e.t === 'theft') hushed.add(e.victim);
        }
      }
    }
  });
});
