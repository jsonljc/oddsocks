import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, type GameState } from './state.js';
import { resolveTheft, selectTrailWitness } from './theft.js';

const game = (villain: string, overrides = {}): GameState => {
  const s = createGame(makeConfig(overrides), makeRng(1));
  s.villain = villain;
  s.night = 2;
  return s;
};

describe('resolveTheft', () => {
  it('puts out the light when the villain ends midnight in a lit bedroom', () => {
    const s = game('moss');
    const out = resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(out.stole).toBe(true);
    expect(out.victim).toBe('bell');
    expect(s.lit['bed_bell']).toBe(false);
    expect(out.events.some((e) => e.t === 'theft')).toBe(true);
  });

  it('hushes the victim from the night their light died', () => {
    const s = game('moss');
    resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(s.hushedSince['bell']).toBe(2);
  });

  it('does nothing in a common room', () => {
    const s = game('moss');
    const out = resolveTheft(s, { moss: 'kitchen' }, false, makeRng(1));
    expect(out.stole).toBe(false);
    expect(out.events).toEqual([]);
  });

  it('does nothing in a bedroom that is already dark', () => {
    const s = game('moss');
    s.lit['bed_bell'] = false;
    const out = resolveTheft(s, { moss: 'bed_bell' }, false, makeRng(1));
    expect(out.stole).toBe(false);
  });

  it('snuffs the villain\'s own light only when they choose to, and hushes them', () => {
    const s = game('moss');
    const skipped = resolveTheft(s, { moss: 'bed_moss' }, false, makeRng(1));
    expect(s.lit['bed_moss']).toBe(true);
    expect(skipped.events).toEqual([]);
    expect(skipped.selfSnuff).toBe(false);

    const done = resolveTheft(s, { moss: 'bed_moss' }, true, makeRng(1));
    expect(s.lit['bed_moss']).toBe(false);
    expect(s.hushedSince['moss']).toBe(2);
    expect(done.selfSnuff).toBe(true);
    const theftEvent = done.events.find((e) => e.t === 'theft');
    expect(theftEvent).toBeDefined();
    expect((theftEvent as { victim: string }).victim).toBe('moss');
    expect(done.events.some((e) => e.t === 'trail')).toBe(true);
  });

  it('emits a trail naming someone within the trail radius', () => {
    const s = game('moss');
    const out = resolveTheft(s,
      { moss: 'bed_bell', bell: 'west_hall', pike: 'attic' }, false, makeRng(3));
    const trail = out.events.find((e) => e.t === 'trail');
    expect(trail).toBeDefined();
    expect(['moss', 'bell']).toContain((trail as { player: string }).player);
  });
});

describe('a self-snuff is publicly indistinguishable from a theft', () => {
  it('reports stole:true and selfSnuff:true for a self-snuff, vs. stole:true and selfSnuff:false for a theft', () => {
    const s = game('moss');
    const selfSnuff = resolveTheft(s, { moss: 'bed_moss' }, true, makeRng(1));
    expect(selfSnuff.stole).toBe(true);
    expect(selfSnuff.selfSnuff).toBe(true);

    const s2 = game('moss');
    const theft = resolveTheft(s2, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(theft.stole).toBe(true);
    expect(theft.selfSnuff).toBe(false);
  });

  it('emits no event type that a theft-with-absent-victim night could not also emit', () => {
    // The strongest form of the guarantee: the set of public event types from a
    // self-snuff is a subset of the set from an ordinary theft where the victim
    // was out (so neither branch produces a Grip either).
    const s = game('moss');
    const selfSnuff = resolveTheft(s, { moss: 'bed_moss' }, true, makeRng(1));

    const s2 = game('moss');
    const theft = resolveTheft(s2, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));

    const selfSnuffTypes = new Set(selfSnuff.events.map((e) => e.t));
    const theftTypes = new Set(theft.events.map((e) => e.t));
    for (const t of selfSnuffTypes) expect(theftTypes.has(t)).toBe(true);
  });
});

describe('the Grip', () => {
  it('takes the thief\'s item when the owner was home', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    const out = resolveTheft(s, { moss: 'bed_bell', bell: 'bed_bell' }, false, makeRng(1));
    expect(s.held['bell']).toEqual(['keyhole']);
    expect(s.held['moss']).toEqual([]);
    expect(out.events.some((e) => e.t === 'grip')).toBe(true);
  });

  it('hands the owner an item from the reserve when the thief carried nothing', () => {
    const s = game('moss');
    s.held['moss'] = [];
    const before = s.reserve.length;
    resolveTheft(s, { moss: 'bed_bell', bell: 'bed_bell' }, false, makeRng(1));
    expect(s.held['bell']).toHaveLength(1);
    expect(s.reserve).toHaveLength(before - 1);
  });

  it('does not fire when the owner was elsewhere', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(s.held['bell']).toEqual([]);
    expect(s.held['moss']).toEqual(['keyhole']);
  });

  it('does not fire for a non-owner standing in the robbed room', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen', pike: 'bed_bell' }, false, makeRng(1));
    expect(s.held['pike']).toEqual([]);
  });

  it('never fires on a self-snuff, even though the villain is home in their own room holding an item', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    const out = resolveTheft(s, { moss: 'bed_moss' }, true, makeRng(1));
    expect(out.events.some((e) => e.t === 'grip')).toBe(false);
    expect(s.held['moss']).toEqual(['keyhole']);
  });
});

describe('selectTrailWitness', () => {
  it('only ever names someone inside the radius', () => {
    const s = game('moss');
    const midnight = { moss: 'bed_bell', bell: 'west_hall', pike: 'attic', clem: 'bed_clem' };
    for (let i = 0; i < 50; i++) {
      const named = selectTrailWitness(s, 'bed_bell', midnight, makeRng(i));
      expect(['moss', 'bell']).toContain(named);
    }
  });

  it('names the thief when nobody else is near', () => {
    const s = game('moss');
    const midnight: Record<string, string> = { moss: 'bed_bell' };
    for (const p of ROSTER) if (p !== 'moss') midnight[p] = 'attic';
    expect(selectTrailWitness(s, 'bed_bell', midnight, makeRng(1))).toBe('moss');
  });
});
