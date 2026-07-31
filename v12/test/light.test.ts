import {
  LIT_AMBIENT_BY_NIGHT, DARK_AMBIENT_BY_NIGHT, DARK_ROOM_COUNT_BY_NIGHT, ALWAYS_LIT,
  ambientFor, darkRoomsFor, lightAt, visibilityAt,
  DARK_ENOUGH_FOR_TAKE, IDENTIFY_THRESHOLD, LANTERN_RADIUS,
} from '../src/core/light';
import { HOLLOW } from '../src/house/hollow';
import { createSim } from '../src/core/sim';
import type { RoomId } from '../src/core/house';

const SEED = 4242;
const dark = (night: number) => darkRoomsFor(HOLLOW, night, SEED);

// CRITICAL FIX (slice-0/1 final review, item 1) — darkRoomsFor and Sim's
// starting-room assignment both shuffled the SAME 11-room array (all rooms
// minus hearth) with the SAME Fisher-Yates seeded by the SAME makeRng(seed).
// Two independent shuffles of the same input with the same generator produce
// the same permutation, so darkRoomsFor's dark set was always exactly a
// PREFIX of the starting-room order: actor slot i started dark on night n iff
// i < DARK_ROOM_COUNT_BY_NIGHT[n-1], regardless of seed. With night.ts's fixed
// roster (bell = slot 0, wren = slot 3), that meant the human player started
// dark on EVERY seed and the stalker started lit on EVERY seed — "six
// randomised starting rooms" was false in the one property that mattered.
//
// Fixed by giving darkRoomsFor its own RNG stream (`seed ^ 0xda2c`), the same
// technique test/sim.test.ts already uses to decorrelate its own input stream
// from the sim's seed.
describe('darkRoomsFor does not share a stream with the starting-room shuffle', () => {
  const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];
  const SEEDS = [1, 2, 3, 42, 4242, 99, 7, 1234];

  // Derived from a REAL Sim, not a re-implementation of its shuffle — so this
  // test tracks whatever sim.ts's constructor actually does, rather than a
  // copy of today's algorithm that would go stale (and stay green) the moment
  // that algorithm changed.
  function startingOrder(seed: number): RoomId[] {
    return createSim(HOLLOW, seed, IDS).state.actors.map(a => a.room);
  }

  // Nights 5-6 schedule 11 dark rooms — the entire candidate pool (11 rooms:
  // all but the Hearth) — so the dark set trivially equals "the whole
  // starting order" there regardless of which stream computed it. Nights 1-4
  // (counts 3/5/7/9) are proper subsets, where prefix-equality is an actual,
  // falsifiable claim about the two shuffles sharing a stream.
  it('is not a prefix of the starting-room order on any night with room to spare', () => {
    for (const seed of SEEDS) {
      const order = startingOrder(seed);
      for (const night of [1, 2, 3, 4]) {
        const darkSet = darkRoomsFor(HOLLOW, night, seed);
        const count = DARK_ROOM_COUNT_BY_NIGHT[night - 1]!;
        const prefix = order.slice(0, count);
        const isPrefix = prefix.length === darkSet.size && prefix.every(r => darkSet.has(r));
        expect(isPrefix, `seed ${seed} night ${night}: dark set was a prefix of starting order`)
          .toBe(false);
      }
    }
  });

  // The property the bug actually threatened, made concrete: night one, which
  // slot starts dark should depend on the seed, not be fixed by slot index
  // alone. Before the fix, slot 0 (bell in night.ts's roster) was dark on
  // EVERY one of these seeds and slot 3 (wren) was lit on every one — proven
  // in the report's mutation check, not just asserted here.
  it('lets different seeds put different starting slots in the dark on night one', () => {
    const slot0Dark = SEEDS.map(seed => {
      const order = startingOrder(seed);
      return darkRoomsFor(HOLLOW, 1, seed).has(order[0]!);
    });
    const slot3Dark = SEEDS.map(seed => {
      const order = startingOrder(seed);
      return darkRoomsFor(HOLLOW, 1, seed).has(order[3]!);
    });
    expect(new Set(slot0Dark).size, 'slot 0 dark-status is constant across seeds').toBe(2);
    expect(new Set(slot3Dark).size, 'slot 3 dark-status is constant across seeds').toBe(2);
  });
});

describe('darkRoomsFor', () => {
  it('is deterministic for a seed and grows with the night', () => {
    expect([...dark(3)].sort()).toEqual([...darkRoomsFor(HOLLOW, 3, SEED)].sort());
    for (let n = 2; n <= 6; n++) {
      expect(dark(n).size, `night ${n}`).toBeGreaterThanOrEqual(dark(n - 1).size);
    }
  });

  // Nested, so the house is learnable rather than re-rolled every night.
  it('never re-lights a room that was dark the night before', () => {
    for (let n = 2; n <= 6; n++) {
      for (const room of dark(n - 1)) expect(dark(n).has(room), `${room} n${n}`).toBe(true);
    }
  });

  it('never darkens the Hearth — it is on fire', () => {
    for (let n = 1; n <= 6; n++) {
      for (const lit of ALWAYS_LIT) expect(dark(n).has(lit), `n${n}`).toBe(false);
    }
  });

  it('matches the scheduled count', () => {
    for (let n = 1; n <= 6; n++) {
      expect(dark(n).size, `night ${n}`).toBe(DARK_ROOM_COUNT_BY_NIGHT[n - 1]);
    }
  });

  it('varies between matches', () => {
    expect([...darkRoomsFor(HOLLOW, 3, 1)].sort())
      .not.toEqual([...darkRoomsFor(HOLLOW, 3, 2)].sort());
  });
});

