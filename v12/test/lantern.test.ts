import { createSim } from '../src/core/sim';
import { applyLanternAction } from '../src/core/lantern';
import { HOLLOW } from '../src/house/hollow';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function simWithActorAt(room: string) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.actors[0]!.room = room;
  const b = HOLLOW.rooms.find(r => r.id === room)!.bounds;
  sim.state.actors[0]!.at = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  return sim;
}

describe('lantern actions', () => {
  it('picks up a placed lantern in the same room', () => {
    const sim = simWithActorAt('shared_bedroom');
    const r = applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' });
    expect(r.ok).toBe(true);
    expect(sim.state.lanterns[0]!.state).toEqual({ kind: 'held', by: 'bell' });
    expect(sim.state.actors[0]!.carrying).toBe('lantern');
  });

  it('refuses to pick up a lantern in another room', () => {
    const sim = simWithActorAt('attic');
    expect(applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' }).ok).toBe(false);
  });

  // rules §5 ("Carrying one") — you cannot hold a lantern while carrying a sock
  it('refuses to pick up a lantern while carrying a sock', () => {
    const sim = simWithActorAt('shared_bedroom');
    sim.state.actors[0]!.carrying = 'sock';
    const r = applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/sock/i);
  });

  // The two lanterns are the whole supply (rules §5: "There are two"). Without
  // this guard a player could scoop up both at once and hold the entire
  // house's light supply single-handed.
  it('refuses to pick up a second lantern while already carrying one', () => {
    const sim = simWithActorAt('shared_bedroom');
    expect(applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' }).ok).toBe(true);
    // Move lantern_b into the same room so only the carrying state, not room
    // matching, is what blocks the second pickup.
    sim.state.lanterns[1]!.state = {
      kind: 'placed', room: 'shared_bedroom', at: { ...sim.state.actors[0]!.at },
      watching: 'd_bed_hearth', lit: true,
    };
    const r = applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_b' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already carrying/i);
  });

  // rules §5 ("Putting one down") — a placed lantern records movement through
  // ONE doorway of the placer's choosing
  it('places a lantern watching a chosen door and emits the choice', () => {
    // lantern_a starts placed in shared_bedroom (see createSim) — pick it up
    // there, then simulate having carried it to kitchen before placing.
    const sim = simWithActorAt('shared_bedroom');
    applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' });
    sim.state.actors[0]!.room = 'kitchen';
    const r = applyLanternAction(sim, 'bell', { kind: 'place', watching: 'd_hearth_kitchen' });
    expect(r.ok).toBe(true);
    const placed = sim.state.lanterns[0]!.state;
    expect(placed).toMatchObject({ kind: 'placed', room: 'kitchen', watching: 'd_hearth_kitchen', lit: true });
    expect(sim.drain().some(e => e.kind === 'lantern.place' && e.watching === 'd_hearth_kitchen')).toBe(true);
    // rules §5 — carrying "doesn't record anything" and costs the ability to
    // carry a sock; once placed you are no longer carrying it, or every later
    // action (hide, pick up a sock) would wrongly see you as still laden.
    expect(sim.state.actors[0]!.carrying).toBe('none');
  });

  it('refuses to watch a door that is not an exit of the room', () => {
    // Same pickup-then-carry-to-kitchen setup as above; d_attic_playroom is
    // an attic/playroom door and not an exit of kitchen.
    const sim = simWithActorAt('shared_bedroom');
    applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' });
    sim.state.actors[0]!.room = 'kitchen';
    expect(applyLanternAction(sim, 'bell', { kind: 'place', watching: 'd_attic_playroom' }).ok).toBe(false);
  });

  it('snuffing unlights a placed lantern and relighting restores it', () => {
    const sim = simWithActorAt('shared_bedroom');
    expect(applyLanternAction(sim, 'bell', { kind: 'snuff', lantern: 'lantern_a' }).ok).toBe(true);
    expect(sim.lightSources().some(s => s.room === 'shared_bedroom')).toBe(false);
    expect(applyLanternAction(sim, 'bell', { kind: 'relight', lantern: 'lantern_a' }).ok).toBe(true);
    expect(sim.lightSources().some(s => s.room === 'shared_bedroom')).toBe(true);
  });

  it('refuses to snuff or relight a lantern in a different room', () => {
    // lantern_b is placed in the hearth (see createSim); bell is elsewhere.
    const sim = simWithActorAt('shared_bedroom');
    const snuffed = applyLanternAction(sim, 'bell', { kind: 'snuff', lantern: 'lantern_b' });
    expect(snuffed.ok).toBe(false);
    expect(sim.lightSources().some(s => s.room === 'hearth')).toBe(true);
    expect(applyLanternAction(sim, 'bell', { kind: 'relight', lantern: 'lantern_b' }).ok).toBe(false);
  });
});
