import type { GameRecord } from '../rules/game.js';
import type { PlayerId, RoomId } from '../rules/types.js';
import type { NightRecord } from '../rules/state.js';
import { distance, doorsOf, roomsWithin } from '../rules/map.js';

/** Two phases of two steps each. */
const MAX_HOPS_PER_NIGHT = 4;

const others = (record: GameRecord): PlayerId[] =>
  record.config.roster.filter((p) => p !== record.villain);

/**
 * Every room the villain could have claimed on this night without contradicting a
 * hard fact. Ignores the night-to-night chain — `solve` handles that.
 */
export function viableRoomsAt(record: GameRecord, night: number): RoomId[] {
  const n = record.nights[night - 1];
  if (!n) return [];

  const house = record.config.house;
  const villain = record.villain;
  const truth = n.midnightPositions[villain]!;
  const innocents = others(record);

  // A lit-room witness names everyone present. If one named the villain, the
  // claim is pinned; if one was somewhere else and did not, that room is refuted.
  const refuted = new Set<RoomId>();
  for (const p of innocents) {
    const s = n.sightings[p]!;
    if (!s.lit) continue;
    if (s.named.includes(villain)) return [truth];
    refuted.add(s.room);
  }

  // Dark rooms hide identity but not headcount. If an occupant reported k others,
  // exactly k+1 players were there — one more claimant than that is a contradiction.
  // Tally only innocents' claims: they are always truthful, so this counts how many
  // seats are already spoken for before the villain's hypothetical claim adds one
  // more. Counting the villain's own (truthful) claim here too would double-count
  // it against the very room being tested, refuting the villain's real room
  // whenever nobody present happened to be Hushed.
  for (const p of innocents) {
    const s = n.sightings[p]!;
    if (s.lit) continue;
    const claimants = innocents.filter((q) => n.claims[q] === s.room).length;
    if (claimants >= s.others + 1) refuted.add(s.room);
  }

  let candidates = Object.keys(house.rooms).filter((r) => !refuted.has(r));

  // The trail: if it named the villain, they were within the radius of the robbery.
  for (const e of n.events) {
    if (e.t === 'trail' && e.player === villain) {
      const near = new Set(roomsWithin(house, e.room, record.config.trailRadius));
      candidates = candidates.filter((r) => near.has(r));
    }
    // The Bell announces the true room outright — no lie survives it.
    if (e.t === 'bell' && e.target === villain) candidates = [e.room];
    // A Keyhole pins or forbids this night's claim.
    if (e.t === 'keyhole' && e.night === night) {
      candidates = e.occupants.includes(villain)
        ? candidates.filter((r) => r === e.room)
        : candidates.filter((r) => r !== e.room);
    }
  }

  // Public oddities only — private ones are deniable, so they prove nothing.
  candidates = candidates.filter((r) => publicOdditiesAllow(record, n, r));

  // A theft is a light going out in a room the villain was standing in, and a
  // dark room can hold a lie. Nothing further to enforce here.
  return candidates.sort();
}

function publicOdditiesAllow(record: GameRecord, n: NightRecord, claim: RoomId): boolean {
  if (!record.config.layers.oddities) return true;
  const house = record.config.house;
  const villain = record.villain;
  const innocents = others(record);

  for (const e of n.events) {
    if (e.t !== 'oddity') continue;
    const payload = e.payload as Record<string, unknown>;

    if (e.source === 'bell' && e.detail === 'adjacentCount' && villain !== 'bell') {
      const bellRoom = n.midnightPositions['bell'];
      if (!bellRoom) continue;
      const beside = new Set(doorsOf(house, bellRoom));
      const fromInnocents = innocents
        .filter((p) => p !== 'bell' && beside.has(n.midnightPositions[p]!)).length;
      const implied = fromInnocents + (beside.has(claim) ? 1 : 0);
      if (implied !== payload['count']) return false;
    }

    if (e.source === 'clem' && e.detail === 'itemHolders' && villain !== 'clem') {
      const clemRoom = n.midnightPositions['clem'];
      if (!clemRoom || claim !== clemRoom) continue;
      // Item holding is public, so a villain claiming Clem's room must fit the tally.
      const held = n.events.filter((x) => x.t === 'itemTaken' && x.player === villain).length;
      if (held > 0 && payload['count'] === 0) return false;
    }
  }
  return true;
}

const padded = (xs: number[], nights: number): number[] =>
  xs.concat(Array<number>(Math.max(0, nights - xs.length)).fill(0));

/**
 * Forward-backward DP over claim histories. State is "the room claimed on night n",
 * transitions are "reachable within four hops".
 */
export function solve(record: GameRecord): { forcedNight: number | null; hidingSpace: number[] } {
  const house = record.config.house;
  const nights = record.nights.length;

  const viable: RoomId[][] = [];
  for (let i = 1; i <= nights; i++) viable.push(viableRoomsAt(record, i));

  // Forward pass: which rooms are reachable from a consistent past.
  let reachable: Set<RoomId> = new Set(viable[0] ?? []);
  const forward: Set<RoomId>[] = [new Set(reachable)];

  for (let i = 1; i < nights; i++) {
    const next = new Set<RoomId>();
    for (const room of viable[i]!) {
      for (const prev of reachable) {
        if (distance(house, prev, room) <= MAX_HOPS_PER_NIGHT) { next.add(room); break; }
      }
    }
    forward.push(new Set(next));
    reachable = next;
    if (next.size === 0) {
      return { forcedNight: i + 1, hidingSpace: padded(forward.map((s) => s.size), nights) };
    }
  }

  if ((forward[0]?.size ?? 0) === 0) {
    return { forcedNight: 1, hidingSpace: padded([0], nights) };
  }

  // Backward pass: drop rooms with no consistent future.
  const hidingSpace = forward.map((s) => s.size);
  for (let i = nights - 2; i >= 0; i--) {
    const survivors = [...forward[i]!].filter((room) =>
      [...forward[i + 1]!].some((nxt) => distance(house, room, nxt) <= MAX_HOPS_PER_NIGHT));
    forward[i] = new Set(survivors);
    hidingSpace[i] = survivors.length;
  }

  return { forcedNight: null, hidingSpace: padded(hidingSpace, nights) };
}
