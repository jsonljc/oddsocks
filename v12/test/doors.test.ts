import { createSim, HIDE_TICKS } from '../src/core/sim';
import { stepPosition } from '../src/core/movement';
import { HOLLOW } from '../src/house/hollow';
import { roomById } from '../src/core/house';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

describe('closed doors', () => {
  it('blocks a crossing that would otherwise succeed', () => {
    const door = HOLLOW.doors.find(d => d.id === 'd_hearth_kitchen')!;
    const from = { x: door.at.x - 20, y: door.at.y };
    expect(stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 }, new Set()).room).toBe('kitchen');
    expect(stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 }, new Set(['d_hearth_kitchen'])).room)
      .toBe('hearth');
  });

  // The test above calls stepPosition directly. It would pass even if
  // Sim.step never threaded state.closedDoors through at all — nothing
  // proves the wiring. Drive it through the real Sim, mirroring
  // sim.test.ts's "emits move.enter at walk speed too" (same room, same
  // walk, same door, door open) to show this is the closed-door delta.
  it('blocks movement inside Sim.step, not only in stepPosition directly', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const walker = sim.state.actors[0]!;
    const hearth = roomById(HOLLOW, 'hearth');
    walker.room = 'hearth';
    walker.at = { x: hearth.bounds.x + hearth.bounds.w / 2, y: hearth.bounds.y + hearth.bounds.h / 2 };
    sim.state.closedDoors.add('d_hearth_kitchen');

    for (let i = 0; i < 600; i++) {
      sim.step(new Map([[walker.id, { moveX: 1, moveY: 0, run: false }]]));
    }

    const enters = sim.drain().filter(e => e.kind === 'move.enter');
    expect(enters).toHaveLength(0);
    expect(walker.room).toBe('hearth');
  });
});

describe('toggleDoor', () => {
  it('closes and reopens a door of the room you are standing in, and emits both', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const actor = sim.state.actors[0]!;
    actor.room = 'kitchen';
    expect(sim.toggleDoor(actor.id, 'd_hearth_kitchen').ok).toBe(true);
    expect(sim.state.closedDoors.has('d_hearth_kitchen')).toBe(true);
    expect(sim.toggleDoor(actor.id, 'd_hearth_kitchen').ok).toBe(true);
    expect(sim.state.closedDoors.has('d_hearth_kitchen')).toBe(false);
    const kinds = sim.drain().filter(e => e.kind === 'door.toggle');
    expect(kinds).toHaveLength(2);
  });

  it('refuses a door that is not an exit of your room', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.state.actors[0]!.room = 'kitchen';
    expect(sim.toggleDoor(sim.state.actors[0]!.id, 'd_attic_playroom').ok).toBe(false);
  });
});

describe('hiding', () => {
  // rules §9 — hide BRIEFLY. It must expire on its own.
  it('lasts HIDE_TICKS and then ends', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.beginHide('pike');
    expect(sim.isHidden('pike')).toBe(true);
    for (let i = 0; i < HIDE_TICKS; i++) sim.step(new Map());
    expect(sim.isHidden('pike')).toBe(false);
  });

  it('refuses to hide while carrying anything', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.state.actors.find(a => a.id === 'pike')!.carrying = 'lantern';
    expect(sim.beginHide('pike').ok).toBe(false);
  });
});
