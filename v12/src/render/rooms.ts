import { Container, Graphics, Text } from 'pixi.js';
import type { House } from '../core/house';

export interface RoomLayers { floor: Graphics; doors: Graphics; labels: Container }

/** v12.2 §3: "Each room has its own shape, its own sound, and one recognisable
 *  object in it." Placeholder art, real geometry — every rect and door drawn
 *  here is the house's actual layout, not a mockup of it.
 *
 *  DECISION (Task 11, resolving the recommendation logged at
 *  `render/actors.ts`'s "Z-ORDER DECISION" and `render/lighting.ts`'s
 *  `drawLighting`): this used to take `world` and append floor, doors and
 *  labels into it directly, in that order, with no seam for a caller to put
 *  anything BETWEEN them. That made "doors above the lighting overlay" — the
 *  structural fix for a door's legibility resting on the untouched
 *  inter-room GAP rather than on a rule — impossible to wire without this
 *  restructuring. Adopted: `drawRooms` now builds all three layers but
 *  appends none of them, and returns them for the caller
 *  (`app/scenes/night.ts`) to sequence, interleaving the lighting layer
 *  between `floor` and `doors`:
 *
 *    world.addChild(floor); world.addChild(lighting); world.addChild(doors, labels);
 *
 *  giving the full recommended stack floor -> lighting -> doors -> labels ->
 *  actors -> names. Nothing tested this module's old void/side-effecting
 *  signature (Pixi's `Text` throws `document is not defined` under Node —
 *  see the report — so `drawRooms` was never callable from `vitest` in
 *  either shape), so this restructuring breaks no test. */
export function drawRooms(house: House): RoomLayers {
  const floor = new Graphics();
  for (const room of house.rooms) {
    floor.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    floor.fill({ color: 0x2a2434 });
    floor.stroke({ color: 0x4a3f57, width: 3 });
  }

  const doors = new Graphics();
  for (const d of house.doors) {
    doors.rect(d.at.x - d.span / 2, d.at.y - d.span / 2, d.span, d.span);
    doors.fill({ color: d.kind === 'stair' ? 0x6b5a3e : 0x3d3348 });
  }

  const labels = new Container();
  for (const room of house.rooms) {
    const label = new Text({
      text: `${room.name}\n${room.centralObject}`,
      style: { fill: 0x8a7f9a, fontSize: 16, align: 'center' },
    });
    label.x = room.bounds.x + 12;
    label.y = room.bounds.y + 12;
    labels.addChild(label);
  }

  return { floor, doors, labels };
}
