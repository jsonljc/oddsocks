import type { GameRecord } from '../rules/game.js';
import type { House, OddityId, PlayerId, RoomId } from '../rules/types.js';
import type { NightRecord } from '../rules/state.js';
import { bedroomOf, doorsOf, floorOf, roomsWithin } from '../rules/map.js';
import { PUBLIC_ODDITIES } from '../rules/oddities.js';

/** Two phases of two steps each: every night is a walk of exactly four edges. */
const HOPS_PER_NIGHT = 4;

const others = (record: GameRecord): PlayerId[] =>
  record.config.roster.filter((p) => p !== record.villain);

const fourHopCache = new WeakMap<House, Map<RoomId, Set<RoomId>>>();

/**
 * Rooms reachable from `from` by a walk of exactly `HOPS_PER_NIGHT` edges, revisits
 * allowed. Graph distance is the wrong test here, even though it looks like a safe
 * upper bound: a walk of exactly four edges can strand a player one door short of
 * a room distance calls reachable. A dead-end room can only be entered on its one
 * door, which forces a closed walk of exactly three edges back to that door's far
 * end first — and not every room can make a three-edge round trip (that needs an
 * odd cycle nearby). `east_hall -> bed_clem`, `landing -> bed_wren`,
 * `sewing_room -> bed_moss` and `attic -> bed_moss` are all graph-distance 1 but
 * reachable by no four-edge walk; `west_hall -> bed_bell` is, because west_hall
 * sits next to the map's one triangle and can return to itself in three edges.
 * Computed once per `House` and cached, since `solve` calls this many times a game.
 */
function fourHopFrontier(house: House, from: RoomId): Set<RoomId> {
  let byRoom = fourHopCache.get(house);
  if (!byRoom) { byRoom = new Map(); fourHopCache.set(house, byRoom); }
  const cached = byRoom.get(from);
  if (cached) return cached;

  let frontier = new Set<RoomId>([from]);
  for (let step = 0; step < HOPS_PER_NIGHT; step++) {
    const next = new Set<RoomId>();
    for (const room of frontier) for (const d of doorsOf(house, room)) next.add(d);
    frontier = next;
  }
  byRoom.set(from, frontier);
  return frontier;
}

/** Whether one night's walk (exactly four edges: two at dusk, two at midnight)
 *  can carry a player from `from` to `to`. */
export function reachableInFourHops(house: House, from: RoomId, to: RoomId): boolean {
  return fourHopFrontier(house, from).has(to);
}

/**
 * Every room the villain could have claimed on this night without contradicting a
 * hard fact. Ignores the night-to-night chain — `solve` handles that.
 */
export function viableRoomsAt(record: GameRecord, night: number): RoomId[] {
  const n = record.nights[night - 1];
  if (!n) return [];

  const house = record.config.house;
  const villain = record.villain;
  const truth = n.midnightPositions[villain]!;
  const innocents = others(record);

  // A lit-room witness names everyone present. If one named the villain, the
  // claim is pinned; if one was somewhere else and did not, that room is refuted.
  const refuted = new Set<RoomId>();
  for (const p of innocents) {
    const s = n.sightings[p]!;
    if (!s.lit) continue;
    if (s.named.includes(villain)) return [truth];
    refuted.add(s.room);
  }

  // Dark rooms hide identity but not headcount. If an occupant reported k others,
  // exactly k+1 players were there — one more claimant than that is a contradiction.
  // Tally only innocents' claims: they are always truthful, so this counts how many
  // seats are already spoken for before the villain's hypothetical claim adds one
  // more. Counting the villain's own (truthful) claim here too would double-count
  // it against the very room being tested, refuting the villain's real room
  // whenever nobody present happened to be Hushed.
  for (const p of innocents) {
    const s = n.sightings[p]!;
    if (s.lit) continue;
    const claimants = innocents.filter((q) => n.claims[q] === s.room).length;
    if (claimants >= s.others + 1) refuted.add(s.room);
  }

  let candidates = Object.keys(house.rooms).filter((r) => !refuted.has(r));

  for (const e of n.events) {
    // The trail: if it named the villain, they were within the radius of the robbery.
    if (e.t === 'trail' && e.player === villain) {
      const near = new Set(roomsWithin(house, e.room, record.config.trailRadius));
      candidates = candidates.filter((r) => near.has(r));
    }
    // The Bell announces the true room outright — no lie survives it.
    if (e.t === 'bell' && e.target === villain) candidates = [e.room];
  }

  // A Keyhole pins or forbids the claim for whichever past night it revealed. It is
  // spent (and so recorded) on some later night, not this one, so its event lives
  // in that later night's own record — search every night's events, not just this
  // night's, for one that targets `night`.
  for (const later of record.nights) {
    for (const e of later.events) {
      if (e.t === 'keyhole' && e.night === night) {
        candidates = e.occupants.includes(villain)
          ? candidates.filter((r) => r === e.room)
          : candidates.filter((r) => r !== e.room);
      }
    }
  }

  // Public oddities only — private ones are deniable, so they prove nothing.
  candidates = candidates.filter((r) => publicOdditiesAllow(record, n, r));

  // A theft is a light going out in a room the villain was standing in, and a
  // dark room can hold a lie. Nothing further to enforce here.
  return candidates.sort();
}

