import type { House, Path, PlayerId, RoomId } from './types.js';
import { floorOf, isLegalPath } from './map.js';

export interface MoveResult {
  positions: Record<PlayerId, RoomId>;
  steps: Record<PlayerId, [RoomId, RoomId]>;
}

export function resolveMovement(
  house: House,
  from: Readonly<Record<PlayerId, RoomId>>,
  paths: Readonly<Record<PlayerId, Path>>,
): MoveResult {
  const positions: Record<PlayerId, RoomId> = {};
  const steps: Record<PlayerId, [RoomId, RoomId]> = {};

  for (const player of Object.keys(paths)) {
    if (!(player in from)) {
      throw new Error(`path submitted for a player not in this phase: ${player}`);
    }
  }

  for (const player of Object.keys(from)) {
    const start = from[player]!;
    const path = paths[player];
    if (!path) throw new Error(`no path submitted for ${player}`);
    if (!isLegalPath(house, start, path)) {
      throw new Error(`illegal path for ${player}: ${start} -> ${path[0]} -> ${path[1]}`);
    }
    positions[player] = path[1];
    steps[player] = [path[0], path[1]];
  }

  return { positions, steps };
}

/** True if any step of the walk passed through a staircase. */
export function crossedFloors(house: House, from: RoomId, steps: readonly RoomId[]): boolean {
  let prev = from;
  for (const room of steps) {
    if (floorOf(house, prev) !== floorOf(house, room)) return true;
    prev = room;
  }
  return false;
}
