import type { OddityId, PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import { type GameState, canClaim } from './state.js';
import { doorsOf, floorOf } from './map.js';
import { crossedFloors } from './movement.js';

/** Only these are announced by the house, so only these are safe solver constraints. */
export const PUBLIC_ODDITIES: readonly OddityId[] = ['bell', 'pike', 'clem'];

export interface OddityContext {
  startPositions: Record<PlayerId, RoomId>;
  duskPositions: Record<PlayerId, RoomId>;
  midnightPositions: Record<PlayerId, RoomId>;
  duskSteps: Record<PlayerId, [RoomId, RoomId]>;
  midnightSteps: Record<PlayerId, [RoomId, RoomId]>;
  theftRoom: RoomId | null;
  thiefDuskRoom: RoomId | null;
}

const say = (source: PlayerId, detail: string, payload: Record<string, unknown>): PublicEvent =>
  ({ t: 'oddity', source, detail, payload });

export function resolveOddities(state: GameState, ctx: OddityContext): PublicEvent[] {
  if (!state.config.layers.oddities) return [];
  const house = state.config.house;
  const events: PublicEvent[] = [];

  // R18: the three public oddities are the child speaking, not the house. Bell
  // counts, Pike counts stairs, Clem watches hands — each is a thing that child
  // perceived and then says out loud, which is exactly what the Hush takes away
  // (R17). Task 17 already enforced that for `reported`; the same rule has to
  // hold here or a snuffed child keeps testifying through their oddity.
  // Wren's attic tell and Sparrow's floor are untouched: the first is a thing
  // others notice *about* Wren, the second is private and never public evidence.
  const speaks = (p: PlayerId): boolean => canClaim(state, p);

  // Bell, who never sleeps first — counts, never names.
  const bellRoom = ctx.midnightPositions['bell'];
  if (bellRoom && speaks('bell')) {
    const beside = new Set(doorsOf(house, bellRoom));
    const count = Object.keys(ctx.midnightPositions)
      .filter((p) => p !== 'bell' && beside.has(ctx.midnightPositions[p]!)).length;
    events.push(say('bell', 'adjacentCount', { count }));
  }

  // Pike, who counts stairs.
  if (('pike' in ctx.midnightPositions || Object.keys(ctx.duskSteps).length > 0) && speaks('pike')) {
    const crossed = Object.keys(ctx.startPositions).some((p) =>
      crossedFloors(house, ctx.startPositions[p]!, [
        ...(ctx.duskSteps[p] ?? []), ...(ctx.midnightSteps[p] ?? []),
      ]));
    events.push(say('pike', 'floorCrossing', { crossed }));
  }

  // Clem, who watches hands.
  const clemRoom = ctx.midnightPositions['clem'];
  if (clemRoom && speaks('clem')) {
    const count = Object.keys(ctx.midnightPositions)
      .filter((p) => p !== 'clem' && ctx.midnightPositions[p] === clemRoom)
      .filter((p) => state.held[p]!.length > 0).length;
    events.push(say('clem', 'itemHolders', { count }));
  }

  // Wren, afraid of the attic — the public half of a private oddity.
  if (ctx.duskPositions['wren'] === 'attic' || ctx.midnightPositions['wren'] === 'attic') {
    events.push(say('wren', 'atticTell', { attic: true }));
  }

  // Sparrow, who listens at doors.
  if (ctx.theftRoom) {
    const room = state.config.sparrowMode === 'dusk'
      ? (ctx.thiefDuskRoom ?? ctx.theftRoom)
      : ctx.theftRoom; // v10.0 as written: the robbed room's own floor, i.e. no information
    events.push(say('sparrow', 'thiefFloor', { floor: floorOf(house, room) }));
  }

  return events;
}
