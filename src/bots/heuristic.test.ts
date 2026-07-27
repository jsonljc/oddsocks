import { describe, it, expect } from 'vitest';
import { makeRng } from '../rules/rng.js';
import { makeConfig, ROSTER } from '../rules/config.js';
import { createGame } from '../rules/state.js';
import { isLegalPath } from '../rules/map.js';
import { playGame } from '../rules/game.js';
import { heuristicBot, suspicionFrom } from './heuristic.js';
import type { Knowledge } from './types.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));
const knowledge = (over: Partial<Knowledge> = {}): Knowledge => {
  const s = createGame(makeConfig(), makeRng(1));
  return {
    me: 'bell', isVillain: false, night: 3, position: 'bed_bell', held: [],
    lit: { ...s.lit }, lanternRooms: [...s.lanternRooms],
    publicEvents: [], mySightings: [], claims: [],
    activeCall: null, config: s.config, ...over,
  };
};

describe('legality', () => {
  it('only ever submits legal paths, villain or not', () => {
    for (const isVillain of [false, true]) {
      for (let i = 0; i < 100; i++) {
        const k = knowledge({ isVillain, me: isVillain ? 'moss' : 'bell',
          position: isVillain ? 'bed_moss' : 'bed_bell' });
        const rng = makeRng(i);
        expect(isLegalPath(k.config.house, k.position, heuristicBot.dusk(k, rng).path)).toBe(true);
        expect(isLegalPath(k.config.house, k.position, heuristicBot.midnight(k, rng).path)).toBe(true);
      }
    }
  });

  // The test above always sets activeCall: null, so it never drives the
  // self-nomination or join-call branches through isLegalPath. Both are
  // reachable from kitchen to bed_bell in one phase (see the villain tests'
  // map comment below).
  it('submits legal paths when honouring or joining an active self-nominated Call', () => {
    const call = { caller: 'bell', target: 'bell', room: 'bed_bell', selfNominated: true };
    for (let i = 0; i < 100; i++) {
      const rng = makeRng(i);

      const target = knowledge({
        me: 'bell', position: 'kitchen', held: ['lantern'], activeCall: call,
      });
      expect(isLegalPath(target.config.house, target.position,
        heuristicBot.midnight(target, rng).path)).toBe(true);

      const joiner = knowledge({
        me: 'pike', position: 'kitchen', held: ['lantern'], activeCall: call,
      });
      expect(isLegalPath(joiner.config.house, joiner.position,
        heuristicBot.midnight(joiner, rng).path)).toBe(true);
    }
  });
});

describe('suspicion', () => {
  it('rises for a child the trail has named', () => {
    const k = knowledge({ publicEvents: [
      { t: 'trail', player: 'pike', room: 'bed_bell' },
      { t: 'trail', player: 'pike', room: 'bed_clem' },
      { t: 'trail', player: 'clem', room: 'bed_bell' },
    ] });
    const s = suspicionFrom(k);
    expect(s['pike']!).toBeGreaterThan(s['clem']!);
    expect(s['pike']!).toBeGreaterThan(s['wren'] ?? 0);
  });

  it('never suspects yourself', () => {
    const k = knowledge({ me: 'pike', publicEvents: [{ t: 'trail', player: 'pike', room: 'bed_bell' }] });
    expect(suspicionFrom(k)['pike']).toBe(0);
  });
});

describe('the villain', () => {
  // From the kitchen the reachable bedrooms are bed_bell and bed_pike (via
  // west_hall) and bed_clem (via east_hall). Adjacent dead ends are not reachable.
  it('dodges a Call aimed at itself', () => {
    const k = knowledge({
      isVillain: true, me: 'moss', position: 'kitchen',
      activeCall: { caller: 'bell', target: 'moss', room: 'bed_bell', selfNominated: false },
    });
    for (let i = 0; i < 50; i++) {
      expect(heuristicBot.midnight(k, makeRng(i)).path[1]).not.toBe('bed_bell');
    }
  });

  it('walks into someone else\'s lit bedroom when it can reach one', () => {
    const k = knowledge({ isVillain: true, me: 'moss', position: 'kitchen' });
    for (let i = 0; i < 20; i++) {
      expect(['bed_bell', 'bed_pike', 'bed_clem'])
        .toContain(heuristicBot.midnight(k, makeRng(i)).path[1]);
    }
  });
});