// THE REGRESSION THAT MATTERS. The first version of this file used one global
// ambient per night, which made every room too bright to grab in on nights 2
// and 3 — so the game could not start until Night Four, against v12.2 §13,
// which bans the grab on Night One ONLY. These two tests pin that per night.
describe('the house is playable on every night it should be', () => {
  it('offers a grabbable room on every night from two onward', () => {
    for (let n = 2; n <= 6; n++) {
      const rooms = HOLLOW.rooms.filter(r => dark(n).has(r.id));
      expect(rooms.length, `night ${n} has no dark room`).toBeGreaterThan(0);
      const level = lightAt(n, rooms[0]!.id, { x: 0, y: 0 }, [], dark(n));
      expect(level, `night ${n} dark room is too bright to grab in`)
        .toBeLessThan(DARK_ENOUGH_FOR_TAKE);
    }
  });

  it('keeps at least one room where you can still see faces, every night', () => {
    for (let n = 1; n <= 6; n++) {
      const litRooms = HOLLOW.rooms.filter(r => !dark(n).has(r.id));
      expect(litRooms.length, `night ${n}`).toBeGreaterThan(0);
      const level = lightAt(n, litRooms[0]!.id, { x: 0, y: 0 }, [], dark(n));
      expect(level, `night ${n} lit room hides faces`).toBeGreaterThanOrEqual(IDENTIFY_THRESHOLD);
    }
  });
});

describe('ambientFor', () => {
  it('separates lit from dark, and both curves fall with the night', () => {
    for (let n = 2; n <= 6; n++) {
      expect(LIT_AMBIENT_BY_NIGHT[n - 1]!).toBeLessThanOrEqual(LIT_AMBIENT_BY_NIGHT[n - 2]!);
      expect(DARK_AMBIENT_BY_NIGHT[n - 1]!).toBeLessThanOrEqual(DARK_AMBIENT_BY_NIGHT[n - 2]!);
    }
    expect(Math.max(...DARK_AMBIENT_BY_NIGHT)).toBeLessThan(DARK_ENOUGH_FOR_TAKE);
    expect(Math.min(...LIT_AMBIENT_BY_NIGHT)).toBeGreaterThanOrEqual(IDENTIFY_THRESHOLD);
  });

  it('clamps out-of-range and fractional nights rather than returning undefined', () => {
    const none = new Set<string>();
    expect(ambientFor(0, 'kitchen', none)).toBe(LIT_AMBIENT_BY_NIGHT[0]);
    expect(ambientFor(99, 'kitchen', none)).toBe(LIT_AMBIENT_BY_NIGHT[5]);
    expect(Number.isFinite(ambientFor(2.5, 'kitchen', none))).toBe(true);
  });
});

describe('lightAt', () => {
  const lantern = { room: 'kitchen', at: { x: 100, y: 100 }, radius: LANTERN_RADIUS };
  const allDark = new Set(HOLLOW.rooms.map(r => r.id));

  it('is ambient with no sources', () => {
    expect(lightAt(6, 'kitchen', { x: 0, y: 0 }, [], allDark))
      .toBe(ambientFor(6, 'kitchen', allDark));
  });

  it('is full at a lantern and ambient beyond its radius', () => {
    expect(lightAt(6, 'kitchen', { x: 100, y: 100 }, [lantern], allDark)).toBe(1);
    expect(lightAt(6, 'kitchen', { x: 100 + LANTERN_RADIUS + 1, y: 100 }, [lantern], allDark))
      .toBe(ambientFor(6, 'kitchen', allDark));
  });

  it('does not leak between rooms', () => {
    expect(lightAt(6, 'library', { x: 100, y: 100 }, [lantern], allDark))
      .toBe(ambientFor(6, 'library', allDark));
  });

  it('falls off with distance inside the radius', () => {
    const near = lightAt(6, 'kitchen', { x: 130, y: 100 }, [lantern], allDark);
    const far  = lightAt(6, 'kitchen', { x: 190, y: 100 }, [lantern], allDark);
    expect(near).toBeGreaterThan(far);
  });

  // v12.2 §5 — a placed lantern "stops the Odd Sock grabbing anyone inside the light"
  it('lifts a dark room above the grab threshold where the lantern reaches', () => {
    expect(lightAt(6, 'kitchen', { x: 110, y: 100 }, [lantern], allDark))
      .toBeGreaterThanOrEqual(DARK_ENOUGH_FOR_TAKE);
  });
});

describe('visibilityAt', () => {
  // v12.2 §4 — in the dark names vanish and outlines blur, but you can still
  // hear footsteps. So darkness degrades to a silhouette, never to nothing.
  it('identifies in light, silhouettes in the dark, and never blinds at any ambient', () => {
    expect(visibilityAt(1)).toBe('identified');
    expect(visibilityAt(IDENTIFY_THRESHOLD)).toBe('identified');
    expect(visibilityAt(IDENTIFY_THRESHOLD - 0.01)).toBe('silhouette');
    for (const a of DARK_AMBIENT_BY_NIGHT) expect(visibilityAt(a)).toBe('silhouette');
    expect(visibilityAt(0)).toBe('unseen');
  });
});
