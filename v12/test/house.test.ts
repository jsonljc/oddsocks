import {
  validateHouse, exitsOf, roomById, doorCount, bindEligible,
  houseAfterSealing, nearestDoor, MAX_DOORS, BIND_DOORS,
} from '../src/core/house';
import { HOLLOW } from '../src/house/hollow';

describe('HOLLOW shape', () => {
  // v12.2 §3 — ten rooms, plus the bedroom you start in and the fireplace room
  it('has twelve rooms: ten plus the Shared Bedroom and the Hearth', () => {
    expect(HOLLOW.rooms).toHaveLength(12);
    const ids = HOLLOW.rooms.map(r => r.id);
    expect(ids).toContain('shared_bedroom');
    expect(ids).toContain('hearth');
  });

  it('spans exactly two floors, six rooms each', () => {
    expect(HOLLOW.rooms.filter(r => r.floor === 0)).toHaveLength(6);
    expect(HOLLOW.rooms.filter(r => r.floor === 1)).toHaveLength(6);
  });

  it('joins the floors with stairs', () => {
    expect(HOLLOW.doors.filter(d => d.kind === 'stair').length).toBeGreaterThanOrEqual(2);
  });
});

describe('v12.2 §3 — the door ceiling', () => {
  it('gives no room more than three doors', () => {
    for (const room of HOLLOW.rooms) {
      expect(doorCount(HOLLOW, room.id), room.id).toBeLessThanOrEqual(MAX_DOORS);
    }
  });

  it('gives every room at least one door', () => {
    for (const room of HOLLOW.rooms) {
      expect(doorCount(HOLLOW, room.id), room.id).toBeGreaterThan(0);
    }
  });

  // This is the whole reason the ceiling moved from two to three. A house where
  // every room has two doors is a line or a loop, and hidden movement is pointless.
  it('actually branches — at least three rooms have three doors', () => {
    const hubs = HOLLOW.rooms.filter(r => doorCount(HOLLOW, r.id) === 3);
    expect(hubs.length).toBeGreaterThanOrEqual(3);
  });

  it('is not a single cycle — it has more doors than a ring of twelve would', () => {
    expect(HOLLOW.doors.length).toBeGreaterThan(HOLLOW.rooms.length);
  });
});

describe('v12.2 §11 — the Bind needs a two-door room', () => {
  it('has at least one', () => {
    expect(bindEligible(HOLLOW).length).toBeGreaterThan(0);
    for (const r of bindEligible(HOLLOW)) expect(doorCount(HOLLOW, r.id)).toBe(BIND_DOORS);
  });

  // v12.2 §13 seals peripheral rooms from Night Four. The children's only win
  // condition must not be sealed away by the house itself.
  it('still has one after every scheduled sealing', () => {
    for (let n = 0; n <= HOLLOW.sealOrder.length; n++) {
      expect(bindEligible(houseAfterSealing(HOLLOW, n)).length, `after ${n} seals`)
        .toBeGreaterThan(0);
    }
  });

  it('never seals the Hearth', () => {
    expect(HOLLOW.sealOrder).not.toContain('hearth');
  });

  it('leaves no room doorless and the house connected after every sealing', () => {
    for (let n = 0; n <= HOLLOW.sealOrder.length; n++) {
      const h = houseAfterSealing(HOLLOW, n);
      for (const room of h.rooms) {
        expect(doorCount(h, room.id), `${room.id} after ${n} seals`).toBeGreaterThan(0);
      }
      const seen = new Set([h.rooms[0]!.id]);
      const queue = [h.rooms[0]!.id];
      while (queue.length) {
        const id = queue.shift()!;
        for (const d of exitsOf(h, id)) {
          const other = d.a === id ? d.b : d.a;
          if (!seen.has(other)) { seen.add(other); queue.push(other); }
        }
      }
      expect(seen.size, `connected after ${n} seals`).toBe(h.rooms.length);
    }
  });
});

