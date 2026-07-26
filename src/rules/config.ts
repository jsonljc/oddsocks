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
  readonly items: boolean;
  readonly oddities: boolean;
  readonly marking: boolean;
}

export interface GameConfig {
  readonly house: House;
  readonly roster: readonly PlayerId[];

  readonly lightsRequired: number;
  readonly activeNights: number;
  readonly totalNights: number;

  readonly hushMode: HushMode;
  readonly selfSnuffCostsNight: boolean;
  readonly sparrowMode: SparrowMode;

  /** Trail names one child within this many hops of the robbed bedroom. */
  readonly trailRadius: number;

  readonly itemCounts: Readonly<Record<ItemKind, number>>;
  readonly itemsOnMap: number;
  readonly itemRespawnDelay: number;
  readonly carryCapacity: number;
  readonly mossCarryCapacity: number;

  readonly callHandsRequired: number;
  readonly maxCallsPerNight: number;

  readonly layers: Readonly<LayerFlags>;
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
  carryCapacity: 1,
  mossCarryCapacity: 2,

  callHandsRequired: 2,
  maxCallsPerNight: 1,

  layers: { items: true, oddities: true, marking: true },
};

export function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
