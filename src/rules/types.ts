export type PlayerId = string;
export type RoomId = string;

export type OddityId = 'bell' | 'pike' | 'clem' | 'wren' | 'sparrow' | 'moss';
export type ItemKind = 'lantern' | 'keyhole' | 'bell';
export type Phase = 'dusk' | 'midnight';

/** The two rooms stepped into during one phase. The second is where you end. */
export type Path = readonly [RoomId, RoomId];

export interface Room {
  readonly id: RoomId;
  readonly kind: 'bedroom' | 'common';
  readonly floor: 0 | 1;
  /** Present on bedrooms only. */
  readonly owner?: PlayerId;
  readonly doors: readonly RoomId[];
}

export interface House {
  readonly id: string;
  readonly rooms: Readonly<Record<RoomId, Room>>;
}
