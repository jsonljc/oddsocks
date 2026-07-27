import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from './config.js';
import { playGame } from './game.js';
import { randomBot } from '../bots/random.js';
import { heuristicBot } from '../bots/heuristic.js';
import type { NightRecord, PublicEvent } from './state.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number, over = {}) => playGame(makeConfig(over), seed, bots);

// randomBot always claims its true position, so only the heuristic villain
// actually lies — and a lie is the only thing that separates R19's report from
// the sighting it replaces.
const liars = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));
const playLying = (seed: number) => playGame(makeConfig(), seed, liars);

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

  // R15 binds innocents, not the villain — see R19 and the block below.
  it('an innocent\'s report matches their true sighting', () => {
    const g = play(4);
    for (const night of g.nights) {
      for (const e of night.events) {
        if (e.t !== 'reported' || e.player === g.villain) continue;
        expect(e.room).toBe(night.sightings[e.player]!.room);
        expect(e.named).toEqual(night.sightings[e.player]!.named);
        expect(e.others).toBe(night.sightings[e.player]!.others);
        expect(e.lit).toBe(night.sightings[e.player]!.lit);
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

  it('leaves every player in reporters every night when the Hush is switched off', () => {
    for (let seed = 0; seed < 20; seed++) {
      const g = play(seed, { hushMode: 'none' });
      for (const night of g.nights) {
        expect(night.reporters).toEqual([...ROSTER]);
      }
    }
  });
});

describe('the villain\'s report (R19)', () => {
  type Reported = Extract<PublicEvent, { t: 'reported' }>;
  const villainReport = (night: NightRecord, villain: string): Reported | undefined =>
    night.events.find((e): e is Reported => e.t === 'reported' && e.player === villain);

  it('carries the room they claimed, never the room they were in, and no names', () => {
    let lied = 0;
    let wouldHaveNamedInTheDark = 0;
    let wouldHaveNamedTheRobbedRoom = 0;

    for (let seed = 0; seed < 200; seed++) {
      const g = playLying(seed);
      for (const night of g.nights) {
        const report = villainReport(night, g.villain);
        if (!report) continue;

        expect(report.room).toBe(night.claims[g.villain]);
        expect(report.named).toEqual([]);
        expect(report.others).toBe(0);

        // How much this actually withholds, measured on the same games: the
        // sighting the old code published in its place.
        const truth = night.sightings[g.villain]!;
        if (report.room !== truth.room) lied++;
        if (!truth.lit && truth.named.length > 0) wouldHaveNamedInTheDark++;
        const robbery = night.events.find((e) => e.t === 'theft');
        if (robbery && robbery.t === 'theft' && truth.room === robbery.room &&
            report.room !== robbery.room) wouldHaveNamedTheRobbedRoom++;
      }
    }

    // None of the three assertions above discriminates anything unless the
    // villain's story and their whereabouts actually come apart in this sample.
    expect(lied).toBeGreaterThan(0);
    expect(wouldHaveNamedInTheDark).toBeGreaterThan(0);
    expect(wouldHaveNamedTheRobbedRoom).toBeGreaterThan(0);
  });

  it('speaks every morning the Hush allows, so silence is never the tell', () => {
    // Dropping the villain from the report loop would fix the leak and open a
    // far worse one: on night 1 nobody is Hushed, so the single child with no
    // report would be the villain outright.
    for (let seed = 0; seed < 60; seed++) {
      const g = playLying(seed);
      for (const night of g.nights) {
        const spoke = villainReport(night, g.villain) !== undefined;
        expect(spoke).toBe(night.claims[g.villain] !== null);
      }
    }
  });
});

describe('the solver reads only reportable testimony', () => {
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