function publicOdditiesAllow(record: GameRecord, n: NightRecord, claim: RoomId): boolean {
  if (!record.config.layers.oddities) return true;
  const house = record.config.house;
  const villain = record.villain;
  const innocents = others(record);

  for (const e of n.events) {
    if (e.t !== 'oddity') continue;
    // Structural gate: only PUBLIC_ODDITIES may constrain. Private ones (Wren,
    // Sparrow) are deniable — the villain holds an oddity too and could simply lie
    // about its output — so this must hold even if a future branch below is added
    // without separately checking.
    if (!PUBLIC_ODDITIES.includes(e.source as OddityId)) continue;
    const payload = e.payload as Record<string, unknown>;

    if (e.source === 'bell' && e.detail === 'adjacentCount' && villain !== 'bell') {
      const bellRoom = n.midnightPositions['bell'];
      if (!bellRoom) continue;
      const beside = new Set(doorsOf(house, bellRoom));
      const fromInnocents = innocents
        .filter((p) => p !== 'bell' && beside.has(n.midnightPositions[p]!)).length;
      const implied = fromInnocents + (beside.has(claim) ? 1 : 0);
      if (implied !== payload['count']) return false;
    }

    if (e.source === 'clem' && e.detail === 'itemHolders' && villain !== 'clem') {
      const clemRoom = n.midnightPositions['clem'];
      if (!clemRoom || claim !== clemRoom) continue;

      // The solver can only ever bound the villain's holdings, never know them
      // for certain — and the table can't either, which is exactly why this has
      // to be a *provable* lower bound, not a reconstruction. A live Call spends
      // items from anonymous hands (`callResolved` carries only a count, never
      // names), so if one went live this night the villain might have paid
      // without leaving any trace. Treat that as "nothing provable" rather than
      // guess: an over-tight bound refutes the truth, a loose one merely leaves
      // signal on the table, and only the second direction is safe. Do not
      // "optimise" this back into inferring who paid — the table can't either.
      const liveCall = n.events.some((x) => x.t === 'callResolved' && x.outcome !== 'fizzled');
      if (liveCall) continue;

      // Item holding is public, so a villain claiming Clem's room must fit the
      // tally. A dusk pickup can be stripped by the Grip later the same midnight
      // — the Grip always resolves on a theft with the victim home, and the
      // villain is always the thief, so treat any grip this night as a possible
      // (not merely confirmed) loss of the item just picked up. This is a lower
      // bound, not an exact count: a multi-item carrier (Moss) holding something
      // from an earlier night, invisible to this night's events, under-counts
      // here too — also the safe direction, so it is left alone.
      const pickedUp = n.events.filter((x) => x.t === 'itemTaken' && x.player === villain).length;
      const gripped = n.events.some((x) => x.t === 'grip');
      const held = Math.max(0, pickedUp - (gripped ? 1 : 0));
      if (held > 0 && payload['count'] === 0) return false;
    }
  }
  return true;
}

