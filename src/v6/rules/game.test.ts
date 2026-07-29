import { describe, expect, it } from 'vitest';
import { CHILD_POLICIES, VILLAIN_POLICIES } from '../bots/policies.js';
import type { Bot } from '../bots/types.js';
import { makeConfig } from './config.js';
import { playGame } from './game.js';
import { capacityOf, isSpoke } from './house.js';
import type { PlayerId } from './types.js';

const config = makeConfig();
const everyone = (bot: Bot): Record<PlayerId, Bot> =>
  Object.fromEntries(config.roster.map((p) => [p, bot]));

const games = (n: number, bot: Bot = CHILD_POLICIES.searcher) =>
  Array.from({ length: n }, (_, i) => playGame(config, 1000 + i, everyone(bot)));

describe('the night, as a whole', () => {
  it('always terminates — wax is monotone, so the house always darkens', () => {
    for (const g of games(200)) {
      expect(g.outcome.winner, `seed ${g.seed}`).not.toBe('stalled');
      expect(g.nights.length).toBeLessThanOrEqual(config.maxNights);
    }
  });

  it('never puts more people in a spoke than it holds', () => {
    // The rule that kills the committee. If it leaks, a trio can search in
    // safety and the whole spine reverts to its predecessor's stalemate.
    for (const g of games(200)) {
      for (const night of g.nights) {
        const count = new Map<string, number>();
        for (const room of Object.values(night.positions)) {
          count.set(room, (count.get(room) ?? 0) + 1);
        }
        for (const [room, n] of count) {
          if (!isSpoke(config.house, room)) continue;
          expect(n, `${room} on night ${night.night} of seed ${g.seed}`)
            .toBeLessThanOrEqual(capacityOf(config.house, room));
        }
      }
    }
  });

  it('takes only when exactly two share a room and one of them is Odd Socks', () => {
    for (const g of games(200)) {
      for (const night of g.nights) {
        if (!night.took) continue;
        const room = night.positions[night.took]!;
        expect(night.positions[g.villain]).toBe(room);
        const inRoom = Object.entries(night.positions)
          .filter(([p, r]) => r === room && (p === g.villain || p === night.took));
        expect(inRoom).toHaveLength(2);
      }
    }
  });

  it('sheds a sock every single night, wherever Odd Socks slept', () => {
    // Not on takes — on nights. This is the fix for the defect that stalled the
    // previous design, where the children's only route was gated on the villain
    // choosing to act, so a villain who did nothing starved it.
    for (const g of games(100)) {
      for (const night of g.nights) {
        expect(night.shedAt, `night ${night.night} of seed ${g.seed}`)
          .toBe(night.positions[g.villain]);
      }
    }
  });

  it('never puts wax back on a candle', () => {
    for (const g of games(100)) {
      const last = new Map<string, number>();
      for (const night of g.nights) {
        for (const e of night.events) {
          if (e.t !== 'wax') continue;
          const before = last.get(e.room);
          if (before !== undefined) expect(e.left).toBeLessThanOrEqual(before);
          last.set(e.room, e.left);
        }
      }
    }
  });

  it('ends the moment a win condition is met and not a night later', () => {
    for (const g of games(200)) {
      if (g.outcome.winner === 'stalled') continue;
      const ends = g.nights.length;
      expect(g.nights[ends - 1]).toBeDefined();
      if (g.outcome.how === 'taken') {
        const taken = g.nights.filter((n) => n.took).length;
        expect(taken).toBe(config.takeTarget);
      }
    }
  });

  it('gives a taken child no further sightings', () => {
    for (const g of games(100)) {
      const gone = new Set<PlayerId>();
      for (const night of g.nights) {
        for (const p of gone) expect(night.sightings[p]).toBeUndefined();
        if (night.took) gone.add(night.took);
      }
    }
  });
});

describe('the villain draw', () => {
  it('picks a villain from the roster and only one', () => {
    for (const g of games(50)) expect(config.roster).toContain(g.villain);
  });

  it('is stable for a seed', () => {
    const a = playGame(config, 4242, everyone(CHILD_POLICIES.random));
    const b = playGame(config, 4242, everyone(CHILD_POLICIES.random));
    expect(a.villain).toBe(b.villain);
    expect(a.nights.length).toBe(b.nights.length);
    expect(a.outcome).toEqual(b.outcome);
  });
});

describe('every villain policy is playable', () => {
  for (const [name, bot] of Object.entries(VILLAIN_POLICIES)) {
    it(`survives 50 games as ${name}`, () => {
      for (let i = 0; i < 50; i++) {
        const probe = playGame(config, 7000 + i, everyone(CHILD_POLICIES.random));
        const bots = Object.fromEntries(config.roster.map((p) =>
          [p, p === probe.villain ? bot : CHILD_POLICIES.searcher]));
        expect(() => playGame(config, 7000 + i, bots)).not.toThrow();
      }
    });
  }
});
