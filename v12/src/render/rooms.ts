import { Container, Graphics, Text } from 'pixi.js';
import type { House } from '../core/house';

/** v12.2 §3: "Each room has its own shape, its own sound, and one recognisable
 *  object in it." Placeholder art, real geometry — every rect and door drawn
 *  here is the house's actual layout, not a mockup of it. */
export function drawRooms(world: Container, house: House): void {
  const floor = new Graphics();
  for (const room of house.rooms) {
    floor.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    floor.fill({ color: 0x2a2434 });
    floor.stroke({ color: 0x4a3f57, width: 3 });
  }
  world.addChild(floor);

  const doors = new Graphics();
  for (const d of house.doors) {
    doors.rect(d.at.x - d.span / 2, d.at.y - d.span / 2, d.span, d.span);
    doors.fill({ color: d.kind === 'stair' ? 0x6b5a3e : 0x3d3348 });
  }
  world.addChild(doors);

  for (const room of house.rooms) {
    const label = new Text({
      text: `${room.name}\n${room.centralObject}`,
      style: { fill: 0x8a7f9a, fontSize: 16, align: 'center' },
    });
    label.x = room.bounds.x + 12;
    label.y = room.bounds.y + 12;
    world.addChild(label);
  }
}
