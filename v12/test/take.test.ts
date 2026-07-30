import { createSim } from '../src/core/sim';
import { applyLanternAction } from '../src/core/lantern';
import { canTake, beginTake, TAKE_TICKS, WARN_AT_TICKS } from '../src/core/take';
import { dist } from '../src/core/geometry';
import { exitsOf } from '../src/core/house';
import { HOLLOW } from '../src/house/hollow';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function pairInDarkRoom(night = 6) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.night = night;
  const b = HOLLOW.rooms.find(r => r.id === 'attic')!.bounds;
  const spot = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  for (const id of ['wren', 'pike']) {
    const a = sim.state.actors.find(x => x.id === id)!;
    a.room = 'attic';
    a.at = { ...spot };
  }
  // Move everyone else far away so they cannot intervene.
  for (const a of sim.state.actors) {
    if (a.id === 'wren' || a.id === 'pike') continue;
    a.room = 'shared_bedroom';
    const c = HOLLOW.rooms.find(r => r.id === 'shared_bedroom')!.bounds;
    a.at = { x: c.x + 20, y: c.y + 20 };
  }
  return sim;
}

describe('canTake', () => {
  it('allows a Take in a dark room with contact and no witness', () => {
    expect(canTake(pairInDarkRoom(), 'wren', 'pike')).toEqual({ ok: true });
  });

  // rules §8 — no Take is possible on Night One
  it('refuses on night one', () => {
    const r = canTake(pairInDarkRoom(1), 'wren', 'pike');
    expect(r).toEqual({ ok: false, reason: 'night-one' });
  });

  // rules §12.1 — available when the room is dark enough
  it('refuses in a lit room', () => {
    const r = canTake(pairInDarkRoom(2), 'wren', 'pike');
    expect(r).toEqual({ ok: false, reason: 'too-lit' });
  });

  // rules §10.2 — a placed lantern prevents Takes inside its radius
  it('refuses inside a placed lantern radius', () => {
    const sim = pairInDarkRoom();
    const wren = sim.state.actors.find(a => a.id === 'wren')!;
    wren.carrying = 'none';
    sim.state.lanterns[0]!.state = {
      kind: 'placed', room: 'attic', at: { ...wren.at }, watching: 'd_attic_playroom', lit: true,
    };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'lantern-protected' });
  });

  // rules §12.1 — no second living child close enough to intervene
  it('refuses when a third living child is close enough to intervene', () => {
    const sim = pairInDarkRoom();
    const witness = sim.state.actors.find(a => a.id === 'clem')!;
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    witness.room = 'attic';
    witness.at = { x: victim.at.x + 30, y: victim.at.y };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'witness' });
  });

  it('refuses out of contact range', () => {
    const sim = pairInDarkRoom();
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    victim.at = { x: victim.at.x + 400, y: victim.at.y };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'out-of-contact' });
  });

  // rules §11.4 — carrying a sock blocks your special action
  it('refuses while the taker carries a sock', () => {
    const sim = pairInDarkRoom();
    sim.state.actors.find(a => a.id === 'wren')!.carrying = 'sock';
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'carrying' });
  });

  // rules §9 — hiding is granted to every player, and Task 5A built it.
  // Its effect on the Take lives here because canTake lives here.
  it('refuses against a hidden victim', () => {
    const sim = pairInDarkRoom();
    expect(canTake(sim, 'wren', 'pike').ok).toBe(true);
    sim.beginHide('pike');
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'out-of-contact' });
  });

  // A hidden child must not also count as the witness that protects someone
  // else — otherwise hiding is strictly better than standing guard, and
  // rules §19's anti-turtling inverts.
  it('does not let a hidden child count as an intervening witness', () => {
    const sim = pairInDarkRoom();
    const clem = sim.state.actors.find(a => a.id === 'clem')!;
    const pike = sim.state.actors.find(a => a.id === 'pike')!;
    clem.room = 'attic';
    clem.at = { x: pike.at.x + 30, y: pike.at.y };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'witness' });
    sim.beginHide('clem');
    expect(canTake(sim, 'wren', 'pike').ok).toBe(true);
  });
});

