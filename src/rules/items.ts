import type { Rng } from './rng.js';
import type { ItemKind, PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import { type GameState, capacityOf } from './state.js';
import { isBedroom } from './map.js';

const commonRooms = (state: GameState): RoomId[] =>
  Object.keys(state.config.house.rooms).filter((r) => !isBedroom(state.config.house, r)).sort();

const looseTotal = (state: GameState): number =>
  Object.values(state.loose).reduce((n, xs) => n + xs.length, 0);

/** Items appear in common rooms only, so fetching one means crossing the house. */
export function spawnItems(state: GameState, rng: Rng): PublicEvent[] {
  if (!state.config.layers.items) return [];
  const events: PublicEvent[] = [];
  const rooms = commonRooms(state);

  while (looseTotal(state) < state.config.itemsOnMap && state.reserve.length > 0) {
    const item = state.reserve.pop()!;
    const room = rng.pick(rooms);
    state.loose[room]!.push(item);
    events.push({ t: 'itemSpawned', item, room });
  }
  return events;
}

/** Picking one up is announced out loud. Contested items go to one claimant (R5). */
export function resolvePickups(
  state: GameState,
  dusk: Readonly<Record<PlayerId, RoomId>>,
  wants: Readonly<Record<PlayerId, boolean>>,
  rng: Rng,
): PublicEvent[] {
  if (!state.config.layers.items) return [];
  const events: PublicEvent[] = [];

  for (const room of commonRooms(state)) {
    const pile = state.loose[room]!;
    while (pile.length > 0) {
      const claimants = Object.keys(dusk)
        .filter((p) => dusk[p] === room && wants[p] === true)
        .filter((p) => state.held[p]!.length < capacityOf(state, p))
        .sort();
      if (claimants.length === 0) break;

      const winner = rng.pick(claimants);
      const item = pile.shift()!;
      state.held[winner]!.push(item);
      events.push({ t: 'itemTaken', player: winner, item, room });
    }
  }
  return events;
}

/** Spent items are gone for `itemRespawnDelay` mornings, then rejoin the reserve. */
export function spendItem(state: GameState, player: PlayerId, kind: ItemKind): void {
  const hand = state.held[player]!;
  const at = hand.indexOf(kind);
  if (at === -1) throw new Error(`${player} does not hold a ${kind}`);
  hand.splice(at, 1);
  state.returning.push({ item: kind, night: state.night + state.config.itemRespawnDelay });
}

export function processReturns(state: GameState): void {
  const due = state.returning.filter((r) => r.night <= state.night);
  state.returning = state.returning.filter((r) => r.night > state.night);
  for (const r of due) state.reserve.push(r.item);
}

export const itemHolders = (state: GameState): PlayerId[] =>
  state.config.roster.filter((p) => state.held[p]!.length > 0);
