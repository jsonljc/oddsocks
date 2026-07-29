import { makeRng } from '../src/core/rng';

describe('makeRng', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = makeRng(1234), b = makeRng(1234);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = makeRng(1234), b = makeRng(1235);
    expect(Array.from({ length: 50 }, () => a()))
      .not.toEqual(Array.from({ length: 50 }, () => b()));
  });

  it('stays in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() stays in range and pick() is stable per seed', () => {
    expect(makeRng(9).int(5)).toBe(makeRng(9).int(5));
    const xs = ['a', 'b', 'c'] as const;
    expect(makeRng(3).pick(xs)).toBe(makeRng(3).pick(xs));
    for (let i = 0; i < 200; i++) {
      const v = makeRng(i).int(4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });
});
