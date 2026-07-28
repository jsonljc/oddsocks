import type { Rng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import { type GameState, isLit } from './state.js';

/**
 * The villain's second verb. Blind like the theft: they commit on entering and
 * find out afterwards. Nobody is told, ever — the child discovers it when they
 * try to join a Call and cannot.
 */
export function resolveMarking(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  rng: Rng,
): { marked: PlayerId | null } {
  if (!state.config.layers.marking) return { marked: null };

  const room = midnight[state.villain];
  if (!room || isLit(state, room)) return { marked: null };

  const eligible = Object.keys(midnight)
    .filter((p) => midnight[p] === room && p !== state.villain && !state.marked[p])
    .sort();
  if (eligible.length === 0) return { marked: null };

  const target = rng.pick(eligible);
  state.marked[target] = true;
  return { marked: target };
}
