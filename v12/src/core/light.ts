import { dist, type Vec2 } from './geometry';
import type { RoomId } from './house';

/** rules §18's escalation, as numbers. Index 0 is night one.
 *  Nights 1-2 keep faint ambient visibility; night 3 drops; 5-6 are harsher. */
export const AMBIENT_BY_NIGHT = [0.55, 0.50, 0.30, 0.22, 0.14, 0.08] as const;

export const IDENTIFY_THRESHOLD = 0.45;
export const DARK_ENOUGH_FOR_TAKE = 0.25;
export const LANTERN_RADIUS = 120;
export const CARRIED_LANTERN_RADIUS = 45;

export interface LightSource { room: RoomId; at: Vec2; radius: number }

export function ambientForNight(night: number): number {
  const i = Math.min(Math.max(night - 1, 0), AMBIENT_BY_NIGHT.length - 1);
  return AMBIENT_BY_NIGHT[i]!;
}

/** Light is room-scoped. rules §10.2 says a lantern "illuminates a defined
 *  area", and rooms are boxes, so a source never reaches past its own room.
 *  That is also what makes the render-side mask cheap. */
export function lightAt(
  night: number, room: RoomId, p: Vec2, sources: readonly LightSource[],
): number {
  let level = ambientForNight(night);
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
