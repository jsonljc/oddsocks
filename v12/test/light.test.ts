import {
  LIT_AMBIENT_BY_NIGHT, DARK_AMBIENT_BY_NIGHT, DARK_ROOM_COUNT_BY_NIGHT, ALWAYS_LIT,
  ambientFor, darkRoomsFor, lightAt, visibilityAt,
  DARK_ENOUGH_FOR_TAKE, IDENTIFY_THRESHOLD, LANTERN_RADIUS,
} from '../src/core/light';
import { HOLLOW } from '../src/house/hollow';

const SEED = 4242;
const dark = (night: number) => darkRoomsFor(HOLLOW, night, SEED);

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
