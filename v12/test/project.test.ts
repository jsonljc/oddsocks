import { projectForHouse, type MatchLog } from '../src/log/project';
import type { MatchEvent } from '../src/core/events';

function log(events: MatchEvent[]): MatchLog {
  return { seed: 1, house: 'HOLLOW', events };
}

describe('projectForHouse', () => {
  // v12.2 §8 — "who didn't come back" is the one identity the voice rule
  // grants. (The brief cites this as "§13.1" — that's v12.0's section number
  // for the same rule, from before v12.1 renumbered the whole document down
  // to 17 whole-number sections; see the Task 12 report.)
  it('reports who did not return — the one identity §8 grants', () => {
    const p = projectForHouse(log([
      { kind: 'take.complete', tick: 10, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
    ]), 2);
    expect(p.didNotReturn).toEqual(['pike']);
  });

  it('never carries the taker', () => {
    const p = projectForHouse(log([
      { kind: 'take.complete', tick: 10, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
    ]), 2);
    expect(JSON.stringify(p)).not.toContain('wren');
  });

  it('reduces lantern traffic to counts and directions, never names', () => {
    const p = projectForHouse(log([
      { kind: 'lantern.place', tick: 1, night: 3, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
      { kind: 'move.enter', tick: 5, night: 3, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },
      { kind: 'move.enter', tick: 8, night: 3, actor: 'moss', room: 'music_room', via: 'd_music_playroom' },
    ]), 3);
    const rec = p.lanternRecords.find(r => r.room === 'music_room')!;
    expect(rec.crossings).toBe(2);
    expect(JSON.stringify(p.lanternRecords)).not.toContain('clem');
    expect(JSON.stringify(p.lanternRecords)).not.toContain('moss');
  });

  it('counts flames lost in that night only', () => {
    const p = projectForHouse(log([
      { kind: 'flame.out', tick: 1, night: 2, reason: 'take', remaining: 4 },
      { kind: 'flame.out', tick: 1, night: 3, reason: 'snuff', remaining: 3 },
    ]), 3);
    expect(p.flamesLost).toBe(1);
    expect(p.flamesRemaining).toBe(3);
  });

  // Flames remaining is a stock and must carry across quiet nights.
  it('carries flames remaining through a night that lost none', () => {
    const l = log([
      { kind: 'flame.out', tick: 1, night: 2, reason: 'take', remaining: 4 },
      { kind: 'flame.out', tick: 1, night: 5, reason: 'snuff', remaining: 3 },
    ]);
    expect(projectForHouse(l, 1).flamesRemaining).toBe(5);
    expect(projectForHouse(l, 2).flamesRemaining).toBe(4);
    expect(projectForHouse(l, 3).flamesRemaining).toBe(4);  // quiet night, still 4
    expect(projectForHouse(l, 4).flamesRemaining).toBe(4);
    expect(projectForHouse(l, 5).flamesRemaining).toBe(3);
    expect(projectForHouse(l, 3).flamesLost).toBe(0);
  });

  // Added beyond the brief: a hand-authored log (Task 14 writes one covering
  // six nights) has no enforced invariant that its array order matches tick
  // order. The given test above never exercises that because its two events
  // already appear in chronological order. Listing them in REVERSE array
  // order here catches an implementation that trusts array position instead
  // of the log's actual (night, tick).
  it('computes flames remaining correctly even when the log is not in chronological order', () => {
    const l = log([
      { kind: 'flame.out', tick: 5, night: 3, reason: 'snuff', remaining: 3 },
      { kind: 'flame.out', tick: 1, night: 2, reason: 'take', remaining: 4 },
    ]);
    expect(projectForHouse(l, 3).flamesRemaining).toBe(3);
  });

  // Carried over from Task 3's review: nothing anywhere uses 'crowd' as a
  // value, so these runtime assertions pass identically for ANY valid
  // FlameReason — they do not discriminate 'crowd' specifically. What
  // actually guards it is that this object literal's `reason: 'crowd'` would
  // fail to typecheck if 'crowd' were removed from FlameReason, and `npm
  // test` runs `tsc --noEmit` before vitest ever executes a single
  // assertion. v12.2 §14's notice is the reason 'crowd' must stay reachable
  // while staying unimplemented. This test exists so that guard has
  // somewhere to live, not because the assertions below detect the mutation
  // themselves.
  it('still accepts a crowd flame in the log, while no code produces one', () => {
    const p = projectForHouse(log([
      { kind: 'flame.out', tick: 1, night: 5, reason: 'crowd', remaining: 4 },
    ]), 5);
    expect(p.flamesLost).toBe(1);
    expect(p.flamesRemaining).toBe(4);
  });

  it('reports floor-level sounds without the room that made them', () => {
    const p = projectForHouse(log([
      { kind: 'sound', tick: 4, night: 2, floor: 1, sound: 'take', room: 'attic' },
    ]), 2);
    expect(p.floorSounds).toEqual([{ floor: 1, sound: 'take' }]);
    expect(JSON.stringify(p.floorSounds)).not.toContain('attic');
  });

  // socksSecured is an explicit Produces field with no coverage anywhere in
  // the brief's own suite — a hardcoded 0 would pass every test above it.
  it('counts secured socks', () => {
    const p = projectForHouse(log([
      { kind: 'sock.secure', tick: 1, night: 2, actor: 'wren', sock: 'sock_1', room: 'attic' },
      { kind: 'sock.secure', tick: 2, night: 2, actor: 'pike', sock: 'sock_2', room: 'kitchen' },
    ]), 2);
    expect(p.socksSecured).toBe(2);
    expect(JSON.stringify(p)).not.toContain('wren');
  });

  // roomsDisturbed is likewise an explicit Produces field with no coverage
  // anywhere in the brief's own suite.
  it('reports which rooms were disturbed, from a take and from a snuff', () => {
    const p = projectForHouse(log([
      { kind: 'take.complete', tick: 1, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
      { kind: 'lantern.snuff', tick: 2, night: 2, actor: 'moss', lantern: 'lantern_a', room: 'kitchen' },
    ]), 2);
    expect(new Set(p.roomsDisturbed)).toEqual(new Set(['attic', 'kitchen']));
    expect(JSON.stringify(p)).not.toContain('moss');
  });

  // v12.2 §8 — "whether the children crowded together", as a bare boolean.
  it('reduces a crowd to a boolean, keeping neither the room nor the names', () => {
    const p = projectForHouse(log(['clem', 'moss', 'sparrow'].map((actor, i) => ({
      kind: 'move.enter' as const, tick: 10 + i, night: 5, actor,
      room: 'library', via: 'd_hearth_library',
    }))), 5);
    expect(p.crowded).toBe(true);
    expect(JSON.stringify(p)).not.toContain('library');
    expect(JSON.stringify(p)).not.toContain('clem');
  });

  it('is not crowded at two', () => {
    const p = projectForHouse(log(['clem', 'moss'].map((actor, i) => ({
      kind: 'move.enter' as const, tick: 10 + i, night: 5, actor,
      room: 'library', via: 'd_hearth_library',
    }))), 5);
    expect(p.crowded).toBe(false);
  });

  // v12.2 §14's own notice: the crowd count must be over distinct BODIES
  // ending the night in a room, not over how many times a doorway got
  // crossed. One actor re-entering the same room three times is one body,
  // not three — and the two tests immediately above cannot tell the
  // difference, since each of their actors enters exactly once apiece.
  it('is not crowded when the same body enters a room three times', () => {
    const p = projectForHouse(log([
      { kind: 'move.enter', tick: 10, night: 5, actor: 'clem', room: 'library', via: 'd_hearth_library' },
      { kind: 'move.enter', tick: 11, night: 5, actor: 'clem', room: 'library', via: 'd_hearth_library' },
      { kind: 'move.enter', tick: 12, night: 5, actor: 'clem', room: 'library', via: 'd_hearth_library' },
    ]), 5);
    expect(p.crowded).toBe(false);
  });

  // Cut in v12.1: the floor report leaked the villain by elimination,
  // Midnight was "a beat, not a mechanic", and ghost disturbances are no
  // longer in §8's report list. None of the three may come back.
  //
  // The brief's own version of this test cast the result `as Record<string,
  // unknown>` to probe for stray keys — that cast does not typecheck here
  // (TS2352: HouseProjection has no index signature, so tsc rejects it as
  // insufficiently overlapping). `in` reads the same runtime fact — is this
  // key present on the object at all — without needing a cast.
  it('carries no inactivity floor, no Midnight room, and no ghost disturbances', () => {
    const p = projectForHouse(log([]), 4);
    expect('inactivityFloor' in p).toBe(false);
    expect('midnightRoom' in p).toBe(false);
    expect('ghostDisturbances' in p).toBe(false);
  });
});
