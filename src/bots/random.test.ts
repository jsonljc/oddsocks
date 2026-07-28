import { describe, it, expect } from 'vitest';
import { makeRng } from '../rules/rng.js';
import { makeConfig } from '../rules/config.js';
import { createGame } from '../rules/state.js';
import { isLegalPath } from '../rules/map.js';
import { randomBot } from './random.js';
import type { Knowledge } from './types.js';

const knowledge = (over: Partial<Knowledge> = {}): Knowledge => {
  const s = createGame(makeConfig(), makeRng(1));
  return {
    me: 'bell', isVillain: false, night: 2, position: 'bed_bell', held: [],
    lit: { ...s.lit }, lanternRooms: [...s.lanternRooms],
    publicEvents: [], mySightings: [], claims: [],
    activeCall: null, config: s.config, ...over,
  };
};

describe('randomBot', () => {
  it('only ever submits legal paths', () => {
    const k = knowledge();
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(i);
      expect(isLegalPath(k.config.house, k.position, randomBot.dusk(k, rng).path)).toBe(true);
      expect(isLegalPath(k.config.house, k.position, randomBot.midnight(k, rng).path)).toBe(true);
    }
  });

  it('claims its true position and posts no Calls', () => {
    const m = randomBot.morning(knowledge({ position: 'attic' }), makeRng(1));
    expect(m.claim).toBe('attic');
    expect(m.call).toBeNull();
    expect(m.itemUses).toEqual([]);
  });

  it('never offers to join when it holds nothing', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomBot.midnight(knowledge({ held: [] }), makeRng(i)).joinCall).toBe(false);
    }
  });

  it('never snuffs its own light', () => {
    const k = knowledge({ isVillain: true, me: 'moss', position: 'bed_moss' });
    for (let i = 0; i < 50; i++) {
      expect(randomBot.midnight(k, makeRng(i)).snuffOwn).toBe(false);
    }
  });
});
