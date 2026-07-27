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
  /** Which bedrooms are still burning — public, everyone sees the house. */
  lit: Record<RoomId, boolean>;
  /** Every event the house has announced, all nights, oldest first. */
  publicEvents: PublicEvent[];
  /** This player's own sightings, oldest first. */
  mySightings: Sighting[];
  /** Mandatory claims per night, oldest first. `null` means the Hush exempted them. */
  claims: Record<PlayerId, RoomId | null>[];
  activeCall: PostedCall | null;
  config: GameConfig;
}

export interface Bot {
  dusk(k: Knowledge, rng: Rng): DuskAction;
  midnight(k: Knowledge, rng: Rng): MidnightAction;
  morning(k: Knowledge, rng: Rng): MorningAction;
}