describe('TakeAttempt', () => {
  // rules §12.1 — a Take is not instant; the target gets a brief warning
  it('warns before it completes', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    const results: string[] = [];
    for (let i = 0; i < TAKE_TICKS + 2; i++) results.push(attempt.tick(sim));
    expect(results[WARN_AT_TICKS - 1]).toBe('warned');
    expect(results[TAKE_TICKS - 1]).toBe('complete');
    expect(sim.drain().some(e => e.kind === 'take.warn')).toBe(true);
  });

  it('breaks when the victim reaches lantern light', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    for (let i = 0; i < WARN_AT_TICKS + 2; i++) attempt.tick(sim);
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    sim.state.lanterns[0]!.state = {
      kind: 'placed', room: 'attic', at: { ...victim.at }, watching: 'd_attic_playroom', lit: true,
    };
    expect(attempt.tick(sim)).toBe('broken');
  });

  // Ticks TAKE_TICKS + 5 times (not just TAKE_TICKS) specifically so the
  // "exactly once" claim is checked past completion, not just at it — and so
  // the trailing assertions below observe several stale ticks, not one.
  it('kills the victim and emits take.complete exactly once', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    let last: string = 'progressing';
    for (let i = 0; i < TAKE_TICKS + 5; i++) last = attempt.tick(sim);
    expect(sim.state.actors.find(a => a.id === 'pike')!.alive).toBe(false);
    expect(sim.drain().filter(e => e.kind === 'take.complete')).toHaveLength(1);

    // The `done` latch's actual job: once complete, ticking further must keep
    // reporting 'complete', not fall through to canTake (which would now see
    // a dead victim and report 'broken' instead — a lie, since nothing broke;
    // the Take had already succeeded). Mutation-tested: removing `this.done =
    // true` does NOT fail the two assertions above (victim.alive and the
    // event count are both already correct by the completing tick, via the
    // canTake alive-check's own protection against a second emit) — only this
    // assertion catches that mutation.
    expect(last).toBe('complete');

    // The grab-speed penalty must not survive a successful Take either.
    // Mutation-tested: removing `sim.setGrabbing(this.taker, false)` from the
    // completion branch made every other test in the whole suite stay green
    // — this line is the only one that catches it.
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(false);
  });

  // v12.2 §4 — "While the Odd Sock is grabbing you, they move slower than you do.
  // So running actually works." Without this the warning window is decoration.
  //
  // Checked at the exact tick that returns 'warned', not one tick later: `grabbing`
  // is a sticky flag, so a version that dropped it only on the warn tick itself
  // (then re-set it on the very next progressing tick) would still read true one
  // tick on — a mutation-tested gap in an earlier draft of this test, which ran
  // WARN_AT_TICKS + 1 ticks before checking and so never observed the warn tick's
  // own state.
  it('slows the grabber for the whole attempt, warning tick included', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    let last: string = 'progressing';
    for (let i = 0; i < WARN_AT_TICKS; i++) last = attempt.tick(sim);
    expect(last).toBe('warned');
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(true);
  });

  it('lets a fleeing target outpace a grab in progress', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    attempt.tick(sim);
    const before = dist(
      sim.state.actors.find(a => a.id === 'wren')!.at,
      sim.state.actors.find(a => a.id === 'pike')!.at);
    for (let i = 0; i < 20; i++) {
      sim.step(new Map([
        ['pike', { moveX: 1, moveY: 0, run: true }],
        ['wren', { moveX: 1, moveY: 0, run: true }],
      ]));
      attempt.tick(sim);
    }
    const after = dist(
      sim.state.actors.find(a => a.id === 'wren')!.at,
      sim.state.actors.find(a => a.id === 'pike')!.at);
    expect(after).toBeGreaterThan(before);
  });

  // v12.2 §4 — "Reaching lantern light saves you." Saves, not delays. This is
  // the test that proves escaping is not merely a pause.
  it('stays broken once broken, even if the interruption goes away', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    for (let i = 0; i < TAKE_TICKS - 1; i++) attempt.tick(sim);

    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    const lantern = sim.state.lanterns[0]!;
    lantern.state = {
      kind: 'placed', room: victim.room, at: { ...victim.at },
      watching: exitsOf(HOLLOW, victim.room)[0]!.id, lit: true,
    };
    expect(attempt.tick(sim)).toBe('broken');

    // The light goes out again. The grab must NOT pick up where it left off.
    (lantern.state as { lit: boolean }).lit = false;
    expect(attempt.tick(sim)).toBe('broken');
    expect(victim.alive).toBe(true);

    // This second tick is the latched-broken early return itself (`if
    // (this.broken) return 'broken'`), not the tick that set the latch. The
    // speed penalty must stay cleared through it too, or a taker who keeps
    // getting ticked after breaking (e.g. a caller that doesn't immediately
    // discard a broken attempt) stays slowed forever. Mutation-tested: a
    // version that (re)sets `grabbing` unconditionally at the top of `tick()`
    // is missed by every other test in this file — including "clears the
    // penalty when the attempt breaks", which only ticks twice and never
    // revisits an already-broken attempt — and is caught only by this line.
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(false);

    // A fresh attempt has to serve the full duration over again.
    const second = beginTake('wren', 'pike');
    for (let i = 0; i < TAKE_TICKS - 1; i++) {
      expect(second.tick(sim)).not.toBe('complete');
    }
    expect(second.tick(sim)).toBe('complete');
  });

  it('clears the penalty when the attempt breaks', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    attempt.tick(sim);
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(true);
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    sim.state.lanterns[0]!.state = {
      kind: 'placed', room: 'attic', at: { ...victim.at }, watching: 'd_attic_playroom', lit: true,
    };
    expect(attempt.tick(sim)).toBe('broken');
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(false);
  });
});
