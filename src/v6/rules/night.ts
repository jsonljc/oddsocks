import { adjacent, capacityOf, isSpoke } from './house.js';
import {
  type GameState, type HouseEvent, type NightRecord,
  alive, children, houseIsDark, isLit, litRooms, occupants,
} from './state.js';
import type { Held, PlayerId, RoomId } from './types.js';

export interface NightAction {
  readonly to: RoomId;
  /** Put down what you carry. A lantern set down burns. */
  readonly setDown: boolean;
  /** Lift from the floor, if the room is lit and your hand has room. */
  readonly takeUp: 'none' | 'sock' | 'lantern';
  /** Odd Socks only. Taking is optional. */
  readonly take: boolean;
}

/** Declared in the morning by a child holding a pair. */
export interface MorningAction {
  readonly name: PlayerId | null;
}

const canTakeSock = (h: Held): boolean => h === null || (h.t === 'socks' && h.n === 1);
const canTakeLantern = (h: Held): boolean => h === null;

/**
 * Step 1. A pair of socks buys one Naming, and the socks are spent saying it.
 * Naming an innocent fails on the spot — they turn out their pockets — and
 * clears them for good. Naming Odd Socks puts them in the open for one night.
 */
export function resolveMorning(s: GameState, morning: Readonly<Record<PlayerId, MorningAction>>): HouseEvent[] {
  const events: HouseEvent[] = [];
  s.naming = null;

  for (const p of children(s)) {
    const target = morning[p]?.name;
    if (!target) continue;
    const hand = s.held[p];
    if (hand?.t !== 'socks' || hand.n !== 2) continue;   // no pair, no Naming
    if (!alive(s).includes(target) || target === p) continue;

    s.held[p] = null;                                     // the socks are spent
    events.push({ t: 'naming', accuser: p, target });

    if (target === s.villain) {
      s.naming = { accuser: p, target };                  // they walk in the open tonight
    } else {
      s.cleared.push(target);
      events.push({ t: 'namingFailed', target, cleared: true });
      snuffEveryLantern(s);
    }
    break;                                                // one Naming a night
  }
  return events;
}

function snuffEveryLantern(s: GameState): void {
  for (const [room, n] of Object.entries(s.lanternsAt)) {
    if (n > 0) {
      s.snuffedAt[room] = (s.snuffedAt[room] ?? 0) + n;
      s.lanternsAt[room] = 0;
    }
  }
}

