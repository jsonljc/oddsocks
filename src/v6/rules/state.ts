import type { Rng } from '../../rules/rng.js';
import type { GameConfig } from './config.js';
import { landingOf } from './house.js';
import type { Held, Outcome, PlayerId, RoomId } from './types.js';

/** What the house says each morning. The house never lies and never names Odd Socks. */
export type HouseEvent =
  /** A lit room and everyone who ended the night in it. Mab is never listed. */
  | { readonly t: 'roster'; readonly room: RoomId; readonly who: readonly PlayerId[] }
  | { readonly t: 'wax'; readonly room: RoomId; readonly left: number }
  | { readonly t: 'dark'; readonly room: RoomId }
  | { readonly t: 'taken'; readonly player: PlayerId }
  | { readonly t: 'lanternLit'; readonly room: RoomId }
  /** A spoke that turned arrivals away. A report about a failed entry, not its occupants. */
  | { readonly t: 'crowded'; readonly room: RoomId }
  | { readonly t: 'naming'; readonly accuser: PlayerId; readonly target: PlayerId }
  | { readonly t: 'namingFailed'; readonly target: PlayerId; readonly cleared: boolean }
  | { readonly t: 'walksOpen'; readonly player: PlayerId; readonly to: RoomId };

export interface NightRecord {
  readonly night: number;
  readonly positions: Readonly<Record<PlayerId, RoomId>>;
  readonly events: readonly HouseEvent[];
  readonly lit: readonly RoomId[];
  readonly shedAt: RoomId | null;
  readonly took: PlayerId | null;
  /**
   * What each living player saw, captured the moment lighting had settled and
   * Odd Socks had shed — before anyone lifted anything. Recording it after
   * take-ups instead makes the one child who lifted a sock see a bare floor,
   * which destroys exactly the inference the design is built on.
   */
  readonly sightings: Readonly<Record<PlayerId, {
    readonly room: RoomId; readonly lit: boolean; readonly others: number;
    readonly named: readonly PlayerId[]; readonly socksHere: number;
    readonly lanternsHere: number;
  }>>;
  /** Diagnostics — is the children's route physically happening at all? */
  readonly litSpokeReads: number;
  readonly socksLifted: number;
  readonly pairsFormed: number;
}

export interface GameState {
  readonly config: GameConfig;
  readonly villain: PlayerId;
  night: number;
  positions: Record<PlayerId, RoomId>;
  wax: Record<RoomId, number>;
  /** On the floor and burning. */
  lanternsAt: Record<RoomId, number>;
  /** On the floor and out — a failed Corner puts every burning one here. */
  snuffedAt: Record<RoomId, number>;
  socksAt: Record<RoomId, number>;
  held: Record<PlayerId, Held>;
  taken: PlayerId[];
  /** Named wrongly, and therefore cleared for good. */
  cleared: PlayerId[];
  /** Standing this night: the Named walks in the open. */
  naming: { readonly accuser: PlayerId; readonly target: PlayerId } | null;
  over: Outcome | null;
  history: NightRecord[];
}

export function createGame(config: GameConfig, rng: Rng): GameState {
  const villain = rng.pick(config.roster);
  const wax: Record<RoomId, number> = {};
  config.house.landings.forEach((l, i) => {
    wax[l] = config.startingWax[i] ?? config.startingWax[config.startingWax.length - 1] ?? 1;
  });

  const lanternsAt: Record<RoomId, number> = {};
  // Lanterns begin on the landings: public, symmetric, and reachable by
  // everybody on night one.
  for (let i = 0; i < config.lanterns; i++) {
    const l = config.house.landings[i % config.house.landings.length]!;
    lanternsAt[l] = (lanternsAt[l] ?? 0) + 1;
  }

  return {
    config,
    villain,
    night: 0,
    positions: Object.fromEntries(config.roster.map((p) => [p, config.house.start])),
    wax,
    lanternsAt,
    snuffedAt: {},
    socksAt: {},
    held: Object.fromEntries(config.roster.map((p) => [p, null as Held])),
    taken: [],
    cleared: [],
    naming: null,
    over: null,
    history: [],
  };
}

export const alive = (s: GameState): readonly PlayerId[] =>
  s.config.roster.filter((p) => !s.taken.includes(p));

export const children = (s: GameState): readonly PlayerId[] =>
  alive(s).filter((p) => p !== s.villain);

export const occupants = (s: GameState, room: RoomId): readonly PlayerId[] =>
  alive(s).filter((p) => s.positions[p] === room);

/**
 * A landing burns while its candle has wax; any room is lit while a lantern
 * lies burning in it. A carried lantern lights nothing — which is what makes a
 * stolen one worth stealing.
 */
export function isLit(s: GameState, room: RoomId): boolean {
  if ((s.lanternsAt[room] ?? 0) > 0) return true;
  return s.config.house.rooms[room]?.kind === 'landing' && (s.wax[room] ?? 0) > 0;
}

export const litRooms = (s: GameState): readonly RoomId[] =>
  Object.keys(s.config.house.rooms).filter((r) => isLit(s, r));

/**
 * Every candle out. Lanterns deliberately do NOT stay this off.
 *
 * If a burning lantern held the darkness win at bay, the children would win by
 * touching nothing: a dropped lantern lights its room forever, carry capacity
 * is one, so Odd Socks could never gather every lantern into their hands and
 * the route would be unreachable. Measured, on the design this replaced:
 * a table that simply never picked a lantern up won 100% of 288,000 games with
 * zero takes. Lanterns read dark floors. They do not stay the clock.
 */
export const houseIsDark = (s: GameState): boolean =>
  s.config.house.landings.every((l) => (s.wax[l] ?? 0) <= 0);

/** The landing a sock in this room implicates, for the nights either side of it. */
export const implicates = (s: GameState, room: RoomId): RoomId =>
  landingOf(s.config.house, room);