describe('the villain\'s self-snuff policy', () => {
  it('never self-snuffs when it would cost a night', () => {
    for (let seed = 0; seed < 300; seed++) {
      const record = playGame(makeConfig(), seed, bots);
      for (const night of record.nights) {
        for (const e of night.events) {
          if (e.t === 'theft') expect(e.victim).not.toBe(record.villain);
        }
      }
    }
  });

  it('self-snuffs at most once per game when it is free', () => {
    let total = 0;
    for (let seed = 0; seed < 300; seed++) {
      const record = playGame(makeConfig({ selfSnuffCostsNight: false }), seed, bots);
      let count = 0;
      for (const night of record.nights) {
        for (const e of night.events) {
          if (e.t === 'theft' && e.victim === record.villain) count++;
        }
      }
      expect(count).toBeLessThanOrEqual(1);
      total += count;
    }
    // Proves the mechanic actually fires somewhere in the sweep, not just
    // that it never over-fires — an accidentally-disabled policy would also
    // pass the per-game bound above.
    expect(total).toBeGreaterThan(0);
  });
});

describe('the villain claim', () => {
  it('is pinned to the truth when a witness named me last night', () => {
    const k = knowledge({
      isVillain: true, me: 'moss', night: 5, position: 'attic',
      publicEvents: [
        { t: 'reported', player: 'pike', room: 'bed_wren', named: ['moss'], others: 1, lit: true, night: 4 },
      ],
    });
    for (let i = 0; i < 10; i++) {
      expect(heuristicBot.morning(k, makeRng(i)).claim).toBe('attic');
    }
  });

  it('is not stuck on the truth once a naming is more than one night stale', () => {
    // Same naming as above, but from night 2 — three nights before this
    // night-5 decision, not the one night just resolved. Under the original
    // bug (any historical naming, forever) this would still force the truth
    // every time; under the "latest per witness" bug this fix's own review
    // caught (a Hushed witness's stale naming stays "freshest" forever), it
    // would too. Neither applies once scoping is exact-night.
    const k = knowledge({
      isVillain: true, me: 'moss', night: 5, position: 'attic',
      publicEvents: [
        { t: 'reported', player: 'pike', room: 'bed_wren', named: ['moss'], others: 1, lit: true, night: 2 },
      ],
    });
    const claims = new Set<string | null>();
    for (let i = 0; i < 30; i++) {
      claims.add(heuristicBot.morning(k, makeRng(i)).claim);
    }
    // A still-forced claim would deterministically return the true position
    // on every seed, with zero variation.
    expect(claims.size).toBeGreaterThan(1);
  });
});

describe('whole games', () => {
  it('produces Calls that go live and sometimes clear an innocent child', () => {
    // outcome !== 'fizzled' alone is a weak guard: 'noShow' satisfies it just
    // as well as 'cleared' does, and did, before self-nomination existed —
    // this passed on the un-fixed bot because the villain's own dodge always
    // produced noShow. Assert 'cleared' specifically.
    let live = 0;
    let cleared = 0;
    for (let seed = 0; seed < 120; seed++) {
      for (const night of playGame(makeConfig(), seed, bots).nights) {
        for (const e of night.events) {
          if (e.t !== 'callResolved') continue;
          if (e.outcome !== 'fizzled') live++;
          if (e.outcome === 'cleared') cleared++;
        }
      }
    }
    expect(live).toBeGreaterThan(0);
    expect(cleared).toBeGreaterThan(0);
  });

  it('terminates for every seed', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(playGame(makeConfig(), seed, bots).outcome.winner).toBeTruthy();
    }
  });
});
