export type PlayerId = string;
export type RoomId = string;

/**
 * Landings are the spine: lit while their candle has wax, unbounded capacity.
 * Spokes are dead ends hung off a landing: permanently unlit unless a lantern
 * is burning there, and they hold two people. That capacity is the rule that
 * stops a trio doing every job in the game at zero risk — see the design's §3.
 */
export type RoomKind = 'landing' | 'spoke';

export interface Room {
  readonly id: RoomId;
  readonly kind: RoomKind;
  readonly floor: number;
  readonly doors: readonly RoomId[];
  /** Arrivals allowed per night. `Infinity` on landings. */
  readonly capacity: number;
}

export interface House {
  readonly id: string;
  readonly rooms: Readonly<Record<RoomId, Room>>;
  /** Ground floor first. These are the only rooms with candles. */
  readonly landings: readonly RoomId[];
  /** The Sitting Room — everyone begins here together. */
  readonly start: RoomId;
}

/**
 * One hand. A pair of socks fills it exactly as a single sock does, which is
 * what lets any character run the evidence route rather than only Otto.
 */
export type Held =
  | null
  | { readonly t: 'lantern' }
  | { readonly t: 'socks'; readonly n: 1 | 2 };

export const isLantern = (h: Held): boolean => h?.t === 'lantern';
export const sockCount = (h: Held): number => (h?.t === 'socks' ? h.n : 0);

export type Outcome =
  | { readonly winner: 'children'; readonly how: 'cornered' }
  | { readonly winner: 'oddsocks'; readonly how: 'taken' | 'dark' };
