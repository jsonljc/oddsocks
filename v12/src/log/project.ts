import type { ActorId, SoundKind } from '../core/events';
import type { DoorId, RoomId } from '../core/house';
import type { MatchLog } from './schema';

export type { MatchLog };

/** A lantern's dawn record, keyed by the room it watched from — not by the
 *  physical lantern object, since the report names the room ("The Music Room
 *  lantern...") and never the lantern itself. `outward` and `hurried` are
 *  part of the shape but are not populated by `projectForHouse` yet; see the
 *  comments at their construction site below for two different reasons why. */
export interface LanternRecord {
  room: RoomId; crossings: number; outward: number; hurried: boolean; moved: boolean;
}

/** GLOBAL CONSTRAINT: this type is the enforcement mechanism for v12.2 §8's
 *  voice rule — "the house never says anything that depends on who someone
 *  is." It carries ActorId in exactly ONE field — didNotReturn — which §8
 *  explicitly grants ("who didn't come back"). renderReport() takes only
 *  this, so it cannot leak a name it was never given. Do not add an
 *  identity-bearing field here without re-reading v12.2 §8 and spec §3.3. */
export interface HouseProjection {
  night: number;
  didNotReturn: ActorId[];
  flamesLost: number;
  flamesRemaining: number;
  lanternRecords: LanternRecord[];
  socksSecured: number;
  roomsDisturbed: RoomId[];
  floorSounds: { floor: number; sound: SoundKind }[];
  /** v12.2 §8 — "whether the children crowded together". A boolean, deliberately:
   *  naming the room would leak who was in it, and the count is what §14 prices.
   *  §14 itself is parked, so this reports and costs nothing. */
  crowded: boolean;
}
// Cut in v12.2 and deliberately absent: `inactivityFloor` (§15 cuts the floor
// report — it let a standing group binary-search the villain, one bit a night,
// and could not be computed without leaking who they were), `midnightRoom`
// (Midnight is cut — "a beat, not a mechanic"), and `ghostDisturbances`
// (no longer in §8's report list).

