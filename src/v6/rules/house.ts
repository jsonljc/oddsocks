import type { House, PlayerId, Room, RoomId } from './types.js';

/**
 * Hub-and-spoke: one landing per floor chained ground-upward, with dead-end
 * spokes hung off each. Diameter is always 4 — spoke, landing, landing,
 * landing, spoke — for any number of spokes, which is why the design can scale
 * the house without scaling the travel time.
 */
export function makeHouse(
  spokesPerFloor: readonly number[],
  spokeCapacity = 2,
  ring = false,
): House {
  if (spokesPerFloor.length < 2) throw new Error('a house needs at least two floors');
  if (spokeCapacity < 1) throw new Error(`spokeCapacity must be >= 1, got ${spokeCapacity}`);

  const landings = spokesPerFloor.map((_, f) => `landing_${f}`);
  const rooms: Record<RoomId, Room> = {};

  spokesPerFloor.forEach((count, floor) => {
    const stairs = [landings[floor - 1], landings[floor + 1]].filter((x): x is string => !!x);
    const spokes = Array.from({ length: count }, (_, i) => `s${floor}_${i}`);
    rooms[landings[floor]!] = {
      id: landings[floor]!, kind: 'landing', floor,
      doors: [...stairs, ...spokes], capacity: Infinity,
    };
    spokes.forEach((id, i) => {
      // A ring joins each spoke to its neighbours along the same floor. Without
      // it a spoke is a strict dead end, so anyone who steps into one is forced
      // back out the next night and the whole cast phase-locks — measured at 600
      // takes on odd nights against 27 on even ones, every player in a spoke on
      // odd nights and under a candle on even ones. Diameter is unaffected:
      // spoke, landing, landing, landing, spoke is still 4.
      const neighbours = ring && spokes.length > 2
        ? [spokes[(i + 1) % spokes.length]!, spokes[(i - 1 + spokes.length) % spokes.length]!]
        : [];
      rooms[id] = {
        id, kind: 'spoke', floor,
        doors: [landings[floor]!, ...neighbours], capacity: spokeCapacity,
      };
    });
  });

  return {
    id: `hollow${Object.keys(rooms).length}`,
    rooms,
    landings,
    // The Sitting Room is the ground landing, not a spoke. A spoke holds two,
    // so starting everyone in one would break capacity on night zero — and it
    // would also make night one structurally take-free, since a spoke has a
    // single exit and the whole house would be funnelled onto one landing.
    start: landings[0]!,
  };
}

/** 20 rooms, three floors, diameter 4 — the house the design specifies. */
export const HOLLOW_20 = makeHouse([6, 5, 6]);

/** The same house with the spokes joined along each floor. */
export const HOLLOW_20_RING = makeHouse([6, 5, 6], 2, true);

export const SCALES: Readonly<Record<number, readonly number[]>> = {
  4: [4, 3, 4],     // 14 rooms
  6: [6, 5, 6],     // 20
  8: [8, 7, 8],     // 26
  10: [10, 9, 10],  // 32
};

const roomOf = (house: House, id: RoomId): Room => {
  const r = house.rooms[id];
  if (!r) throw new Error(`unknown room: ${id}`);
  return r;
};

export const doorsOf = (house: House, id: RoomId): readonly RoomId[] => roomOf(house, id).doors;
export const kindOf = (house: House, id: RoomId) => roomOf(house, id).kind;
export const floorOf = (house: House, id: RoomId): number => roomOf(house, id).floor;
export const capacityOf = (house: House, id: RoomId): number => roomOf(house, id).capacity;
export const isSpoke = (house: House, id: RoomId): boolean => kindOf(house, id) === 'spoke';
export const adjacent = (house: House, a: RoomId, b: RoomId): boolean =>
  roomOf(house, a).doors.includes(b);

/** The landing a spoke hangs off, or the landing itself. */
export function landingOf(house: House, id: RoomId): RoomId {
  const r = roomOf(house, id);
  return r.kind === 'landing' ? r.id : r.doors[0]!;
}

/**
 * Where a player may end tonight. Movement is mandatory, so a player in a
 * spoke has exactly one legal move — which is why nobody can hide in the dark
 * two nights running, and why a sock in a spoke pins the villain to that
 * landing on the nights either side of it.
 */
export function legalMoves(house: House, from: RoomId): readonly RoomId[] {
  return doorsOf(house, from);
}

/** Breadth-first hop count. Infinity if unreachable (a wedged door can do it). */
export function distance(house: House, a: RoomId, b: RoomId, blocked?: (r: RoomId) => boolean): number {
  if (a === b) return 0;
  const seen = new Set<RoomId>([a]);
  let frontier: RoomId[] = [a];
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: RoomId[] = [];
    for (const cur of frontier) {
      for (const n of doorsOf(house, cur)) {
        if (seen.has(n) || blocked?.(n)) continue;
        if (n === b) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}

export function diameter(house: House): number {
  const ids = Object.keys(house.rooms);
  let worst = 0;
  for (const a of ids) for (const b of ids) worst = Math.max(worst, distance(house, a, b));
  return worst;
}

/** Every spoke hanging off a landing. */
export function spokesOf(house: House, landing: RoomId): readonly RoomId[] {
  return doorsOf(house, landing).filter((r) => isSpoke(house, r));
}

export const rosterFor = (n: number): readonly PlayerId[] =>
  ['nel', 'rook', 'otto', 'wren', 'mab', 'pim', 'cleo', 'bram', 'sasha', 'fen'].slice(0, n);
