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
    lit: { ...s.lit }, publicEvents: [], mySightings: [], claims: [],
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

describe('whole games', () => {
  it('produces Calls that actually go live at least sometimes', () => {
    let live = 0;
    for (let seed = 0; seed < 120; seed++) {
      for (const night of playGame(makeConfig(), seed, bots).nights) {
        for (const e of night.events) {
          if (e.t === 'callResolved' && e.outcome !== 'fizzled') live++;
        }
      }
    }
    expect(live).toBeGreaterThan(0);
  });

  it('terminates for every seed', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(playGame(makeConfig(), seed, bots).outcome.winner).toBeTruthy();
    }
  });
});
