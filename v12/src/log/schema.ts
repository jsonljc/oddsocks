import type { ActorId, MatchEvent, SockId } from '../core/events';
import type { RoomId } from '../core/house';

export interface MatchLog { seed: number; house: string; events: MatchEvent[] }

export type ClaimId = string;

/** v12.2 §8 — one mark per living player per morning, permanent and public for
 *  the rest of the game. Five kinds, not four: `deny` is new in v12.1, and §15
 *  gives the reason — the board "had four ways to make a claim and no way to say
 *  'that's not true,' so it couldn't actually hold an argument."
 *
 *  Every claim carries an `id` because `deny` has to point at one. */
interface ClaimBase { id: ClaimId; night: number; by: ActorId }

export type Claim =
  | (ClaimBase & { kind: 'player-room';   subject: ActorId; room: RoomId })
  | (ClaimBase & { kind: 'player-player'; subject: ActorId; object: ActorId })
  | (ClaimBase & { kind: 'player-sock';   subject: ActorId; sock: SockId })
  | (ClaimBase & { kind: 'room-incident'; room: RoomId; incident: string })
  | (ClaimBase & { kind: 'deny';          denies: ClaimId });
