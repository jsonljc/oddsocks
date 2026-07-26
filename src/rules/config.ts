import type { House, ItemKind, OddityId, PlayerId } from './types.js';
import { HOLLOW_HOUSE } from './houses/hollow.js';

export const ROSTER = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'] as const;

/** In build one each child's oddity shares their name. */
export const ODDITY_OF: Readonly<Record<PlayerId, OddityId>> = Object.fromEntries(
  ROSTER.map((p) => [p, p as OddityId]),
);

/** How the Hush restricts a snuffed child's mandatory claim. */
export type HushMode = 'silent' | 'oneNight' | 'none';

/** Whether Sparrow's oddity is the null version from v10.0 or the patched one. */
export type SparrowMode = 'asWritten' | 'dusk';

/** Which rungs of the build are switched on. */
export interface LayerFlags {
  items: boolean;
  oddities: boolean;
  marking: boolean;
}

export interface GameConfig {
  house: House;
  roster: readonly PlayerId[];

  lightsRequired: number;
  activeNights: number;
  totalNights: number;

  hushMode: HushMode;
  selfSnuffCostsNight: boolean;
  sparrowMode: SparrowMode;

  /** Trail names one child within this many hops of the robbed bedroom. */
  trailRadius: number;

  itemCounts: Record<ItemKind, number>;
  itemsOnMap: number;
  itemRespawnDelay: number;
  itemsCanBeDropped: boolean;
  carryCapacity: number;
  mossCarryCapacity: number;

  callHandsRequired: number;
  maxCallsPerNight: number;

  layers: LayerFlags;
}

export const DEFAULT_CONFIG: GameConfig = {
  house: HOLLOW_HOUSE,
  roster: ROSTER,

  lightsRequired: 5,
  activeNights: 6,
  totalNights: 7,

  hushMode: 'silent',
  selfSnuffCostsNight: true,
  sparrowMode: 'dusk',

  trailRadius: 1,

  itemCounts: { lantern: 2, keyhole: 2, bell: 1 },
  itemsOnMap: 3,
  itemRespawnDelay: 2,
  itemsCanBeDropped: false,
  carryCapacity: 1,
  mossCarryCapacity: 2,

  callHandsRequired: 2,
  maxCallsPerNight: 1,

  layers: { items: true, oddities: true, marking: true },
};

export function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