/** Steps 3–13. Mutates `s` and returns what the house says in the morning. */
export function resolveNight(
  s: GameState,
  actions: Readonly<Record<PlayerId, NightAction>>,
  carried: HouseEvent[] = [],
): NightRecord {
  const events: HouseEvent[] = [...carried];
  const living = alive(s);
  const house = s.config.house;

  // --- 4/5. Movement, then spoke capacity ------------------------------------
  const want: Record<PlayerId, RoomId> = {};
  for (const p of living) {
    const to = actions[p]!.to;
    const from = s.positions[p]!;
    if (to !== from && !adjacent(house, from, to)) {
      throw new Error(`${p} cannot reach ${to} from ${from}`);
    }
    want[p] = to;
  }

  const arrivalsBy = new Map<RoomId, PlayerId[]>();
  for (const p of living) {
    if (want[p] === s.positions[p]) continue;             // stayed put
    const list = arrivalsBy.get(want[p]!) ?? [];
    list.push(p);
    arrivalsBy.set(want[p]!, list);
  }

  for (const [room, arrivals] of arrivalsBy) {
    if (!isSpoke(house, room)) continue;
    const staying = living.filter((p) => s.positions[p] === room && want[p] === room).length;
    if (staying + arrivals.length <= capacityOf(house, room)) continue;
    // Nobody gets in. The house names the room but never who tried for it.
    for (const p of arrivals) want[p] = s.positions[p]!;
    events.push({ t: 'crowded', room });
  }

  for (const p of living) s.positions[p] = want[p]!;

  // --- 6. Set-downs ----------------------------------------------------------
  for (const p of living) {
    const hand = s.held[p] ?? null;
    if (!actions[p]!.setDown || hand === null) continue;
    const room = s.positions[p]!;
    if (hand.t === 'lantern') {
      s.lanternsAt[room] = (s.lanternsAt[room] ?? 0) + 1;
      events.push({ t: 'lanternLit', room });
    } else {
      s.socksAt[room] = (s.socksAt[room] ?? 0) + hand.n;
    }
    s.held[p] = null;
  }

  // --- 7. Lighting settles. Nothing after this changes it tonight. -----------
  const lit = new Set(litRooms(s));

  // --- 8/9. The take, and the victim's goods fall ----------------------------
  let took: PlayerId | null = null;
  const villainRoom = s.positions[s.villain]!;
  const here = occupants(s, villainRoom);
  if (here.length === 2 && actions[s.villain]!.take) {
    const victim = here.find((p) => p !== s.villain)!;
    took = victim;
    const hand = s.held[victim];
    if (hand?.t === 'lantern') s.lanternsAt[villainRoom] = (s.lanternsAt[villainRoom] ?? 0) + 1;
    else if (hand?.t === 'socks') s.socksAt[villainRoom] = (s.socksAt[villainRoom] ?? 0) + hand.n;
    s.held[victim] = null;
    s.taken.push(victim);
    events.push({ t: 'taken', player: victim });
  }

  // --- 10. Odd Socks sheds, every night, wherever they are -------------------
  // Shedding only in the dark let the villain opt out of producing evidence
  // altogether: measured, a villain who never left the lit landings shed zero
  // socks and won 100% of games, because the children's only route needs socks.
  // Shedding everywhere closes it, and the light does the work instead — a sock
  // on a lit floor arrives beside a published roster, so it names a suspect set
  // rather than just a room. The house still never says whose it is.
  const shedAt = villainRoom;
  s.socksAt[shedAt] = (s.socksAt[shedAt] ?? 0) + 1;

  // Sightings are taken here: lighting has settled and the shed has happened,
  // but nothing has been lifted yet. This is what a player actually saw.
  const stillAlive = alive(s);
  const sightings: Record<PlayerId, NightRecord['sightings'][string]> = {};
  for (const p of stillAlive) {
    const room = s.positions[p]!;
    const isLitNow = lit.has(room);
    const others = stillAlive.filter((x) => x !== p && s.positions[x] === room);
    sightings[p] = {
      room,
      lit: isLitNow,
      others: others.length,
      named: isLitNow ? [...others].sort() : [],
      socksHere: isLitNow ? (s.socksAt[room] ?? 0) : 0,
      lanternsHere: isLitNow ? (s.lanternsAt[room] ?? 0) + (s.snuffedAt[room] ?? 0) : 0,
    };
  }

  // --- 11. Take-ups. A contested one moves nothing. --------------------------
  let socksLifted = 0, pairsFormed = 0;
  const litSpokeReads = stillAlive.filter((p) =>
    lit.has(s.positions[p]!) && isSpoke(house, s.positions[p]!)).length;
  for (const room of new Set(stillAlive.map((p) => s.positions[p]!))) {
    if (!lit.has(room)) continue;
    const present = stillAlive.filter((p) => s.positions[p] === room);
    for (const kind of ['sock', 'lantern'] as const) {
      const wants = present.filter((p) =>
        actions[p]!.takeUp === kind &&
        (kind === 'sock' ? canTakeSock(s.held[p] ?? null) : canTakeLantern(s.held[p] ?? null)));
      if (wants.length !== 1) continue;                   // 0 or contested
      const p = wants[0]!;
      if (kind === 'sock') {
        if ((s.socksAt[room] ?? 0) < 1) continue;
        s.socksAt[room]!--;
        const hand = s.held[p] ?? null;
        // One sock or a pair fills the same hand, so any character can run the
        // evidence route — not only the one who carries two things.
        const pair = hand !== null && hand.t === 'socks';
        s.held[p] = pair ? { t: 'socks', n: 2 } : { t: 'socks', n: 1 };
        socksLifted++;
        if (pair) pairsFormed++;
      } else {
        const burning = s.lanternsAt[room] ?? 0;
        const out = s.snuffedAt[room] ?? 0;
        if (burning > 0) s.lanternsAt[room] = burning - 1;
        else if (out > 0) s.snuffedAt[room] = out - 1;
        else continue;
        s.held[p] = { t: 'lantern' };
      }
    }
  }

  // --- 12. Wax burns ---------------------------------------------------------
  for (const l of house.landings) {
    if ((s.wax[l] ?? 0) <= 0) continue;
    s.wax[l] = Math.max(0, s.wax[l]! - 1 - occupants(s, l).length);
    if (s.wax[l] === 0) events.push({ t: 'dark', room: l });
  }

  // --- The morning report ----------------------------------------------------
  for (const room of [...lit].sort()) {
    events.push({ t: 'roster', room, who: stillAlive.filter((p) => s.positions[p] === room).sort() });
  }
  for (const l of house.landings) events.push({ t: 'wax', room: l, left: s.wax[l] ?? 0 });

  // --- 13. Win check: Corner, then the take target, then darkness ------------
  if (s.naming) {
    const withThem = occupants(s, s.positions[s.naming.target]!).filter((p) => p !== s.villain);
    if (withThem.length >= 2) s.over = { winner: 'children', how: 'cornered' };
    else {
      events.push({ t: 'namingFailed', target: s.naming.target, cleared: false });
      snuffEveryLantern(s);
    }
    s.naming = null;
  }
  if (!s.over && s.taken.length >= s.config.takeTarget) s.over = { winner: 'oddsocks', how: 'taken' };
  if (!s.over && houseIsDark(s)) s.over = { winner: 'oddsocks', how: 'dark' };

  return {
    night: s.night,
    positions: { ...s.positions },
    events,
    lit: [...lit],
    shedAt,
    took,
    sightings,
    litSpokeReads,
    socksLifted,
    pairsFormed,
  };
}

export const litFor = (s: GameState, room: RoomId): boolean => isLit(s, room);
