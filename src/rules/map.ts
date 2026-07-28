import type { House, Path, PlayerId, RoomId } from './types.js';

const roomOf = (house: House, id: RoomId) => {
  const r = house.rooms[id];
  if (!r) throw new Error(`unknown room: ${id}`);
  return r;
};

export const doorsOf = (house: House, id: RoomId): RoomId[] => [...roomOf(house, id).doors];
export const isBedroom = (house: House, id: RoomId): boolean => roomOf(house, id).kind === 'bedroom';
export const ownerOf = (house: House, id: RoomId): PlayerId | undefined => roomOf(house, id).owner;
export const floorOf = (house: House, id: RoomId): 0 | 1 => roomOf(house, id).floor;
export const adjacent = (house: House, a: RoomId, b: RoomId): boolean =>
  roomOf(house, a).doors.includes(b);

export function bedroomOf(house: House, player: PlayerId): RoomId {
  const found = Object.values(house.rooms).find((r) => r.owner === player);
  if (!found) throw new Error(`no bedroom for player: ${player}`);
  return found.id;
}

export function isLegalPath(house: House, from: RoomId, path: Path): boolean {
  const [a, b] = path;
  return adjacent(house, from, a) && adjacent(house, a, b);
}

export function legalPaths(house: House, from: RoomId): Path[] {
  const out: Path[] = [];
  for (const a of doorsOf(house, from)) {
    for (const b of doorsOf(house, a)) out.push([a, b] as const);
  }
  return out;
}

/** Breadth-first hop count. Returns Infinity if unreachable. */
export function distance(house: House, a: RoomId, b: RoomId): number {
  if (a === b) return 0;
  const seen = new Set<RoomId>([a]);
  let frontier: RoomId[] = [a];
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: RoomId[] = [];
    for (const cur of frontier) {
      for (const n of doorsOf(house, cur)) {
        if (seen.has(n)) continue;
        if (n === b) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Every room reachable in `n` hops or fewer, including `room` itself. */
export function roomsWithin(house: House, room: RoomId, n: number): RoomId[] {
  return Object.keys(house.rooms).filter((r) => distance(house, room, r) <= n);
}
