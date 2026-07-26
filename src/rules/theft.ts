import type { Rng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import { type GameState, isLit } from './state.js';
import { isBedroom, ownerOf, roomsWithin } from './map.js';

export interface TheftOutcome {
  stole: boolean;
  victim: PlayerId | null;
  room: RoomId | null;
  events: PublicEvent[];
}

const NOTHING: TheftOutcome = { stole: false, victim: null, room: null, events: [] };

/**
 * The villain's night action in a bedroom. Theft is automatic on entering another
 * child's lit bedroom (R10); snuffing your own light is declared (R11).
 */
export function resolveTheft(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  snuffOwn: boolean,
  rng: Rng,
): TheftOutcome {
  const house = state.config.house;
  const room = midnight[state.villain];
  if (!room || !isBedroom(house, room) || !isLit(state, room)) return { ...NOTHING, events: [] };

  const owner = ownerOf(house, room);
  if (!owner) return { ...NOTHING, events: [] };

  // Their own light: optional, hushes them, and leaves no trail (R16).
  if (owner === state.villain) {
    if (!snuffOwn) return { ...NOTHING, events: [] };
    state.lit[room] = false;
    state.hushedSince[state.villain] = state.night;
    return {
      stole: false, victim: null, room,
      events: [{ t: 'selfSnuff', room }],
    };
  }

  const events: PublicEvent[] = [];
  state.lit[room] = false;
  state.hushedSince[owner] = state.night;
  events.push({ t: 'theft', room, victim: owner });

  // The Grip: the owner alone, and only if they were home (R3).
  if (midnight[owner] === room) {
    const carried = state.held[state.villain] ?? [];
    if (carried.length > 0) {
      const taken = rng.pick(carried);
      carried.splice(carried.indexOf(taken), 1);
      state.held[owner]!.push(taken);
      events.push({ t: 'grip', player: owner, item: taken });
    } else if (state.reserve.length > 0) {
      const given = state.reserve.pop()!;
      state.held[owner]!.push(given);
      events.push({ t: 'grip', player: owner, item: given });
    }
  }

  const witness = selectTrailWitness(state, room, midnight, rng);
  events.push({ t: 'trail', player: witness, room });

  return { stole: true, victim: owner, room, events };
}

/** One child, chosen uniformly, who ended midnight within the trail radius (R2). */
export function selectTrailWitness(
  state: GameState,
  robbed: RoomId,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  rng: Rng,
): PlayerId {
  const near = new Set(roomsWithin(state.config.house, robbed, state.config.trailRadius));
  const pool = Object.keys(midnight).filter((p) => near.has(midnight[p]!));
  if (pool.length === 0) throw new Error(`empty trail pool for ${robbed}`);
  return rng.pick(pool.sort());
}
