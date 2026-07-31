import type { Graphics } from 'pixi.js';
import { ambientFor, type LightSource } from '../core/light';
import type { House, RoomId } from '../core/house';
import type { Rect, Vec2 } from '../core/geometry';

export interface MaskCircle { x: number; y: number; r: number }

/** Pass-through by position, filtered by room existence only.
 *
 *  Two things this function does NOT do, on purpose, but which are worth
 *  stating plainly rather than leaving a reader to go looking and find
 *  nothing:
 *
 *  1. Room-boundary clipping. A circle here can visually extend past its
 *     own room's walls, and this function doesn't stop it (`core/light.ts`'s
 *     `lightAt` is room-scoped mechanically, but that says nothing about
 *     what gets drawn). Quantified in the Task 9 report: a placed lantern
 *     near a wall can bleed up to 66px of glow into the room next door —
 *     lighting a room v12.2 §13 still calls dark. Task 11 resolved this, but
 *     NOT by changing this function or its tested `{x,y,r}` return shape:
 *     `drawLighting` below no longer calls this for the warm-glow pass,
 *     because clamping needs each source's own room bounds, which this
 *     shape deliberately doesn't carry. See `glowPolygon` and `drawLighting`'s
 *     glow loop. This function is kept as-is — still unclipped, still
 *     exported, still covered by its own tests below — for whatever future
 *     caller only needs source positions and doesn't need clipping (e.g. a
 *     ghost's "which lanterns are lit" view, rules §9, which has no walls to
 *     respect in the first place).
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

/** Approximates a circle of radius `r` centred at (`cx`,`cy`), clipped to
 *  `rect`, as an N-gon: sample `sides` points around the true circle, then
 *  pull each one straight back to the nearest point still inside `rect`.
 *
 *  This is deliberately crude — a true circle-rect intersection has curved
 *  AND straight edges, and clamping each vertex independently instead
 *  flattens the circle's silhouette near a corner rather than rounding it
 *  correctly. For a soft, three-ring additive glow (see `drawLighting`) that
 *  distortion isn't visible. What matters, and what's actually under test
 *  (test/lighting.test.ts), is the one property a crude clamp still
 *  guarantees perfectly: no returned vertex can ever lie outside `rect`, so
 *  nothing drawn from this polygon can bleed into a neighbouring room no
 *  matter how large `r` is or how close to the wall `cx,cy` sits.
 *
 *  Chosen over a Pixi mask (a `Container`/`Graphics` pair with `.mask` set)
 *  for two reasons: it's a pure function testable in plain Node (Pixi mask
 *  alignment across a scrolling `world` container is not — see the report),
 *  and it needed no restructuring of `drawLighting`'s caller-owned-`Graphics`
 *  signature the way a masked sub-container would have. */
export function glowPolygon(cx: number, cy: number, r: number, rect: Rect, sides = 24): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    pts.push({
      x: Math.min(Math.max(cx + Math.cos(angle) * r, rect.x), rect.x + rect.w),
      y: Math.min(Math.max(cy + Math.sin(angle) * r, rect.y), rect.y + rect.h),
    });
  }
  return pts;
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
  //
  // Z-ORDER (Task 10, `render/actors.ts`): whatever wires the scene must
  // append this layer's Graphics BEFORE actors.ts's actor/name layers, so
  // actor bodies composite ABOVE this overlay — otherwise a "silhouette"
  // (alpha as low as 0.51) is nearly swallowed by this overlay's own alpha
  // (up to 0.8648) if painted on top of it instead. See `render/actors.ts`'s
  // "Z-ORDER DECISION" docstring for the full worked numbers.
  //
  // Task 11 ALSO adopted the doors-above-overlay recommendation logged
  // there: `render/rooms.ts`'s `drawRooms` now returns `{floor, doors,
  // labels}` instead of appending them itself, so `app/scenes/night.ts` can
  // sequence this layer between `floor` and `doors`. That turns the
  // GAP-geometry accident described above (most of a door's legibility
  // resting on the untouched 40px strip, not on MAX_OVERLAY) into a
  // structural guarantee instead. Measured whether that changed any actual
  // pixels once on screen, rather than assuming: at a door's 10px-per-side
  // stub inside a dark room (night six, isolated from any nearby lantern
  // glow), painting doors below this overlay (the old order) reads luminance
  // ~12 — barely above the ~9.5 bare-dark-floor background. Painting them
  // above (adopted) reads ~56 at the same pixel: a real, if narrow,
  // legibility change, not merely a theoretical one (see the report and
  // docs/findings/2026-07-29-slice-0-acceptance.md).
  for (const room of house.rooms) {
    layer.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    layer.fill({ color: 0x05040a, alpha: overlayAlphaFor(night, room.id, dark) });
  }

  // Warm pools punched back out of the dark for placed and carried lanterns
  // (v12.2 §5 — a placed lantern "lights up the room" and "stops the Odd
  // Sock grabbing anyone inside the light"). Three nested, widening-and-
  // fading rings approximate a glow falling off from the source.
  //
  // Task 9 by-eye-flagged this brightness balance as possibly reading
  // "~50/50" against an ordinary lit room, unresolved without a running
  // scene to look at. Task 11 measured it directly against the real
  // compositing (Pixi pixel readback, not estimate): a lit lantern's own
  // centre in an otherwise-dark room reads luminance ~114 (RGB 131,111,87)
  // on night six, against ~22 (RGB 24,20,31) for an ordinary lit room with no
  // lantern — roughly 5x, not a toss-up. The finding did not reproduce;
  // nothing here was tuned, because nothing needed to be (see the report and
  // docs/findings/2026-07-29-slice-0-acceptance.md for the full readout).
  //
  // Each ring is a `glowPolygon`, clamped to the SOURCE's OWN room bounds —
  // not a raw, unclipped `layer.circle()` — because an unclipped circle can
  // paint past its own room's walls into the room next door (Task 9's
  // report: up to 66px for a wall-hugging PLACED lantern; see glowPolygon's
  // own docstring for the full worked numbers). Iterates `sources` directly
  // rather than going through `maskCirclesFor` because clamping needs each
  // source's own room bounds, which that function's tested `{x,y,r}` return
  // shape deliberately doesn't carry — see maskCirclesFor's own docstring.
  for (const s of sources) {
    const room = house.rooms.find(r => r.id === s.room);
    if (!room) continue; // same existence filter maskCirclesFor applies
    for (let i = 3; i >= 1; i--) {
      layer.poly(glowPolygon(s.at.x, s.at.y, (s.radius / 3) * i, room.bounds), true);
      layer.fill({ color: 0xffd9a0, alpha: 0.10 * (4 - i) });
    }
  }
}
