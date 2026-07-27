import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from './config.js';
import { playGame } from './game.js';
import { randomBot } from '../bots/random.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number, over = {}) => playGame(makeConfig(over), seed, bots);

describe('sighting reports', () => {
  it('lists every unhushed child as a reporter', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = play(seed);
      for (const night of g.nights) {
        for (const p of ROSTER) {
          const claimed = night.claims[p] !== null;
          expect(night.reporters.includes(p)).toBe(claimed);
        }
      }
    }
  });

  it('emits one report event per reporter', () => {
    const g = play(4);
    for (const night of g.nights) {
      const reports = night.events.filter((e) => e.t === 'reported');
      expect(reports).toHaveLength(night.reporters.length);
    }
  });

  it('reports match the reporter\'s true sighting', () => {
    const g = play(4);
    for (const night of g.nights) {
      for (const e of night.events) {
        if (e.t !== 'reported') continue;
        expect(e.room).toBe(night.sightings[e.player]!.room);
        expect(e.named).toEqual(night.sightings[e.player]!.named);
      }
    }
  });

  it('lets a hushed child neither claim nor report', () => {
    const g = play(9);
    const hushed = new Set<string>();
    for (const night of g.nights) {
      for (const p of hushed) {
        expect(night.claims[p]).toBeNull();
        expect(night.reporters).not.toContain(p);
      }
      for (const e of night.events) {
        // A self-snuff is publicly indistinguishable from a theft (R16): it is
        // the same 'theft' event, with the villain as their own victim — there
        // is no separate 'selfSnuff' PublicEvent, so this one arm covers both.
        if (e.t === 'theft') hushed.add(e.victim);
      }
    }
  });
});

describe('the solver reads only reportable testimony', () => {
  it('still never refutes the truth once hushed witnesses are excluded', async () => {
    const { solve } = await import('../analysis/safeLies.js');
    for (let seed = 0; seed < 100; seed++) {
      expect(solve(play(seed)).forcedNight).toBeNull();
    }
  });

  it('gives the villain more room once witnesses go silent', async () => {
    const { solve } = await import('../analysis/safeLies.js');
    let widened = 0;
    for (let seed = 0; seed < 60; seed++) {
      const space = solve(play(seed)).hidingSpace;
      if (space.length > 2 && space[space.length - 1]! >= space[1]!) widened++;
    }
    expect(widened).toBeGreaterThan(0);
  });
});
