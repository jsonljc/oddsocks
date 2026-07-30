import { createSim, type Input } from '../src/core/sim';
import { HOLLOW } from '../src/house/hollow';
import { roomById } from '../src/core/house';
import { makeRng } from '../src/core/rng';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function run(seed: number, ticks: number) {
  const sim = createSim(HOLLOW, seed, IDS);
  const rng = makeRng(seed ^ 0xabcdef);
  const events = [];
  for (let t = 0; t < ticks; t++) {
    const inputs = new Map<string, Input>();
    for (const id of IDS) {
      inputs.set(id, { moveX: rng() * 2 - 1, moveY: rng() * 2 - 1, run: rng() > 0.8 });
    }
    sim.step(inputs);
    events.push(...sim.drain());
  }
  return events;
}

describe('determinism', () => {
  it('produces a byte-identical event stream for the same seed and inputs', () => {
    expect(JSON.stringify(run(1234, 600))).toBe(JSON.stringify(run(1234, 600)));
  });

  it('diverges for a different seed', () => {
    expect(JSON.stringify(run(1234, 600))).not.toBe(JSON.stringify(run(1235, 600)));
  });

  // Guards against a vacuous pass: the byte-identical check above only means
  // something if room crossings are actually part of the stream it compares.
  // Six actors taking random steps for 600 ticks must cross a doorway at
  // least once, or the determinism test is only proving 'step' events replay.
  it('actually exercises room crossings, not only footsteps', () => {
    const enters = run(1234, 600).filter(e => e.kind === 'move.enter');
    expect(enters.length).toBeGreaterThan(0);
  });
});

describe('sim', () => {
  it('starts every actor in a distinct room — rules §8', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const rooms = sim.state.actors.map(a => a.room);
    expect(new Set(rooms).size).toBe(IDS.length);
  });

  it('advances one tick at a time', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.step(new Map());
    expect(sim.state.tick).toBe(1);
  });

  // rules §9 — footsteps and movement remain perceptible
  it('emits footsteps while moving and none while still', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const walker = sim.state.actors[0]!;
    for (let i = 0; i < 60; i++) {
      sim.step(new Map([[walker.id, { moveX: 1, moveY: 0, run: false }]]));
    }
    const walking = sim.drain().filter(e => e.kind === 'step');
    expect(walking.length).toBeGreaterThan(0);
    expect(walking.every(e => e.kind === 'step' && !e.hurried)).toBe(true);

    for (let i = 0; i < 60; i++) sim.step(new Map());
    expect(sim.drain().filter(e => e.kind === 'step')).toHaveLength(0);
  });

  it('emits footsteps more often when running than when walking', () => {
    const count = (run: boolean) => {
      const sim = createSim(HOLLOW, 42, IDS);
      const id = sim.state.actors[0]!.id;
      for (let i = 0; i < 120; i++) sim.step(new Map([[id, { moveX: 1, moveY: 0, run }]]));
      return sim.drain().filter(e => e.kind === 'step').length;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });

  it('emits move.enter when an actor changes room', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const walker = sim.state.actors[0]!;
    for (let i = 0; i < 600; i++) {
      sim.step(new Map([[walker.id, { moveX: 1, moveY: 0, run: true }]]));
    }
    const enters = sim.drain().filter(e => e.kind === 'move.enter');
    expect(enters.length).toBeGreaterThan(0);
  });

  // REGRESSION — the test above only drives run:true. An earlier stepPosition
  // crossed a doorway at run speed by a hair (a coincidence of ACTOR_RADIUS,
  // the room gap and the door span) and soft-locked forever at walk speed,
  // which this test catches. Room and position are set explicitly rather than
  // relying on the seed's starting-room shuffle, so this doesn't depend on
  // which room actor 0 happens to land in.
  it('emits move.enter at walk speed too, not only when running', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const walker = sim.state.actors[0]!;
    const hearth = roomById(HOLLOW, 'hearth');
    walker.room = 'hearth';
    walker.at = { x: hearth.bounds.x + hearth.bounds.w / 2, y: hearth.bounds.y + hearth.bounds.h / 2 };
    for (let i = 0; i < 600; i++) {
      sim.step(new Map([[walker.id, { moveX: 1, moveY: 0, run: false }]]));
    }
    const enters = sim.drain().filter(e => e.kind === 'move.enter');
    expect(enters.length).toBeGreaterThan(0);
  });
});
