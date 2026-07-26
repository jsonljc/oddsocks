import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, isLit, darkBedroomCount, capacityOf, canClaim } from './state.js';

const fresh = (seed = 1) => createGame(makeConfig(), makeRng(seed));

describe('createGame', () => {
  it('starts every child asleep in their own lit bedroom', () => {
    const s = fresh();
    for (const p of ROSTER) {
      expect(s.positions[p]).toBe(`bed_${p}`);
      expect(isLit(s, `bed_${p}`)).toBe(true);
    }
  });

  it('names exactly one villain from the roster', () => {
    const s = fresh();
    expect(ROSTER).toContain(s.villain);
  });

  it('is deterministic for a given seed', () => {
    expect(createGame(makeConfig(), makeRng(99)).villain)
      .toBe(createGame(makeConfig(), makeRng(99)).villain);
  });

  it('picks different villains across seeds', () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => createGame(makeConfig(), makeRng(i)).villain),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('opens on night 1 with a full item reserve and nothing loose', () => {
    const s = fresh();
    expect(s.night).toBe(1);
    expect(s.reserve).toHaveLength(5);
    expect(Object.values(s.loose).flat()).toHaveLength(0);
    expect(s.over).toBeNull();
  });

  it('starts nobody hushed, marked, or eyes-open', () => {
    const s = fresh();
    for (const p of ROSTER) {
      expect(s.hushedSince[p]).toBeNull();
      expect(s.marked[p]).toBe(false);
      expect(s.eyesOpen[p]).toBe(false);
      expect(s.held[p]).toEqual([]);
    }
  });
});

describe('state queries', () => {
  it('never counts the villain\'s own dark bedroom toward their win', () => {
    const s = fresh();
    s.lit[`bed_${s.villain}`] = false;
    expect(darkBedroomCount(s)).toBe(0);
    const other = ROSTER.find((p) => p !== s.villain)!;
    s.lit[`bed_${other}`] = false;
    expect(darkBedroomCount(s)).toBe(1);
  });

  it('treats common rooms as permanently lit', () => {
    const s = fresh();
    s.lit['kitchen'] = false;
    expect(isLit(s, 'kitchen')).toBe(true);
  });

  it('gives Moss a carry capacity of two', () => {
    const s = fresh();
    expect(capacityOf(s, 'moss')).toBe(2);
    expect(capacityOf(s, 'bell')).toBe(1);
  });

  it('silences a hushed child permanently under hushMode silent', () => {
    const s = fresh();
    s.hushedSince['bell'] = 3;
    s.night = 5;
    expect(canClaim(s, 'bell')).toBe(false);
    expect(canClaim(s, 'pike')).toBe(true);
  });

  it('silences a hushed child for one night only under hushMode oneNight', () => {
    const s = createGame(makeConfig({ hushMode: 'oneNight' }), makeRng(1));
    s.hushedSince['bell'] = 3;
    s.night = 3;
    expect(canClaim(s, 'bell')).toBe(false);
    s.night = 4;
    expect(canClaim(s, 'bell')).toBe(true);
  });
});
