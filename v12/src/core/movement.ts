import { clampInside, pointInRect, type Rect, type Vec2 } from './geometry';
import { otherSide, roomById, type DoorId, type House, type RoomId } from './house';

export const ACTOR_RADIUS = 14;

export interface StepResult { room: RoomId; at: Vec2; crossed: DoorId | null }

function inset(r: Rect, radius: number): Rect {
  return { x: r.x + radius, y: r.y + radius, w: r.w - 2 * radius, h: r.h - 2 * radius };
}

/** Rooms are boxes; doors are gaps of `span` centred on `door.at`. If the
 *  desired position leaves the room and lies within a door's span, transfer.
 *  Otherwise clamp. This is deliberately simpler than a navmesh — the house
 *  is twelve rectangles and nothing here needs pathfinding.
 *
 *  Two things make "leaves the room" and "within a door's span" trickier
 *  than they look:
 *
 *  1. "Leaves the room" has to mean leaves the ACTOR_RADIUS-shrunk box, not
 *     the room's raw rectangle. A version of this file checked the raw rect:
 *     any desired position between (wall - ACTOR_RADIUS) and the wall itself
 *     read as "still inside", and got clamped straight back to
 *     (wall - ACTOR_RADIUS) by the same clampInside() call that only shrinks
 *     by the radius. Since a walk or run tick moves less than ACTOR_RADIUS,
 *     that is a permanent fixed point — nobody could ever reach a door, at
 *     any speed, in any room. (Caught empirically: 600 ticks of continuous
 *     movement toward a door produced zero crossings.)
 *
 *  2. A door's span can't be checked symmetrically on both axes. `door.at`
 *     sits in the gap between the two rooms it joins, so on exactly one axis
 *     it falls outside this room's bounds — call that the through-wall axis;
 *     the other is the along-wall axis, where `span` is the width of the
 *     opening. Requiring proximity to `door.at` on the through-wall axis too
 *     is stricter than it looks: ACTOR_RADIUS plus half the gap between rooms
 *     already exceeds half the span, so a legally-clamped position can never
 *     satisfy it, and only a fast (run-speed) tick happens to overshoot far
 *     enough to. Walking into the exact same door would soft-lock. So the
 *     through-wall axis gets a direction test instead — has the player passed
 *     the inset edge on the side this door is on? — not a proximity test.
 *
 *  `closed` (v12.2 §4 — anyone can open and shut doors) lists doors currently
 *  shut. A closed door is a wall: the loop below skips it entirely, so a
 *  desired position that would have crossed it instead falls through to the
 *  final clamp against the room the actor is still in. */
export function stepPosition(
  house: House, room: RoomId, from: Vec2, delta: Vec2,
  closed: ReadonlySet<DoorId> = new Set(),
): StepResult {
  const bounds = roomById(house, room).bounds;
  const desired = { x: from.x + delta.x, y: from.y + delta.y };
  const inner = inset(bounds, ACTOR_RADIUS);

  if (pointInRect(desired, inner)) {
    return { room, at: clampInside(desired, ACTOR_RADIUS, bounds), crossed: null };
  }

  for (const door of house.doors) {
    if (door.a !== room && door.b !== room) continue;
    if (closed.has(door.id)) continue;   // a closed door is a wall

    const throughX = door.at.x < bounds.x || door.at.x > bounds.x + bounds.w;
    const half = door.span / 2;
    const alongOk = throughX
      ? Math.abs(desired.y - door.at.y) <= half
      : Math.abs(desired.x - door.at.x) <= half;
    if (!alongOk) continue;

    const passedThrough = throughX
      ? (door.at.x < bounds.x ? desired.x < inner.x : desired.x > inner.x + inner.w)
      : (door.at.y < bounds.y ? desired.y < inner.y : desired.y > inner.y + inner.h);
    if (!passedThrough) continue;

    const to = otherSide(door, room);
    const toBounds = roomById(house, to).bounds;
    return {
      room: to,
      at: clampInside(desired, ACTOR_RADIUS, toBounds),
      crossed: door.id,
    };
  }

  return { room, at: clampInside(desired, ACTOR_RADIUS, bounds), crossed: null };
}
