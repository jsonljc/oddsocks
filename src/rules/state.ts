import type { GameConfig } from './config.js';
import type { Rng } from './rng.js';
import type { ItemKind, PlayerId, RoomId } from './types.js';
import { bedroomOf, isBedroom } from './map.js';

export interface PostedCall {
  caller: PlayerId;
  target: PlayerId;
  room: RoomId;
  selfNominated: boolean;
}

export interface Sighting {
  room: RoomId;
  /** Names, when the room was lit (or the viewer sees in the dark). */
  named: PlayerId[];
  /** How many others shared the room, always accurate. */
  others: number;
  lit: boolean;
}

export type PublicEvent =
  | { t: 'theft'; room: RoomId; victim: PlayerId }
  | { t: 'selfSnuff'; room: RoomId }
  | { t: 'trail'; player: PlayerId; room: RoomId }
  | { t: 'itemTaken'; player: PlayerId; item: ItemKind; room: RoomId }
  | { t: 'itemSpawned'; item: ItemKind; room: RoomId }
  | { t: 'grip'; player: PlayerId; item: ItemKind }
  | { t: 'oddity'; source: PlayerId; detail: string; payload: unknown }
  | { t: 'callPosted'; caller: PlayerId; target: PlayerId; room: RoomId }
  | { t: 'callResolved'; target: PlayerId; room: RoomId; hands: number;
      outcome: 'caught' | 'cleared' | 'noShow' | 'fizzled' }
  | { t: 'keyhole'; spender: PlayerId; room: RoomId; night: number; occupants: PlayerId[] }
  | { t: 'bell'; spender: PlayerId; target: PlayerId; room: RoomId }
  | { t: 'bellCast'; spender: PlayerId; target: PlayerId }
  | { t: 'lantern'; spender: PlayerId; room: RoomId }
  | { t: 'eyesOpen'; player: PlayerId; reason: string };

export interface NightRecord {
  night: number;
  duskPositions: Record<PlayerId, RoomId>;
  midnightPositions: Record<PlayerId, RoomId>;
  events: PublicEvent[];
  /** Truth of what each player observed at midnight. */
  sightings: Record<PlayerId, Sighting>;
  /** What each player said in the morning. `null` means the Hush exempted them. */
  claims: Record<PlayerId, RoomId | null>;
}

export interface GameState {
  config: GameConfig;
  night: number;
  villain: PlayerId;

  positions: Record<PlayerId, RoomId>;
  lit: Record<RoomId, boolean>;

  hushedSince: Record<PlayerId, number | null>;
  marked: Record<PlayerId, boolean>;
  eyesOpen: Record<PlayerId, boolean>;

  held: Record<PlayerId, ItemKind[]>;
  loose: Record<RoomId, ItemKind[]>;
  reserve: ItemKind[];
  returning: { item: ItemKind; night: number }[];

  /** Bells spent last morning: each one's target has their midnight room announced tonight. */
  bellWatches: { spender: PlayerId; target: PlayerId }[];
  /** Lanterns spent last morning: these rooms are lit for tonight only. */
  lanternRooms: RoomId[];

  activeCall: PostedCall | null;
  over: null | { winner: 'children' | 'oddsocks'; how: 'caught' | 'survived' | 'lightsOut' };

  history: NightRecord[];
}

export function createGame(config: GameConfig, rng: Rng): GameState {
  const { house, roster } = config;

  const positions: Record<PlayerId, RoomId> = {};
  const hushedSince: Record<PlayerId, number | null> = {};
  const marked: Record<PlayerId, boolean> = {};
  const eyesOpen: Record<PlayerId, boolean> = {};
  const held: Record<PlayerId, ItemKind[]> = {};
  for (const p of roster) {
    positions[p] = bedroomOf(house, p);
    hushedSince[p] = null;
    marked[p] = false;
    eyesOpen[p] = false;
    held[p] = [];
  }

  const lit: Record<RoomId, boolean> = {};
  const loose: Record<RoomId, ItemKind[]> = {};
  for (const id of Object.keys(house.rooms)) {
    lit[id] = true;
    loose[id] = [];
  }

  const reserve: ItemKind[] = [];
  for (const kind of ['lantern', 'keyhole', 'bell'] as ItemKind[]) {
    for (let i = 0; i < config.itemCounts[kind]; i++) reserve.push(kind);
  }

  return {
    config,
    night: 1,
    villain: rng.pick(roster),
    positions,
    lit,
    hushedSince,
    marked,
    eyesOpen,
    held,
    loose,
    reserve: rng.shuffle(reserve),
    returning: [],
    bellWatches: [],
    lanternRooms: [],
    activeCall: null,
    over: null,
    history: [],
  };
}

/** Common rooms can never go dark. A Lantern relights one bedroom for one night. */
export function isLit(state: GameState, room: RoomId): boolean {
  if (!isBedroom(state.config.house, room)) return true;
  if (state.lanternRooms.includes(room)) return true;
  return state.lit[room] === true;
}

/** Lights out that count toward the villain's win — their own never does. */
export function darkBedroomCount(state: GameState): number {
  return state.config.roster
    .filter((p) => p !== state.villain)
    .filter((p) => state.lit[`bed_${p}`] === false).length;
}

export function capacityOf(state: GameState, player: PlayerId): number {
  if (!state.config.layers.oddities) return state.config.carryCapacity;
  return player === 'moss' ? state.config.mossCarryCapacity : state.config.carryCapacity;
}

/** Whether the Hush permits this child to say where they slept tonight. */
export function canClaim(state: GameState, player: PlayerId): boolean {
  const since = state.hushedSince[player];
  if (since === null || since === undefined) return true;
  switch (state.config.hushMode) {
    case 'none': return true;
    case 'oneNight': return state.night !== since;
    case 'silent': return false;
  }
}
