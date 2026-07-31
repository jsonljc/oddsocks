import type { MatchEvent } from '../core/events';
import { exitsOf, otherSide, type House, type RoomId } from '../core/house';

export type SoundCue = { file: string; volume: number };

/** rules §20 — players must learn to distinguish these by ear. Placeholder
 *  files for slice 0; the sound language itself is slice 4. The placeholders
 *  are real, generated WAVs at v12/public/sfx/ (distinct pitch/duration per
 *  cue) — not silence, and not missing: without them every cue is a silent
 *  no-op via playCue's swallowed rejection below, and slice 0's audio-facing
 *  acceptance criteria (a dark house should still SOUND occupied; a Take
 *  should be audible) would be unverifiable with no error anywhere to say why. */
export const SOUND_FILES = [
  'step.wav', 'door.wav', 'lantern-set.wav', 'lantern-out.wav',
  'lantern-lit.wav', 'breath.wav', 'take.wav', 'muffled.wav',
] as const;

export function soundFor(e: MatchEvent): SoundCue | null {
  switch (e.kind) {
    case 'step':            return { file: 'step.wav', volume: e.hurried ? 0.5 : 0.3 };
    case 'move.enter':      return { file: 'door.wav', volume: 0.5 };
    case 'door.toggle':     return { file: 'door.wav', volume: 0.4 };
    case 'lantern.carry':   return { file: 'lantern-set.wav', volume: 0.3 };
    case 'lantern.place':   return { file: 'lantern-set.wav', volume: 0.6 };
    case 'lantern.snuff':   return { file: 'lantern-out.wav', volume: 0.8 };
    case 'lantern.relight': return { file: 'lantern-lit.wav', volume: 0.6 };
    case 'take.warn':       return { file: 'breath.wav', volume: 0.9 };
    case 'take.complete':   return { file: 'take.wav', volume: 1.0 };
    case 'sound':           return { file: 'muffled.wav', volume: 0.7 };
    // sock.*/flame.out: no code emits these yet (sock and flame mechanics are
    // later slices; v12.2 §14's crowd flame is parked). Silent rather than
    // thrown, since a future slice will reach this switch with a real one.
    default:                return null;
  }
}

/** How loud an event is to a listener standing in `listenerRoom`.
 *
 *  This is the whole cross-room perception model for slice 0, and it is what
 *  makes the dark house feel occupied rather than empty. rules §4 keeps
 *  footsteps perceptible in deep darkness; §7 makes a Take's noise audible on
 *  its floor. Sight stops at the room boundary, so hearing is the only
 *  channel that crosses one. */
export function audibleVolume(
  e: MatchEvent, listenerRoom: RoomId, house: House,
): number {
  const room = 'room' in e ? e.room : null;
  // Every event kind soundFor actually maps to a cue carries a `room` field
  // as of this task (door.toggle gained one — see core/events.ts and
  // core/sim.ts's toggleDoor — specifically because this fallback used to
  // apply to it, making every door creak in the house audible at full
  // strength regardless of distance). flame.out is the one remaining
  // roomless kind, and soundFor maps it to null, so this branch is
  // unreachable via the real soundFor -> playCue pipeline today. Kept as
  // insurance for a future mapped kind that doesn't carry a room, and
  // pinned directly by a test rather than left to silently rot.
  if (!room) return 1;
  if (room === listenerRoom) return 1;

  // exitsOf/otherSide don't distinguish a stair (kind: 'stair') from an
  // ordinary doorway, so an open stairwell carries sound the same as any
  // other adjacent room. Deliberate, not an oversight: nothing in
  // rules-v12.2 makes a stairwell soundproof, and §7's "heard on that floor"
  // is itself a floor-WIDE claim (satisfied by the same-floor branch below),
  // not a stairs-are-different one. test/sounds.test.ts pins this directly —
  // without that test, "does not carry between floors" could pass while
  // sound leaked through every stair in the house, because the shipped
  // sample never happened to test a stair-adjacent pair.
  const adjacent = exitsOf(house, listenerRoom)
    .some(d => otherSide(d, listenerRoom) === room);
  if (adjacent) return 0.45;

  // rules §7 — a Take's muffled noise is heard "on that floor", generalised
  // here to every event kind: same floor but not directly adjacent still
  // carries, faintly; a different floor with no connecting door is silent.
  const here = house.rooms.find(r => r.id === listenerRoom);
  const there = house.rooms.find(r => r.id === room);
  if (here && there && here.floor === there.floor) return 0.15;
  return 0;
}

/** Untested past this line: `Audio` is a browser global with no Node
 *  equivalent (same category as render/stage.ts's createStage and
 *  app/input.ts's createInput — the DOM/browser-touching half of a module
 *  whose pure half is tested above). Verified instead by running the scene
 *  and listening/reading the network panel for 200s against v12/public/sfx/. */
export function playCue(cue: SoundCue, attenuation = 1): void {
  const volume = cue.volume * attenuation;
  if (volume <= 0.01) return;
  const a = new Audio(`/sfx/${cue.file}`);
  a.volume = Math.min(volume, 1);
  void a.play().catch(() => { /* autoplay policy; ignored until first input */ });
}