describe('validateHouse', () => {
  it('passes HOLLOW clean', () => {
    expect(validateHouse(HOLLOW)).toEqual([]);
  });

  it('rejects a fourth door on a room', () => {
    const broken = { ...HOLLOW, doors: [...HOLLOW.doors,
      { id: 'x1', a: 'nursery', b: 'cellar', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
      { id: 'x2', a: 'nursery', b: 'library', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const }] };
    expect(validateHouse(broken).join(' ')).toMatch(/nursery.*doors/i);
  });

  it('rejects a house with no two-door room', () => {
    const ring = {
      rooms: HOLLOW.rooms.slice(0, 3),
      doors: [
        { id: 'a', a: 'shared_bedroom', b: 'hearth', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
        { id: 'b', a: 'hearth', b: 'kitchen', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
      ],
      sealOrder: [],
    };
    // bedroom=1, hearth=2, kitchen=1 -> hearth IS two-door, so this one passes that check.
    // Strip the hearth's second door to remove every two-door room:
    const noBind = { ...ring, doors: [ring.doors[0]!] };
    expect(validateHouse(noBind).join(' ')).toMatch(/two-door|Bind/i);
  });

  it('rejects sealing the Hearth', () => {
    expect(validateHouse({ ...HOLLOW, sealOrder: ['hearth'] }).join(' ')).toMatch(/hearth/i);
  });

  it('rejects a seal schedule that strands a room', () => {
    // Sealing every neighbour of the Attic would leave it doorless.
    const attic = exitsOf(HOLLOW, 'attic').map(d => (d.a === 'attic' ? d.b : d.a));
    expect(validateHouse({ ...HOLLOW, sealOrder: attic }).join(' ')).toMatch(/no doors|doorless/i);
  });

  it('roomById throws on an unknown id rather than returning undefined', () => {
    expect(() => roomById(HOLLOW, 'no_such_room')).toThrow();
  });
});

// Task 11's brief describes controls as "F toggles the nearest door" but its
// own reference dispatch() took `exitsOf(house, room)[0]` — always the FIRST
// exit in house.doors' declaration order, regardless of where the player is
// standing. In a three-door hub that's a real defect: pressing F near one
// door can silently toggle a different one across the room. nearestDoor
// exists so the brief's own stated control actually does what it says.
describe('nearestDoor', () => {
  it('picks the closer of two doors in a three-door room, not the first one declared', () => {
    // music_room's doors, in house.doors declaration order: d_nursery_music
    // (west wall), d_music_bathroom (east wall), d_music_playroom (south).
    // exitsOf preserves that order, so d_nursery_music is index [0] — picking
    // a point near the EAST wall proves this isn't just "[0] again by luck".
    const bounds = HOLLOW.rooms.find(r => r.id === 'music_room')!.bounds;
    const nearEastWall = { x: bounds.x + bounds.w - 10, y: bounds.y + bounds.h / 2 };
    const exits = exitsOf(HOLLOW, 'music_room');
    expect(exits[0]!.id).toBe('d_nursery_music'); // pin the "old code would pick this" premise
    expect(nearestDoor(HOLLOW, 'music_room', nearEastWall)?.id).toBe('d_music_bathroom');
  });

  it('picks the closer of two doors in a two-door room, not the first one declared', () => {
    // cellar's doors, in declaration order: d_cellar_library (south wall),
    // d_bed_cellar (north wall) — so index [0] is d_cellar_library.
    const bounds = HOLLOW.rooms.find(r => r.id === 'cellar')!.bounds;
    const nearNorthWall = { x: bounds.x + 20, y: bounds.y + 1 };
    const exits = exitsOf(HOLLOW, 'cellar');
    expect(exits[0]!.id).toBe('d_cellar_library');
    expect(nearestDoor(HOLLOW, 'cellar', nearNorthWall)?.id).toBe('d_bed_cellar');
  });

  it('returns the only door of a single-exit room regardless of position', () => {
    const solo = {
      rooms: [{ id: 'a', name: 'A', floor: 0, bounds: { x: 0, y: 0, w: 100, h: 100 }, centralObject: '' }],
      doors: [{ id: 'd', a: 'a', b: 'a', at: { x: 999, y: 999 }, span: 20, kind: 'doorway' as const }],
      sealOrder: [],
    };
    expect(nearestDoor(solo, 'a', { x: 0, y: 0 })?.id).toBe('d');
  });

  it('returns undefined for a room with no doors', () => {
    const stranded = {
      rooms: [{ id: 'a', name: 'A', floor: 0, bounds: { x: 0, y: 0, w: 100, h: 100 }, centralObject: '' }],
      doors: [],
      sealOrder: [],
    };
    expect(nearestDoor(stranded, 'a', { x: 0, y: 0 })).toBeUndefined();
  });
});
