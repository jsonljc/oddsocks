import type { GameConfig } from '../rules/config.js';
import type { Rng } from '../rules/rng.js';
import type { ItemKind, PlayerId, RoomId } from '../rules/types.js';
import type { PostedCall, PublicEvent, Sighting } from '../rules/state.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';

/**
 * Everything one player legitimately knows. Note what is absent: whether they
 * have been marked (§5 — nobody is told), and anyone else's position, holdings
 * or sightings beyond what the house announced.
 */
export interface Knowledge {
  me: PlayerId;
  isVillain: boolean;
  night: number;
  position: RoomId;
  held: ItemKind[];
  /**
   * Which bedrooms are still burning — public, everyone sees the house. This is
   * the raw map: a bedroom relit by a Lantern still reads `false` here, exactly
   * as it does in `GameState`. Use `isLitFor` rather than indexing it directly.
   */
  lit: Record<RoomId, boolean>;
  /** Bedrooms a Lantern is relighting tonight. Spending one is announced, so
   *  this is public — and without it `lit` alone understates what is lit. */
  lanternRooms: RoomId[];
  /** Every event the house has announced, all nights, oldest first. */
  publicEvents: PublicEvent[];
  /** This player's own sightings, oldest first. */
  mySightings: Sighting[];
  /** Mandatory claims per night, oldest first. `null` means the Hush exempted them. */
  claims: Record<PlayerId, RoomId | null>[];
  activeCall: PostedCall | null;
  config: GameConfig;
}

/**
 * Whether a room is lit, from a player's own knowledge. Mirrors the engine's
 * `isLit`: common rooms never go dark, and a Lantern relights one bedroom for
 * one night. A bot that reads `k.lit[room]` on its own silently disagrees with
 * the engine about every lantern-lit bedroom — which is where a Call may
 * legally be posted and where a theft may land.
 */
export const isLitFor = (k: Knowledge, room: RoomId): boolean =>
  k.config.house.rooms[room]?.kind !== 'bedroom' ||
  k.lanternRooms.includes(room) ||
  k.lit[room] === true;

export interface Bot {
  dusk(k: Knowledge, rng: Rng): DuskAction;
  midnight(k: Knowledge, rng: Rng): MidnightAction;
  morning(k: Knowledge, rng: Rng): MorningAction;
}
