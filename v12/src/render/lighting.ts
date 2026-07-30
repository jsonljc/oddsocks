import type { Graphics } from 'pixi.js';
import { ambientFor, type LightSource } from '../core/light';
import type { House, RoomId } from '../core/house';

export interface MaskCircle { x: number; y: number; r: number }

/** Pass-through by position, filtered by room existence only — geometry (how
 *  far a circle may extend before it would visually cross into a neighbouring
 *  room) is a drawing concern for `drawLighting`, not this function's job. */
export function maskCirclesFor(
  sources: readonly LightSource[], house: House,
): MaskCircle[] {
  return sources
    .filter(s => house.rooms.some(r => r.id === s.room))
    .map(s => ({ x: s.at.x, y: s.at.y, r: s.radius }));
}

/** v12.2 §3: "Each room has its own shape, its own sound, and one recognisable
 *  object in it. Dark rooms hide who you are. They never hide where the doors
 *  are." So the overlay is capped well below opaque — the room silhouette and
 *  its exits stay legible at every night. */
export const MAX_OVERLAY = 0.92;

/** Per room, because darkness is per room (v12.2 §13's "faint light almost
 *  everywhere"). A dark room and a faintly lit one must look different from a
 *  doorway — that readability is the whole point of slice 0. */
export function overlayAlphaFor(
  night: number, room: RoomId, dark: ReadonlySet<RoomId>,
): number {
  return Math.min((1 - ambientFor(night, room, dark)) * MAX_OVERLAY, MAX_OVERLAY);
}

export function drawLighting(
  layer: Graphics, house: House, night: number,
  sources: readonly LightSource[], dark: ReadonlySet<RoomId>,
): void {
  layer.clear();
  for (const room of house.rooms) {
    layer.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    layer.fill({ color: 0x05040a, alpha: overlayAlphaFor(night, room.id, dark) });
  }

  // Warm pools punched back out of the dark for placed and carried lanterns
  // (v12.2 §5 — a placed lantern "lights up the room" and "stops the Odd
  // Sock grabbing anyone inside the light"). Three nested, widening-and-
  // fading circles approximate a glow falling off from the source; exact
  // brightness balance against the dark overlay is a by-eye call, not
  // something this function can prove correct on its own (see task report).
  for (const c of maskCirclesFor(sources, house)) {
    for (let i = 3; i >= 1; i--) {
      layer.circle(c.x, c.y, (c.r / 3) * i);
      layer.fill({ color: 0xffd9a0, alpha: 0.10 * (4 - i) });
    }
  }
}
