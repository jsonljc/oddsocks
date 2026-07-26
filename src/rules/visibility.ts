import type { PlayerId, RoomId } from './types.js';
import { type GameState, type Sighting, isLit } from './state.js';

/**
 * The game's only asymmetry. Odd Socks always reads names in the dark; Wren does
 * too, when the oddities layer is switched on.
 */
export function seesNamesInDark(state: GameState, player: PlayerId): boolean {
  if (player === state.villain) return true;
  return state.config.layers.oddities && player === 'wren';
}

/**
 * What each player learns at the end of a phase. The count of others is always
 * truthful — only names are withheld.
 */
export function sightingsAt(
  state: GameState,
  positions: Readonly<Record<PlayerId, RoomId>>,
): Record<PlayerId, Sighting> {
  const byRoom = new Map<RoomId, PlayerId[]>();
  for (const [player, room] of Object.entries(positions)) {
    const list = byRoom.get(room) ?? [];
    list.push(player);
    byRoom.set(room, list);
  }

  const out: Record<PlayerId, Sighting> = {};
  for (const [player, room] of Object.entries(positions)) {
    const others = (byRoom.get(room) ?? []).filter((p) => p !== player);
    const lit = isLit(state, room);
    const named = lit || seesNamesInDark(state, player) ? [...others].sort() : [];
    out[player] = { room, named, others: others.length, lit };
  }
  return out;
}
