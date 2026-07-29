import { describe, expect, it } from 'vitest';
import { runCell } from '../analysis/sweep.js';

/**
 * These are not bot tests. They are the design's own assertions, written as
 * code so a rules change that quietly reverts the spine fails the suite rather
 * than passing unnoticed.
 *
 * The previous design was killed by exactly two facts nobody had measured: a
 * table that never split could not be touched, and the children's win was gated
 * on the villain choosing to act. Both have a test here.
 */
describe('the assertions the spine lives on', () => {
  const GAMES = 200;

  describe('the huddle must lose', () => {
    // Three or more in a room is unconditionally take-proof, so a table that
    // moves as one block can never be caught. Under the predecessor that was a
    // permanent stalemate. Here it must be a loss: six bodies under one candle
    // burn it down, and the children are five of the six.
    for (const villain of ['light', 'hunter', 'random'] as const) {
      it(`loses to ${villain}`, () => {
        const r = runCell({ child: 'huddle', villain }, GAMES);
        expect(r.childrenWin).toBe(0);
        expect(r.meanTakes).toBe(0);       // and is never taken, as predicted
        expect(r.darkOut).toBe(1);         // it loses specifically to the dark
      });
    }
  });

  describe('searching must beat sheltering', () => {
    for (const villain of ['light', 'hunter', 'random'] as const) {
      it(`against ${villain}`, () => {
        const shelter = runCell({ child: 'huddle', villain }, GAMES);
        const search = runCell({ child: 'searcher', villain }, GAMES);
        expect(search.childrenWin).toBeGreaterThan(shelter.childrenWin);
        expect(search.childrenWin).toBeGreaterThan(0.15);
      });
    }
  });

  describe('the Corner must actually fire', () => {
    // The predecessor's equivalent condition fired zero times in every
    // configuration ever tested, which left the children one real route rather
    // than the two the rules advertised. This is the regression test for it.
    for (const villain of ['light', 'hunter', 'random'] as const) {
      it(`against ${villain}`, () => {
        const r = runCell({ child: 'searcher', villain }, GAMES);
        expect(r.cornered).toBeGreaterThan(0.05);
        expect(r.namings).toBeGreaterThan(0);
      });
    }
  });

  describe('naming must beat chance', () => {
    // Five candidates, so blind guessing is ~20%. Anything at or below that
    // means the evidence channel is not transmitting — which is precisely what
    // happened when suspicion was read from absence alone: a villain who never
    // left the lit landings scored 0.0%, worse than guessing.
    for (const villain of ['light', 'hunter', 'random'] as const) {
      it(`against ${villain}`, () => {
        const r = runCell({ child: 'searcher', villain }, GAMES);
        expect(r.namingAccuracy).toBeGreaterThan(0.25);
      });
    }
  });

  describe('no villain line is a free win', () => {
    // The design's stated load-bearing assumption was that a villain who simply
    // stays in the light cannot dominate. As first specified they won 100% of
    // games while shedding nothing at all.
    for (const villain of ['light', 'hunter', 'random'] as const) {
      it(`${villain} does not win by default`, () => {
        const r = runCell({ child: 'searcher', villain }, GAMES);
        expect(r.childrenWin).toBeGreaterThan(0.15);
        expect(r.childrenWin).toBeLessThan(0.85);
      });
    }
  });

  it('keeps both of the villain routes live', () => {
    const r = runCell({ child: 'searcher', villain: 'hunter' }, GAMES);
    expect(r.takenOut).toBeGreaterThan(0.02);
    expect(r.darkOut).toBeGreaterThan(0.02);
  });
});

/**
 * The metronome is load-bearing, and this is the test that says so.
 *
 * Spokes are dead ends, so anyone who steps into one is forced back out the
 * next night. Measured, that phase-locks the whole cast: 600 takes on odd
 * nights against 27 on even ones. It reads like a defect — half the nights
 * cannot produce a take and everybody knows which half — and the obvious repair
 * is to join the spokes along each floor so nobody is ever forced anywhere.
 *
 * That repair destroys the game. Joined spokes let Odd Socks stay in the dark
 * for the whole game, so they never appear on a lit roster and never shed
 * beside one. The evidence channel is the forced return.
 */
describe('the dead ends are the evidence channel', () => {
  it('joining the spokes takes the children to zero', async () => {
    const { HOLLOW_20_RING } = await import('../rules/house.js');
    const ringed = runCell(
      { child: 'searcher', villain: 'hunter', overrides: { house: HOLLOW_20_RING } }, 150);
    const deadEnds = runCell({ child: 'searcher', villain: 'hunter' }, 150);

    expect(ringed.namings).toBe(0);            // nothing to name with
    expect(ringed.meanSocksLifted).toBe(0);    // no sock ever reaches a hand
    expect(ringed.childrenWin).toBe(0);
    expect(deadEnds.childrenWin).toBeGreaterThan(0.2);
  });
});