export function projectForHouse(log: MatchLog, night: number): HouseProjection {
  const nightly = log.events.filter(e => e.night === night);

  // A hand-authored log (Task 14 writes one covering six nights) has no
  // enforced invariant that its array order matches tick order.
  // flamesRemaining below already can't trust it, and the crowd fold further
  // down sorts explicitly for the same reason — this single sorted copy is
  // now shared by every computation in this function that depends on which
  // of two same-night events happened first, so there is exactly one place
  // "chronological order" is defined, not several that could disagree.
  const byTick = [...nightly].sort((a, b) => a.tick - b.tick);

  const didNotReturn: ActorId[] = [];
  const roomsDisturbed = new Set<RoomId>();
  const floorSounds: { floor: number; sound: SoundKind }[] = [];
  let flamesLost = 0;
  let socksSecured = 0;

  // Flames are a STOCK; flames lost is a FLOW. What remains carries across
  // nights — computing it from this night's events alone reports five on
  // every quiet night. This repository has made exactly this stock-for-flow
  // substitution before; do not collapse these two loops.
  //
  // Take the value from whichever qualifying event is CHRONOLOGICALLY LAST
  // (max by night, then tick), not whichever comes last in the array — a
  // hand-authored fixture (Task 14 writes one covering six nights) has no
  // enforced invariant that its array order matches (night, tick) order.
  //
  // Deliberately NOT `Math.min(flamesRemaining, e.remaining)`: that would
  // be equally order-independent (flames only ever go out, v12.2 §7, so
  // the running minimum is always non-increasing) but it would ALSO
  // silently repair a genuinely inconsistent fixture — a later event
  // reporting a higher remaining count than an earlier one, which is an
  // authoring mistake, not a quiet night. Min can never rise by
  // construction, which would make Task 14's own "never lets flames
  // remaining rise across the six nights" test vacuous against any log
  // whatsoever. This projection reports what the log says at each night,
  // faithfully, so that check stays meaningful.
  let flamesRemaining = 5;
  let bestNight = -1;
  let bestTick = -1;
  for (const e of log.events) {
    if (e.kind !== 'flame.out' || e.night > night) continue;
    if (e.night > bestNight || (e.night === bestNight && e.tick > bestTick)) {
      flamesRemaining = e.remaining;
      bestNight = e.night;
      bestTick = e.tick;
    }
  }

  // Iterates byTick, not nightly, for the same reason every other loop in
  // this function does: a hand-authored log (Task 14 writes one covering six
  // nights) has no enforced invariant that its array order matches tick
  // order. (Lantern placement/carry bookkeeping used to live in this switch
  // too; it now lives in the window-building pass below, which needs the
  // WHOLE log's chronology, not just tonight's slice — see that pass's
  // comment for why.)
  for (const e of byTick) {
    switch (e.kind) {
      case 'take.complete':
        didNotReturn.push(e.victim);
        roomsDisturbed.add(e.room);
        break;
      case 'flame.out':
        flamesLost++;
        break;
      case 'sound':
        floorSounds.push({ floor: e.floor, sound: e.sound });
        break;
      case 'sock.secure':
        socksSecured++;
        break;
      case 'lantern.snuff':
        roomsDisturbed.add(e.room);
        break;
      default:
        break;
    }
  }

  // A LANTERN'S PLACEMENT IS A STOCK; ITS CROSSINGS ARE A FLOW. Building
  // `watched` from `nightly`/`byTick` alone (as this used to) meant a lantern
  // placed on an earlier night and never touched since had no
  // `lantern.place` event THIS night, so it silently dropped out of the
  // report — measured on SIX_NIGHT_MATCH: lanternRecords was `[]` on nights
  // 2, 4, 5 and 6, though both lanterns were placed and standing the whole
  // time. §8 lists "what the lanterns saw" among what the house reads out
  // EVERY morning, the same "every morning" that makes flamesRemaining above
  // scan the whole log rather than just tonight's slice. Found in the
  // slice-0/1 final review.
  //
  // Fix: reconstruct, from the WHOLE log (up to and including tonight — never
  // beyond, so this stays safe to call against an in-progress match one
  // night at a time, the same constraint flamesRemaining's scan already
  // honours), every WINDOW during which each lantern was both placed and lit
  // — i.e. actually capable of watching a doorway. `lantern.place` opens a
  // window; `lantern.carry` closes one (the lantern isn't watching anything
  // while it's in someone's hands); `lantern.snuff` closes one WITHOUT
  // forgetting where it is (kills the lantern, per §5, but the lantern is
  // still sitting right there); `lantern.relight` reopens one at that
  // remembered spot. A window that overlaps tonight makes tonight's report
  // even if it opened on an earlier night (the stock half); a crossing only
  // counts if it falls inside a window, tonight, chronologically at or after
  // that window's start and before its end (the flow half, and the fix for
  // the sibling bug: a lantern placed at tick 900 must not retroactively see
  // ticks 5 and 6).
  //
  // Mutation-tested while building this: dropping the lit-tracking half (so
  // a snuffed-but-still-placed lantern kept "watching") made night six
  // falsely report "The Music Room lantern watched one figure cross" for
  // moss's tick-610 crossing of lantern_b's door — lantern_b was snuffed at
  // tick 530 on night five and never relit. A dark lantern cannot see a
  // crossing; §5's "kills the lantern" is doing real work here, not just
  // flavour text.
  type Chrono = { night: number; tick: number };
  const atOrBefore = (a: Chrono, b: Chrono) => a.night !== b.night ? a.night < b.night : a.tick <= b.tick;
  const strictlyBefore = (a: Chrono, b: Chrono) => a.night !== b.night ? a.night < b.night : a.tick < b.tick;
  interface LanternWindow { room: RoomId; watching: DoorId; start: Chrono; end: Chrono | null }

  const upToTonight = log.events
    .filter(e => e.night <= night)
    .slice()
    .sort((a, b) => a.night - b.night || a.tick - b.tick);

  const windowsByLantern = new Map<string, LanternWindow[]>();
  const openWindow = new Map<string, LanternWindow>();
  // Remembers a snuffed (unlit but still placed) lantern's room/watching, so
  // a later relight with no intervening carry reopens a window in the same
  // spot rather than needing its own `lantern.place` event (there isn't one
  // — relighting doesn't move the lantern).
  const snuffedAt = new Map<string, { room: RoomId; watching: DoorId }>();
  for (const e of upToTonight) {
    if (e.kind === 'lantern.place') {
      const w: LanternWindow = { room: e.room, watching: e.watching!, start: { night: e.night, tick: e.tick }, end: null };
      openWindow.set(e.lantern, w);
      snuffedAt.delete(e.lantern);
      const list = windowsByLantern.get(e.lantern);
      if (list) list.push(w); else windowsByLantern.set(e.lantern, [w]);
    } else if (e.kind === 'lantern.carry') {
      const w = openWindow.get(e.lantern);
      if (w) { w.end = { night: e.night, tick: e.tick }; openWindow.delete(e.lantern); }
      snuffedAt.delete(e.lantern);
    } else if (e.kind === 'lantern.snuff') {
      const w = openWindow.get(e.lantern);
      if (w) {
        w.end = { night: e.night, tick: e.tick };
        openWindow.delete(e.lantern);
        snuffedAt.set(e.lantern, { room: w.room, watching: w.watching });
      }
    } else if (e.kind === 'lantern.relight') {
      const remembered = snuffedAt.get(e.lantern);
      if (remembered) {
        const w: LanternWindow = { ...remembered, start: { night: e.night, tick: e.tick }, end: null };
        openWindow.set(e.lantern, w);
        snuffedAt.delete(e.lantern);
        const list = windowsByLantern.get(e.lantern);
        if (list) list.push(w); else windowsByLantern.set(e.lantern, [w]);
      }
    }
  }

  // `moved` stays exactly what it was: a per-night, per-room flow (was THIS
  // lantern carried out of THIS room tonight), independent of the window
  // machinery above — a carry event's own `room` field already names where
  // it was picked up from (`applyLanternAction`'s `pickup` case only allows
  // picking up a lantern from the actor's own room).
  const movedRooms = new Set<RoomId>();
  for (const e of byTick) {
    if (e.kind === 'lantern.carry') movedRooms.add(e.room);
  }

  const roomsWatchingTonight = new Set<RoomId>();
  const crossingsByRoom = new Map<RoomId, number>();
  for (const windows of windowsByLantern.values()) {
    for (const w of windows) {
      // Does this window overlap tonight at all? (`upToTonight`'s filter
      // already guarantees w.start.night <= night; an end on a night
      // strictly before tonight means it was already closed before tonight
      // began.)
      if (w.end !== null && w.end.night < night) continue;
      roomsWatchingTonight.add(w.room);
      for (const e of byTick) {
        if (e.kind !== 'move.enter' || e.via !== w.watching) continue;
        const at: Chrono = { night: e.night, tick: e.tick };
        if (!atOrBefore(w.start, at)) continue;
        if (w.end !== null && !strictlyBefore(at, w.end)) continue;
        crossingsByRoom.set(w.room, (crossingsByRoom.get(w.room) ?? 0) + 1);
      }
    }
  }

  const lanternRecords: LanternRecord[] = [...roomsWatchingTonight].map(room => ({
    room,
    crossings: crossingsByRoom.get(room) ?? 0,
    // `outward` is withheld, and — unlike `hurried` below — NOT because the
    // data is unavailable. It is one comparison away: e.via === this room's
    // watched door && e.room !== this room (`applyLanternAction`'s `place`
    // case guarantees the watched door is one of this room's own exits, so
    // the other endpoint is always well-defined). It stays 0 because
    // splitting `crossings` into a direction is exactly what design spec §5
    // flags as unreviewed: "direction, count, timing and whether movement
    // was calm or hurried... frequently names the person" with six players
    // and one watched doorway. `crossings` alone shipped as an accepted
    // aggregate; a direction on top of it is an open design question, not an
    // oversight here. See the Task 12 report.
    outward: 0,
    // `hurried` stays false because no event supplies it: `move.enter`
    // carries no hurried/running flag, and only `step` does. Tying a `step`
    // event's `hurried` flag to a specific crossing would mean correlating
    // actor and tick across two different event kinds with nothing in this
    // log to key that correlation on here — invented semantics, not a read
    // of what the log actually says.
    hurried: false,
    moved: movedRooms.has(room),
  }));

  // v12.2 §14's own notice: the crowd count must be over distinct BODIES
  // ending the night in a room, not over how many times a doorway got
  // crossed — one actor re-entering a room three times is one body, not
  // three. Fold to each actor's LAST move.enter this night (byTick, computed
  // once above and shared by every loop in this function) before counting
  // who that leaves standing in which room.
  const lastRoomThisNight = new Map<ActorId, RoomId>();
  for (const e of byTick) {
    if (e.kind === 'move.enter') lastRoomThisNight.set(e.actor, e.room);
  }
  const endedIn = new Map<RoomId, number>();
  for (const room of lastRoomThisNight.values()) {
    endedIn.set(room, (endedIn.get(room) ?? 0) + 1);
  }
  const crowded = [...endedIn.values()].some(n => n >= 3);

  return {
    night,
    didNotReturn,
    flamesLost,
    flamesRemaining,
    lanternRecords,
    socksSecured,
    roomsDisturbed: [...roomsDisturbed],
    floorSounds,
    crowded,
  };
}
