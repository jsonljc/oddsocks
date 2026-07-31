import { soundFor, SOUND_FILES, audibleVolume, playCue } from '../src/audio/sounds';
import type { MatchEvent } from '../src/core/events';
import { HOLLOW } from '../src/house/hollow';

// Covers every MatchEvent kind soundFor actually switches on. The brief's
// original list omitted door.toggle, lantern.carry and lantern.relight while
// naming the test "maps every slice-0 event kind to a cue" — extended so the
// name and the check agree. door.toggle's `room` field is new in this task
// (see core/events.ts/sim.ts): the event had no room before, which meant
// audibleVolume could never apply cross-room falloff to a door creak at all.
const SAMPLES: MatchEvent[] = [
  { kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'kitchen', floor: 0, hurried: false },
  { kind: 'move.enter', tick: 1, night: 1, actor: 'bell', room: 'kitchen', via: 'd_hearth_kitchen' },
  { kind: 'door.toggle', tick: 1, night: 1, actor: 'bell', door: 'd_hearth_kitchen', open: false, room: 'kitchen' },
  { kind: 'lantern.carry', tick: 2, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'kitchen' },
  { kind: 'lantern.place', tick: 2, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'kitchen', watching: 'd_hearth_kitchen' },
  { kind: 'lantern.snuff', tick: 3, night: 2, actor: 'wren', lantern: 'lantern_a', room: 'kitchen' },
  { kind: 'lantern.relight', tick: 3, night: 2, actor: 'wren', lantern: 'lantern_a', room: 'kitchen' },
  { kind: 'take.warn', tick: 4, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
  { kind: 'take.complete', tick: 5, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
  { kind: 'sound', tick: 6, night: 2, floor: 1, sound: 'take', room: 'attic' },
];

describe('soundFor', () => {
  // rules §20 — sound carries mechanical information, so every event a player
  // could hear must map to a distinguishable cue
  it('maps every slice-0 event kind to a cue', () => {
    for (const e of SAMPLES) expect(soundFor(e), e.kind).not.toBeNull();
  });

  it('gives the Take and the Snuff distinguishable cues', () => {
    const of = (kind: string) => soundFor(SAMPLES.find(e => e.kind === kind)!)!;
    expect(of('take.complete').file).not.toBe(of('lantern.snuff').file);
  });

  it('references only declared files', () => {
    for (const e of SAMPLES) {
      const cue = soundFor(e);
      if (cue) expect(SOUND_FILES).toContain(cue.file);
    }
  });

  // rules §20 — players must be able to tell hurried movement from careful
  it('makes a hurried footstep louder than a careful one', () => {
    const step = (hurried: boolean): MatchEvent =>
      ({ kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'kitchen', floor: 0, hurried });
    expect(soundFor(step(true))!.volume).toBeGreaterThan(soundFor(step(false))!.volume);
  });

  // Not in slice 0 (no code emits these yet — sock/flame mechanics are later
  // slices; §14's crowd flame is parked). soundFor must not throw on them.
  it('maps sock and flame events to no cue rather than throwing', () => {
    const flameOut: MatchEvent = { kind: 'flame.out', tick: 0, night: 1, reason: 'take', remaining: 4 };
    const sockSpawn: MatchEvent = { kind: 'sock.spawn', tick: 0, night: 1, sock: 's1', room: 'kitchen', source: 'take' };
    expect(soundFor(flameOut)).toBeNull();
    expect(soundFor(sockSpawn)).toBeNull();
  });
});

describe('audibleVolume', () => {
  const step: MatchEvent =
    { kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'kitchen', floor: 0, hurried: false };

  it('is full in the same room', () => {
    expect(audibleVolume(step, 'kitchen', HOLLOW)).toBe(1);
  });

  // This is what makes the dark house feel occupied: sight stops at the room
  // boundary, so hearing is the only channel that crosses one.
  it('carries into an adjacent room, quieter', () => {
    const v = audibleVolume(step, 'hearth', HOLLOW);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('carries faintly across the same floor', () => {
    const near = audibleVolume(step, 'hearth', HOLLOW);
    const far = audibleVolume(step, 'cellar', HOLLOW);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
  });

  // Renamed from the brief's "does not carry between floors": kitchen and
  // attic are on different floors AND joined by no door at all. That second
  // condition is load-bearing and the brief's version didn't name it —
  // exitsOf/otherSide (used below) don't distinguish a doorway from a stair,
  // so "different floor" alone doesn't determine the answer; adjacency
  // (checked first, stairs included) wins whenever it applies. See the next
  // test for the case this one's original name would have missed entirely.
  it('does not carry between floors through an ordinary wall (no connecting door)', () => {
    expect(audibleVolume(step, 'attic', HOLLOW)).toBe(0);
  });

  // A stair is a Door like any other in house.doors (kind: 'stair' vs
  // 'doorway'), and exitsOf/otherSide never look at `kind` — so a stair
  // joins two rooms on DIFFERENT floors exactly the way a doorway joins two
  // on the same one, and sound crosses it at the same 0.45 as any other
  // adjacent room. That's a deliberate reading, not an oversight: nothing in
  // rules-v12.2 makes a stairwell soundproof, and §7's "a muffled noise is
  // heard on that floor" is itself a floor-WIDE claim (satisfied by the
  // same-floor branch below), not a stairs-are-different claim. Pinned
  // explicitly so a future stair special-case, in either direction, is a
  // decision and not a silent regression — this is the exact "test passed
  // for the wrong reason" shape: without this test, the "does not carry
  // between floors" test above could pass while sound leaked through every
  // stair in the house, because it never sampled a stair-adjacent pair.
  it('carries through a stair the same as any other adjacent room', () => {
    const stepInBedroom: MatchEvent =
      { kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'shared_bedroom', floor: 0, hurried: false };
    // s_attic_bedroom joins attic (floor 1) directly to shared_bedroom (floor 0).
    expect(audibleVolume(stepInBedroom, 'attic', HOLLOW)).toBe(0.45);
  });

  // Every event kind soundFor actually maps to a cue carries a `room` field
  // today (door.toggle gained one in this task), so this branch is
  // unreachable via the real soundFor -> playCue pipeline — flame.out is the
  // one remaining roomless kind, and soundFor maps it to null. Kept as
  // insurance for a future mapped kind that doesn't carry a room, and tested
  // directly rather than left to silently rot.
  it('defaults to full volume for a mapped kind that carries no room', () => {
    const flameOut: MatchEvent = { kind: 'flame.out', tick: 9, night: 3, reason: 'take', remaining: 4 };
    expect(audibleVolume(flameOut, 'kitchen', HOLLOW)).toBe(1);
  });
});

// RE-GATED (slice-0/1 final review, item 6) — playCue allocated a fresh,
// never-released `Audio` per cue: roughly 900 objects a night with all six
// actors wandering. Deferred at Task 11 with the stated deadline "fix before
// slice 1"; slice 1 shipped at Task 16, so that deadline had passed.
//
// No jsdom/happy-dom is configured (vitest.config.ts: environment: 'node'),
// so `Audio` is not a real global here — but a plain fake constructor with a
// counter is enough to test allocation behaviour without needing real media
// playback, and IS enough to get a real red/green cycle (see below), so this
// was fixed rather than re-deferred again: carrying a deferral whose gate has
// already passed, with no new attempt at a fix, is the discard this whole
// process exists to prevent.
describe('playCue', () => {
  // playCue's pool (src/audio/sounds.ts) is module-level state, keyed by cue
  // file, that persists for the life of the module — i.e. across every test
  // in this file. A unique fake filename per test (never a real name from
  // SOUND_FILES, and never reused across tests) is what keeps these tests
  // independent of each other and of execution order, without needing to
  // export a test-only reset hook from the production module.
  let uniqueId = 0;
  function uniqueFile(): string { return `test-cue-${uniqueId++}.wav`; }

  function withFakeAudio<T>(fn: (constructions: () => number) => T): T {
    let constructions = 0;
    class FakeAudio {
      volume = 1;
      currentTime = 0;
      paused = true;
      constructor(public readonly src: string) { constructions++; }
      play(): Promise<void> { this.paused = false; return Promise.resolve(); }
    }
    const original = (globalThis as { Audio?: unknown }).Audio;
    (globalThis as { Audio?: unknown }).Audio = FakeAudio;
    try {
      return fn(() => constructions);
    } finally {
      (globalThis as { Audio?: unknown }).Audio = original;
    }
  }

  // The regression: 50 calls for the SAME cue must not allocate 50 Audio
  // objects. Bounded well below 50 rather than pinned to the exact pool size,
  // so a legitimate future retune of the pool's capacity doesn't make this
  // test brittle — the property that matters is "bounded", not "exactly N".
  it('reuses pooled Audio elements instead of allocating one per call', () => {
    const file = uniqueFile();
    withFakeAudio(constructions => {
      for (let i = 0; i < 50; i++) playCue({ file, volume: 0.5 });
      expect(constructions()).toBeLessThan(10);
    });
  });

  // A pool keyed only by file, with no cap on simultaneous plays, would still
  // "reuse" by starting a second cue from tick 0 on an element already
  // mid-playback — cutting the first one off. Two DIFFERENT files must not
  // share an element regardless: this pins that the pool key is the file,
  // not a single global slot.
  it('gives different cue files independent pooled elements', () => {
    const fileA = uniqueFile();
    const fileB = uniqueFile();
    withFakeAudio(constructions => {
      playCue({ file: fileA, volume: 0.5 });
      playCue({ file: fileB, volume: 0.5 });
      expect(constructions()).toBe(2);
    });
  });

  // rules §20's placeholder cues must still be silenceable: a cue attenuated
  // to (near) zero must not even reach the pool/allocate anything, matching
  // the existing `volume <= 0.01` early return.
  it('still skips playback entirely below the audible floor', () => {
    const file = uniqueFile();
    withFakeAudio(constructions => {
      playCue({ file, volume: 0.005 });
      expect(constructions()).toBe(0);
    });
  });
});
