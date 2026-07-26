import type { PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import type { GameState } from './state.js';
import { spendItem } from './items.js';

export type ItemUse =
  | { kind: 'lantern'; spender: PlayerId; room: RoomId }
  | { kind: 'keyhole'; spender: PlayerId; room: RoomId; night: number }
  | { kind: 'bell'; spender: PlayerId; target: PlayerId };

/** Spent in the morning; shapes the night that follows. */
export function applyItemUses(state: GameState, uses: readonly ItemUse[]): PublicEvent[] {
  const events: PublicEvent[] = [];

  for (const use of uses) {
    spendItem(state, use.spender, use.kind);

    switch (use.kind) {
      case 'lantern':
        state.lanternRoom = use.room;
        events.push({ t: 'lantern', spender: use.spender, room: use.room });
        break;

      case 'keyhole': {
        const record = state.history.find((h) => h.night === use.night);
        const occupants = record
          ? Object.keys(record.midnightPositions)
              .filter((p) => record.midnightPositions[p] === use.room).sort()
          : [];
        events.push({
          t: 'keyhole', spender: use.spender, room: use.room, night: use.night, occupants,
        });
        break;
      }

      case 'bell':
        state.bellWatch = use.target;
        break;
    }
  }

  return events;
}

/** The watched child's midnight room, announced publicly. */
export function resolveBellWatch(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
): PublicEvent[] {
  const target = state.bellWatch;
  if (!target) return [];
  const room = midnight[target];
  if (!room) return [];
  return [{ t: 'bell', spender: target, target, room }];
}

export function clearNightlyItemEffects(state: GameState): void {
  state.lanternRoom = null;
  state.bellWatch = null;
}