const padded = (xs: number[], nights: number): number[] =>
  xs.concat(Array<number>(Math.max(0, nights - xs.length)).fill(0));

/**
 * Pike's oddity, when the layer is on, announces whether *any* player crossed
 * floors during the walk into this night. `false` pins every transition into this
 * night — including the villain's claim — to same-floor rooms; anything else
 * (the event absent, or `true`) leaves floor changes open.
 */
function floorChangeAllowed(arrival: NightRecord): boolean {
  for (const e of arrival.events) {
    if (e.t === 'oddity' && e.source === 'pike' && e.detail === 'floorCrossing') {
      return (e.payload as Record<string, unknown>)['crossed'] !== false;
    }
  }
  return true;
}

/**
 * Whether the night that ends in `arrival`'s record could have carried the
 * villain's claim from `from` to `to`: an exactly-four-edge walk and, if Pike
 * reported nobody crossed floors that night, the same floor throughout.
 */
function canTransition(house: House, from: RoomId, to: RoomId, arrival: NightRecord): boolean {
  if (!reachableInFourHops(house, from, to)) return false;
  if (floorOf(house, from) !== floorOf(house, to) && !floorChangeAllowed(arrival)) return false;
  return true;
}

/**
 * Forward-backward DP over claim histories. State is "the room claimed on night
 * n"; a transition is legal when it is both a reachable four-edge walk and
 * consistent with Pike's floor-crossing announcement for the arriving night.
 */
export function solve(record: GameRecord): { forcedNight: number | null; hidingSpace: number[] } {
  const house = record.config.house;
  const nights = record.nights.length;

  const viable: RoomId[][] = [];
  for (let i = 1; i <= nights; i++) viable.push(viableRoomsAt(record, i));

  // Everyone starts the game in their own bedroom — public knowledge, not a
  // deduction — so night 1's claim is a transition too: it must be reachable
  // from bed_<villain> in exactly four hops, under the same rule (and the same
  // Pike floor-crossing check) as every later night.
  if (nights > 0) {
    const start = bedroomOf(house, record.villain);
    const arrival = record.nights[0]!;
    viable[0] = viable[0]!.filter((room) => canTransition(house, start, room, arrival));
  }

  // An empty night-1 set is already a forced contradiction, before the forward
  // pass (which only checks night 2 onward) even starts.
  if ((viable[0]?.length ?? 0) === 0) {
    return { forcedNight: 1, hidingSpace: padded([0], nights) };
  }

  // Forward pass: which rooms are reachable from a consistent past.
  let reachable: Set<RoomId> = new Set(viable[0]);
  const forward: Set<RoomId>[] = [new Set(reachable)];

  for (let i = 1; i < nights; i++) {
    const arrival = record.nights[i]!;
    const next = new Set<RoomId>();
    for (const room of viable[i]!) {
      for (const prev of reachable) {
        if (canTransition(house, prev, room, arrival)) { next.add(room); break; }
      }
    }
    forward.push(new Set(next));
    reachable = next;
    if (next.size === 0) {
      return { forcedNight: i + 1, hidingSpace: padded(forward.map((s) => s.size), nights) };
    }
  }

  // Backward pass: drop rooms with no consistent future.
  const hidingSpace = forward.map((s) => s.size);
  for (let i = nights - 2; i >= 0; i--) {
    const arrival = record.nights[i + 1]!;
    const survivors = [...forward[i]!].filter((room) =>
      [...forward[i + 1]!].some((nxt) => canTransition(house, room, nxt, arrival)));
    forward[i] = new Set(survivors);
    hidingSpace[i] = survivors.length;
  }

  return { forcedNight: null, hidingSpace: padded(hidingSpace, nights) };
}
