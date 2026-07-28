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
    switch (use.kind) {
      case 'lantern': {
        spendItem(state, use.spender, use.kind);
        // Plural: a second Lantern relights a second room, it does not overwrite the first.
        state.lanternRooms.push(use.room);
        events.push({ t: 'lantern', spender: use.spender, room: use.room });
        break;
      }

      case 'keyhole': {
        const record = state.history.find((h) => h.night === use.night);
        // A night that never happened is a caller bug, not a truthful "nobody was there" —
        // that would let a lie about an unreachable night stand unchallenged.
        if (!record) throw new Error(`no record of night ${use.night}`);
        spendItem(state, use.spender, use.kind);
        const occupants = Object.keys(record.midnightPositions)
          .filter((p) => record.midnightPositions[p] === use.room).sort();
        events.push({
          t: 'keyhole', spender: use.spender, room: use.room, night: use.night, occupants,
        });
        break;
      }

      case 'bell': {
        spendItem(state, use.spender, use.kind);
        // Plural: two Bells watch two children independently.
        state.bellWatches.push({ spender: use.spender, target: use.target });
        // Casting a Bell is public — the named child learns tonight they are watched.
        events.push({ t: 'bellCast', spender: use.spender, target: use.target });
        break;
      }
    }
  }

  return events;
}

/** Each watched child's midnight room, announced publicly. */
export function resolveBellWatch(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
): PublicEvent[] {
  const events: PublicEvent[] = [];
  for (const { spender, target } of state.bellWatches) {
    const room = midnight[target];
    // A watched child always has a midnight room; a missing one is a caller bug, not silence.
    if (!room) throw new Error(`no midnight position for ${target}`);
    events.push({ t: 'bell', spender, target, room });
  }
  return events;
}

export function clearNightlyItemEffects(state: GameState): void {
  state.lanternRooms = [];
  state.bellWatches = [];
}
