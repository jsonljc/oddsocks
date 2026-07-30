import { dist, type Vec2 } from './geometry';
import type { House, RoomId } from './house';
import { makeRng } from './rng';

/** v12.2 §13 — "Faint light almost everywhere," then progressively less of it.
 *
 *  **Ambient is per room, not per night.** A single global floor cannot express
 *  "almost", and the first version of this file proved why: with one number a
 *  night, no point in the house could ever be darker than that night's floor, so
 *  no grab was possible until Night Four and the game could not start. v12.2 §13
 *  bans the grab on Night One *only*.
 *
 *  So a room is either faintly lit — you can see faces — or dark, where you
 *  cannot and where you can be taken. What escalates is HOW MANY rooms are dark
 *  and how dark they get. */
export const LIT_AMBIENT_BY_NIGHT  = [0.60, 0.55, 0.52, 0.50, 0.48, 0.46] as const;
export const DARK_AMBIENT_BY_NIGHT = [0.20, 0.16, 0.13, 0.10, 0.08, 0.06] as const;

/** Of twelve rooms. The Hearth is never dark — it is literally on fire — so
 *  eleven is the ceiling. */
export const DARK_ROOM_COUNT_BY_NIGHT = [3, 5, 7, 9, 11, 11] as const;

export const IDENTIFY_THRESHOLD = 0.45;
export const DARK_ENOUGH_FOR_TAKE = 0.25;
export const LANTERN_RADIUS = 120;
export const CARRIED_LANTERN_RADIUS = 45;

export const ALWAYS_LIT: readonly RoomId[] = ['hearth'];

export interface LightSource { room: RoomId; at: Vec2; radius: number }

function atNight<T>(table: readonly T[], night: number): T {
  return table[Math.min(Math.max(Math.round(night) - 1, 0), table.length - 1)]!;
}

/** Which rooms are dark on a given night. Deterministic from the match seed, and
 *  **nested** — a room dark on night n is still dark on n+1 — so the house is
 *  learnable rather than re-rolled nightly. */
export function darkRoomsFor(house: House, night: number, seed: number): Set<RoomId> {
  const candidates = house.rooms
    .map(r => r.id)
    .filter(id => !ALWAYS_LIT.includes(id));

  // Shuffle once per match, then take a prefix that only grows with the night.
  const rng = makeRng(seed);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const count = Math.min(atNight(DARK_ROOM_COUNT_BY_NIGHT, night), candidates.length);
  return new Set(candidates.slice(0, count));
}

export function ambientFor(night: number, room: RoomId, dark: ReadonlySet<RoomId>): number {
  return dark.has(room)
    ? atNight(DARK_AMBIENT_BY_NIGHT, night)
    : atNight(LIT_AMBIENT_BY_NIGHT, night);
}

/** Light is room-scoped. v12.2 §5 says a placed lantern lights *its room*, and
 *  rooms are boxes, so a source never reaches past its own. That is also what
 *  makes the render-side mask cheap. */
export function lightAt(
  night: number, room: RoomId, p: Vec2,
  sources: readonly LightSource[], dark: ReadonlySet<RoomId>,
): number {
  let level = ambientFor(night, room, dark);
  for (const s of sources) {
    if (s.room !== room) continue;
    const d = dist(s.at, p);
    if (d >= s.radius) continue;
    level = Math.max(level, 1 - (d / s.radius) ** 2);
  }
  return Math.min(level, 1);
}

export type Visibility = 'identified' | 'silhouette' | 'unseen';

/** rules §9: in deep darkness names disappear and colours desaturate, but
 *  "footsteps and movement remain perceptible" — so darkness must degrade to
 *  a silhouette, not to nothing. 'unseen' is for a light level of zero only,
 *  which the ambient floor never reaches. */
export function visibilityAt(level: number): Visibility {
  if (level >= IDENTIFY_THRESHOLD) return 'identified';
  if (level > 0) return 'silhouette';
  return 'unseen';
}
