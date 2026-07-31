import type { DoorId, RoomId } from './house';

export type ActorId = string;
export type LanternId = string;
export type SockId = string;

/** v12.2 §2's flame list. `crowd` is named here but **not implemented anywhere in
 *  slices 0–1** — v12.2 §14 is parked as a known defect (the economy pass measured
 *  it as a villain ability). The log needs the reason so a hand-authored fixture can
 *  express it; no code may burn a flame for crowding. */
export type FlameReason = 'take' | 'snuff' | 'wrong-call' | 'crowd';
export type SoundKind = 'take' | 'snuff' | 'slip' | 'shed';

interface Base { tick: number; night: number }

export type MatchEvent =
  | (Base & { kind: 'move.enter'; actor: ActorId; room: RoomId; via: DoorId })
  // `room` added in Task 11: without it, audibleVolume (src/audio/sounds.ts)
  // has no room to compare against a listener's, and a version of
  // audibleVolume that special-cased "no room -> full volume" made every
  // door creak in the house audible at full strength everywhere, regardless
  // of distance — found while wiring the night scene, fixed by making the
  // event self-describing the same way the lantern events already are.
  | (Base & { kind: 'door.toggle'; actor: ActorId; door: DoorId; open: boolean; room: RoomId })
  | (Base & { kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight';
              actor: ActorId; lantern: LanternId; room: RoomId; watching?: DoorId })
  | (Base & { kind: 'take.warn' | 'take.complete'; actor: ActorId; victim: ActorId; room: RoomId })
  | (Base & { kind: 'sock.spawn'; sock: SockId; room: RoomId; source: 'take' | 'snuff' | 'shed' })
  | (Base & { kind: 'sock.pickup' | 'sock.drop' | 'sock.secure';
              actor: ActorId; sock: SockId; room: RoomId })
  | (Base & { kind: 'flame.out'; reason: FlameReason; remaining: number })
  | (Base & { kind: 'sound'; floor: number; sound: SoundKind; room: RoomId })
  // rules §9 — "footsteps and movement remain perceptible" in deep darkness.
  // This is the channel that keeps a dark house navigable and populated, and
  // it is the only way one player learns another exists through a wall.
  | (Base & { kind: 'step'; actor: ActorId; room: RoomId; floor: number; hurried: boolean });

export interface EventSink { emit(e: MatchEvent): void; drain(): MatchEvent[] }

export function makeSink(): EventSink {
  let buffer: MatchEvent[] = [];
  return {
    emit(e) { buffer.push(e); },
    drain() { const out = buffer; buffer = []; return out; },
  };
}
