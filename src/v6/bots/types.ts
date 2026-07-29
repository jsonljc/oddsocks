import type { Rng } from '../../rules/rng.js';
import type { GameConfig } from '../rules/config.js';
import type { MorningAction, NightAction } from '../rules/night.js';
import type { HouseEvent } from '../rules/state.js';
import type { Held, PlayerId, RoomId } from '../rules/types.js';

/** What one player saw last night. In the dark you count; in the light you read names. */
export interface Sighting {
  readonly night: number;
  readonly room: RoomId;
  readonly lit: boolean;
  /** Always accurate — you can hear the others breathing. */
  readonly others: number;
  /** Only in a lit room. */
  readonly named: readonly PlayerId[];
  readonly socksHere: number;
  readonly lanternsHere: number;
}

/**
 * Everything a player legitimately knows. Note what is absent: anyone else's
 * position, anything lying on a dark floor they are not standing on, and — for
 * a child — who Odd Socks is.
 */
export interface Knowledge {
  readonly me: PlayerId;
  readonly isVillain: boolean;
  readonly night: number;
  readonly position: RoomId;
  readonly held: Held;
  readonly alive: readonly PlayerId[];
  readonly cleared: readonly PlayerId[];
  /** Every morning report, oldest first. The house never lies. */
  readonly publicEvents: readonly HouseEvent[];
  readonly mySightings: readonly Sighting[];
  /** Public: the schedule everyone can see. */
  readonly wax: Readonly<Record<RoomId, number>>;
  /** Public: a burning lantern lights its room, and a lit room publishes. */
  readonly burningAt: Readonly<Record<RoomId, number>>;
  /** Set when a Naming stands and the Named must walk in the open tonight. */
  readonly namedTonight: PlayerId | null;
  readonly config: GameConfig;
}

export interface Bot {
  morning(k: Knowledge, rng: Rng): MorningAction;
  night(k: Knowledge, rng: Rng): NightAction;
}

export const STAY: MorningAction = { name: null };
