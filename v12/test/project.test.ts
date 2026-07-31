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

  // Task 12 review: the switch loop that builds `watched` used to iterate
  // `nightly` in raw array order, the one place in this function that didn't
  // sort by tick the way flamesRemaining and the crowd fold both do. A
  // lantern.carry listed BEFORE its room's lantern.place in array order, but
  // at a LATER tick, found no `watched` record yet (the place hadn't been
  // "seen"), so `moved` silently stayed false even though the lantern really
  // was picked back up later that night. Task 13's renderReport reads
  // `moved` directly, so this was a false "nobody moved the lantern" line
  // from a house whose entire premise is that it only ever states facts.
  it('detects a lantern being moved even when the carry is listed before the place in the log', () => {
    const p = projectForHouse(log([
      // Reverse array order: the carry (tick 20, chronologically LATER)
      // appears before the place (tick 5, chronologically EARLIER).
      { kind: 'lantern.carry', tick: 20, night: 3, actor: 'clem', lantern: 'lantern_a', room: 'music_room' },
      { kind: 'lantern.place', tick: 5, night: 3, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
    ]), 3);
    const rec = p.lanternRecords.find(r => r.room === 'music_room')!;
    expect(rec.moved).toBe(true);
  });

  // CRITICAL FIX (slice-0/1 final review, item 3): `nightly` used to filter
  // OUT a lantern's own `lantern.place` event whenever it happened on an
  // earlier night, so a lantern placed once and never touched again dropped
  // out of every later night's report — measured on SIX_NIGHT_MATCH:
  // lanternRecords was `[]` on nights 2, 4, 5 and 6, though both lanterns
  // were placed and standing the whole time. A lantern's placement is a
  // stock (persists across nights); only its crossings are a flow (reset
  // each night).
  it('reports a lantern placed on an earlier night and never touched since (a stock, not a flow)', () => {
    const p = projectForHouse(log([
      { kind: 'lantern.place', tick: 1, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
    ]), 3);
    const rec = p.lanternRecords.find(r => r.room === 'music_room');
    expect(rec).toBeDefined();
    expect(rec!.crossings).toBe(0);
  });

  // CRITICAL FIX (slice-0/1 final review, item 4): crossings used to be
  // counted for ANY room with a watched-door record this night, regardless of
  // whether the crossing happened before or after the lantern was actually
  // placed. The pre-existing "reduces lantern traffic..." test above cannot
  // discriminate this in either direction — it places at tick 1 and crosses
  // at 5/8, so both orderings of "count everything this night" and "count
  // only after placement" agree. This one can fail: the lantern is placed at
  // tick 900, long after two crossings of its own future watched door.
  it('does not count a crossing that happened before the lantern was placed', () => {
    const p = projectForHouse(log([
      { kind: 'move.enter', tick: 5, night: 3, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },
      { kind: 'move.enter', tick: 6, night: 3, actor: 'moss', room: 'music_room', via: 'd_music_playroom' },
      { kind: 'lantern.place', tick: 900, night: 3, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
    ]), 3);
    const rec = p.lanternRecords.find(r => r.room === 'music_room')!;
    expect(rec.crossings).toBe(0);
  });

  // The naive fix for item 4 — "count crossings after the lantern's most
  // recent place event" — breaks this case: SIX_NIGHT_MATCH's night three
  // places lantern_b at tick 340, sees two real crossings at 345/350, THEN
  // carries it away (360) and puts it back in the same spot (370). Both
  // crossings belong to the FIRST placement window, before the carry, and
  // must still count — "since the last place event" (370) would wrongly
  // exclude both.
  it('counts crossings from a placement window that was interrupted by a carry and re-place', () => {
    const p = projectForHouse(log([
      { kind: 'lantern.place', tick: 340, night: 3, actor: 'moss', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
      { kind: 'move.enter', tick: 345, night: 3, actor: 'bell', room: 'playroom', via: 'd_music_playroom' },
      { kind: 'move.enter', tick: 350, night: 3, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },
      { kind: 'lantern.carry', tick: 360, night: 3, actor: 'moss', lantern: 'lantern_a', room: 'music_room' },
      { kind: 'lantern.place', tick: 370, night: 3, actor: 'moss', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
    ]), 3);
    const rec = p.lanternRecords.find(r => r.room === 'music_room')!;
    expect(rec.crossings).toBe(2);
  });

  // Necessary consequence of the item-3 fix, not scope creep — proven by
  // mutation, not asserted on faith (see the slice-0/1 final fix report):
  // building the stock-crossing-nights fix WITHOUT also tracking lit state
  // made a lantern snuffed on an earlier night and never relit falsely
  // "watch" a later crossing of its old door. v12.2 §5 says putting a
  // lantern out "kills" it; a dead lantern cannot see anything until
  // relit, so it must not appear in a night's report at all once its only
  // placement has gone dark.
  it('stops watching once snuffed and never relit, on a later night', () => {
    const p = projectForHouse(log([
      { kind: 'lantern.place', tick: 1, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
      { kind: 'lantern.snuff', tick: 2, night: 1, actor: 'wren', lantern: 'lantern_a', room: 'music_room' },
      { kind: 'move.enter', tick: 5, night: 2, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },
    ]), 2);
    expect(p.lanternRecords.find(r => r.room === 'music_room')).toBeUndefined();
  });

  // The counterpart: relighting resumes watching from the same spot, with no
  // fresh `lantern.place` event (relighting doesn't move the lantern).
  it('resumes watching after a relight, with no new place event', () => {
    const p = projectForHouse(log([
      { kind: 'lantern.place', tick: 1, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
      { kind: 'lantern.snuff', tick: 2, night: 1, actor: 'wren', lantern: 'lantern_a', room: 'music_room' },
      { kind: 'lantern.relight', tick: 3, night: 2, actor: 'clem', lantern: 'lantern_a', room: 'music_room' },
      { kind: 'move.enter', tick: 5, night: 2, actor: 'moss', room: 'playroom', via: 'd_music_playroom' },
    ]), 2);
    const rec = p.lanternRecords.find(r => r.room === 'music_room');
    expect(rec).toBeDefined();
    expect(rec!.crossings).toBe(1);
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

  // Deliberate design pin, not a hypothetical: order-independence could also
  // be had by taking the running MINIMUM remaining seen so far (flames only
  // ever go out, so that is non-increasing too), but a minimum silently
  // REPAIRS a genuinely inconsistent fixture — it can never rise, by
  // construction, which would make Task 14's own "never lets flames
  // remaining rise across the six nights" test vacuous against any log at
  // all. This projection must report what the log says at each night,
  // faithfully, so a real authoring mistake stays visible instead of being
  // quietly smoothed over.
  it('surfaces a rise rather than repairing it, if the log itself is inconsistent', () => {
    const l = log([
      { kind: 'flame.out', tick: 1, night: 3, reason: 'take', remaining: 2 },
      { kind: 'flame.out', tick: 1, night: 4, reason: 'snuff', remaining: 4 },
    ]);
    expect(projectForHouse(l, 3).flamesRemaining).toBe(2);
    expect(projectForHouse(l, 4).flamesRemaining).toBe(4);
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
