import type { ActorId, SoundKind } from '../core/events';
import type { RoomId } from '../core/house';
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

  const didNotReturn: ActorId[] = [];
  const roomsDisturbed = new Set<RoomId>();
  const floorSounds: { floor: number; sound: SoundKind }[] = [];
  const watched = new Map<RoomId, { doors: Set<string>; moved: boolean }>();
  const crossings = new Map<RoomId, number>();
  let flamesLost = 0;
  let socksSecured = 0;

  // Flames are a STOCK; flames lost is a FLOW. What remains carries across
  // nights — computing it from this night's events alone reports five on
  // every quiet night. This repository has made exactly this stock-for-flow
  // substitution before; do not collapse these two loops.
  //
  // Math.min, not a plain overwrite: flames only ever go out (v12.2 §7), so
  // remaining is non-increasing over real time no matter what order a log
  // lists its events in. A plain overwrite trusts the array's own order to
  // already be chronological — true of every test fixture above, but not a
  // safe assumption for Task 14's hand-authored six-night log, and not
  // something MatchLog's type enforces.
  let flamesRemaining = 5;
  for (const e of log.events) {
    if (e.kind === 'flame.out' && e.night <= night) {
      flamesRemaining = Math.min(flamesRemaining, e.remaining);
    }
  }

  for (const e of nightly) {
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
      case 'lantern.place': {
        const rec = watched.get(e.room) ?? { doors: new Set<string>(), moved: false };
        if (e.watching) rec.doors.add(e.watching);
        watched.set(e.room, rec);
        break;
      }
      case 'lantern.carry': {
        const rec = watched.get(e.room);
        if (rec) rec.moved = true;
        break;
      }
      case 'lantern.snuff':
        roomsDisturbed.add(e.room);
        break;
      default:
        break;
    }
  }

  // v12.2 §5 — a placed lantern "watches one doorway of your choosing and
  // reports what crossed it," in "numbers, directions, and roughly when...
  // never names." Only the count survives projection here — see the note on
  // `outward`/`hurried` below for why direction and hurriedness do not, yet.
  for (const e of nightly) {
    if (e.kind !== 'move.enter') continue;
    for (const [room, rec] of watched) {
      if (rec.doors.has(e.via)) crossings.set(room, (crossings.get(room) ?? 0) + 1);
    }
  }

  const lanternRecords: LanternRecord[] = [...watched].map(([room, rec]) => ({
    room,
    crossings: crossings.get(room) ?? 0,
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
    moved: rec.moved,
  }));

  // v12.2 §14's own notice: the crowd count must be over distinct BODIES
  // ending the night in a room, not over how many times a doorway got
  // crossed — one actor re-entering a room three times is one body, not
  // three. Fold to each actor's LAST move.enter this night (sorted by tick
  // rather than trusting the log's own array order, for the same reason
  // flamesRemaining above does not trust it) before counting who that
  // leaves standing in which room.
  const byTick = [...nightly].sort((a, b) => a.tick - b.tick);
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
