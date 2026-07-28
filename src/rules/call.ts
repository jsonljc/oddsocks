import type { Rng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import type { PostedCall, PublicEvent } from './state.js';
import { type GameState, isLit } from './state.js';
import { isBedroom } from './map.js';
import { spendItem } from './items.js';

/** Traps only work in lit bedrooms — the set that shrinks every night. */
export function canPostCall(state: GameState, _target: PlayerId, room: RoomId): boolean {
  return isBedroom(state.config.house, room) && isLit(state, room);
}

export function postCall(state: GameState, call: PostedCall): PublicEvent[] {
  state.activeCall = call;
  return [{ t: 'callPosted', caller: call.caller, target: call.target, room: call.room }];
}

/** A hand needs an item to spend, and marking is exactly what takes that away. */
export function canJoinCall(state: GameState, player: PlayerId): boolean {
  return state.held[player]!.length > 0 && !state.marked[player];
}

export function resolveCall(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  joiners: readonly PlayerId[],
  rng: Rng,
): { caught: boolean; events: PublicEvent[] } {
  const call = state.activeCall;
  if (!call) return { caught: false, events: [] };

  const hands = joiners
    .filter((p) => midnight[p] === call.room)
    .filter((p) => canJoinCall(state, p))
    .sort();

  // Miscoordination is free: nothing forms, nothing is spent.
  if (hands.length < state.config.callHandsRequired) {
    return {
      caught: false,
      events: [{
        t: 'callResolved', target: call.target, room: call.room,
        hands: hands.length, outcome: 'fizzled',
      }],
    };
  }

  for (const hand of hands) spendItem(state, hand, rng.pick(state.held[hand]!));

  const arrived = midnight[call.target] === call.room;
  const caught = arrived && call.target === state.villain;
  const outcome = caught ? 'caught' : arrived ? 'cleared' : 'noShow';

  const events: PublicEvent[] = [{
    t: 'callResolved', target: call.target, room: call.room, hands: hands.length, outcome,
  }];

  // A self-nomination the target does not honour costs them their credibility.
  if (!arrived && call.selfNominated) {
    state.eyesOpen[call.target] = true;
    events.push({ t: 'eyesOpen', player: call.target, reason: 'self-nominated and did not come' });
  }

  if (caught) state.over = { winner: 'children', how: 'caught' };
  return { caught, events };
}
