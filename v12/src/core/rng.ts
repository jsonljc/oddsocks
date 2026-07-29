export interface Rng {
  (): number;
  int(maxExclusive: number): number;
  pick<T>(xs: readonly T[]): T;
}

/** mulberry32. Chosen because it is 4 lines, has no state we must serialise
 *  beyond one uint32, and is reproducible across engines — all three matter
 *  when slice 2b's server has to replay a client's stream. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  rng.pick = <T,>(xs: readonly T[]): T => {
    const v = xs[rng.int(xs.length)];
    if (v === undefined) throw new Error('pick() on an empty array');
    return v;
  };
  return rng;
}
