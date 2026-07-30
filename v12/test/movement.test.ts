import { stepPosition } from '../src/core/movement';
import { HOLLOW } from '../src/house/hollow';
import { roomById } from '../src/core/house';

const kitchen = roomById(HOLLOW, 'kitchen');

describe('stepPosition', () => {
  it('moves freely inside a room', () => {
    const from = { x: kitchen.bounds.x + 100, y: kitchen.bounds.y + 100 };
    const r = stepPosition(HOLLOW, 'kitchen', from, { x: 10, y: 0 });
    expect(r.room).toBe('kitchen');
    expect(r.at.x).toBeCloseTo(from.x + 10);
  });

  it('is stopped by a wall away from any door', () => {
    const from = { x: kitchen.bounds.x + 10, y: kitchen.bounds.y + 10 };
    const r = stepPosition(HOLLOW, 'kitchen', from, { x: -500, y: 0 });
    expect(r.room).toBe('kitchen');
    expect(r.at.x).toBeGreaterThanOrEqual(kitchen.bounds.x);
  });

  it('transfers to the neighbouring room when crossing a door span', () => {
    const door = HOLLOW.doors.find(d => d.id === 'd_hearth_kitchen')!;
    const from = { x: door.at.x - 20, y: door.at.y };
    const r = stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 });
    expect(r.room).toBe('kitchen');
    expect(r.crossed).toBe('d_hearth_kitchen');
  });

  it('does not transfer when crossing the same wall outside the door span', () => {
    const door = HOLLOW.doors.find(d => d.id === 'd_hearth_kitchen')!;
    const from = { x: door.at.x - 20, y: door.at.y + door.span };
    const r = stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 });
    expect(r.room).toBe('hearth');
    expect(r.crossed).toBeNull();
  });

  // REGRESSION — an earlier version of stepPosition checked pointInRect
  // against the room's raw bounds instead of the ACTOR_RADIUS-shrunk box.
  // clampInside() (which does shrink by the radius) then snapped every such
  // position back to (wall - ACTOR_RADIUS), a fixed point no walk- or
  // run-speed tick could ever escape: an actor approaching a real doorway one
  // small step at a time never reached it, at any speed. This walks in
  // increments far smaller than a single test-authored jump, the way the sim
  // actually calls this function every tick, and must still arrive.
  it('reaches a door through many small steps, not just one big jump', () => {
    const hearth = roomById(HOLLOW, 'hearth');
    let room: string = 'hearth';
    let at = { x: hearth.bounds.x + hearth.bounds.w / 2, y: hearth.bounds.y + hearth.bounds.h / 2 };
    const smallStep = { x: 2, y: 0 }; // well under ACTOR_RADIUS, unlike the 60-unit jump above
    let crossed: string | null = null;
    for (let i = 0; i < 500 && !crossed; i++) {
      const r = stepPosition(HOLLOW, room, at, smallStep);
      at = r.at;
      room = r.room;
      crossed = r.crossed;
    }
    expect(crossed).toBe('d_hearth_kitchen');
    expect(room).toBe('kitchen');
  });
});
