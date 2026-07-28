import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, () => makeRng(1).next());
    const b = Array.from({ length: 20 }, () => makeRng(2).next());
    expect(a).not.toEqual(b);
  });

  it('next() stays within [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) stays within [0, n)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('shuffle is a permutation and does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = [...input];
    const out = makeRng(3).shuffle(input);
    expect(input).toEqual(frozen);
    expect([...out].sort((x, y) => x - y)).toEqual(frozen);
  });

  it('pick returns a member of the array', () => {
    const xs = ['a', 'b', 'c'];
    const r = makeRng(9);
    for (let i = 0; i < 50; i++) expect(xs).toContain(r.pick(xs));
  });
});
