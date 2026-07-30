import type { Graphics } from 'pixi.js';
import { ambientFor, type LightSource } from '../core/light';
import type { House, RoomId } from '../core/house';

export interface MaskCircle { x: number; y: number; r: number }

/** Pass-through by position, filtered by room existence only.
 *
 *  Two things this function does NOT do, on purpose, but which are worth
 *  stating plainly rather than leaving a reader to go looking and find
 *  nothing:
 *
 *  1. Room-boundary clipping. A circle here can visually extend past its
 *     own room's walls — this function doesn't stop it, and neither does
 *     `drawLighting` below, which draws these circles unmodified. That is
 *     not implemented anywhere yet (`core/light.ts`'s `lightAt` is
 *     room-scoped mechanically, but that says nothing about what gets
 *     drawn). Quantified in the Task 9 report: a placed lantern near a wall
 *     can bleed up to 66px of glow into the room next door.
 *  2. Lit-state filtering. `LightSource` has no `lit` flag, and this only
 *     filters on room existence — same caller contract as `lightAt`'s
 *     `sources` parameter, in the same file. The caller (today, always
 *     `Sim.lightSources()`) must pass only currently-lit sources; a future
 *     caller that maps every lantern in without checking would draw a warm
 *     glow for a snuffed one. */
export function maskCirclesFor(
  sources: readonly LightSource[], house: House,
): MaskCircle[] {
  return sources
    .filter(s => house.rooms.some(r => r.id === s.room))
    .map(s => ({ x: s.at.x, y: s.at.y, r: s.radius }));
}

/** v12.2 §3: "Each room has its own shape, its own sound, and one recognisable
 *  object in it. Dark rooms hide who you are. They never hide where the doors
 *  are." So the overlay is capped well below opaque — the room SILHOUETTE
 *  stays legible at every night, at every alpha this cap allows.
 *
 *  This cap is NOT what keeps the doors (the "exits" half of that §3
 *  guarantee) legible today — or at least not primarily. See the
 *  cross-reference at `drawLighting`'s per-room paint loop, below, and at
 *  `GAP` in `house/hollow.ts`. */
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
  // Paints ONLY each room's own `bounds` rect — never the GAP between rooms
  // (see `GAP` in `house/hollow.ts`, which cross-references back here). Every
  // door's rect straddles that gap: 10px inside each room, 40px of every 60px
  // span in the untouched gap (true for every door in HOLLOW — see the Task 9
  // report for the exact per-edge numbers). So today, most of a door's
  // legibility in the dark rests on that untouched strip, not on
  // MAX_OVERLAY's cap. Switch this to one world-sized rect (or shrink GAP)
  // and that protection disappears — nothing here would catch it.
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
