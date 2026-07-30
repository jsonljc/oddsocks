import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSim } from '../src/core/sim';
import { createStalker } from '../src/scripted/stalker';
import { HOLLOW } from '../src/house/hollow';
import { TAKE_TICKS, WARN_AT_TICKS } from '../src/core/take';

// "type": "module" — no __dirname.
const STALKER_SRC = fileURLToPath(new URL('../src/scripted/stalker.ts', import.meta.url));

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function walk(seed: number, ticks: number) {
  const sim = createSim(HOLLOW, 99, IDS);
  const stalker = createStalker(HOLLOW, 'wren', seed);
  const path: string[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step(new Map([['wren', stalker.nextInput(sim)]]));
    stalker.tickBehaviour(sim);
    path.push(sim.state.actors.find(a => a.id === 'wren')!.room);
  }
  return path;
}

describe('scripted stalker', () => {
  it('follows an identical path for the same seed', () => {
    expect(walk(7, 900)).toEqual(walk(7, 900));
  });

  it('follows a different path for a different seed', () => {
    expect(walk(7, 900)).not.toEqual(walk(8, 900));
  });

  it('actually leaves its starting room', () => {
    expect(new Set(walk(7, 900)).size).toBeGreaterThan(1);
  });

  // spec §9.1 — a scripted actor, never a measurement instrument
  it('exposes no metrics surface', () => {
    const src = readFileSync(STALKER_SRC, 'utf8');
    expect(src).not.toMatch(/winRate|stats|metrics|counter|tally/i);
    const stalker = createStalker(HOLLOW, 'wren', 7);
    expect(Object.keys(stalker).sort()).toEqual(['nextInput', 'tickBehaviour']);
  });
});

// The four tests above all run at night 1, where canTake() short-circuits on
// 'night-one' before any argument-order-sensitive check — so tickBehaviour's
// entire grab-attempt branch (the reason this file exists at all, per the
// brief: "attempts a grab when the rules already allow one") is untouched by
// any of them. It could be an empty function body and the suite above would
// stay green. These tests drive the actual grab machinery, night 6, the same
// hand-positioned-dark-room shape core/take.ts's own tests use.
function pairInDarkRoom(night = 6) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.night = night;
  const b = HOLLOW.rooms.find(r => r.id === 'attic')!.bounds;
  const spot = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  for (const pid of ['wren', 'pike']) {
    const a = sim.state.actors.find(x => x.id === pid)!;
    a.room = 'attic';
    a.at = { ...spot };
  }
  // Move everyone else far away so nobody can witness and block the grab.
  for (const a of sim.state.actors) {
    if (a.id === 'wren' || a.id === 'pike') continue;
    a.room = 'shared_bedroom';
    const c = HOLLOW.rooms.find(r => r.id === 'shared_bedroom')!.bounds;
    a.at = { x: c.x + 20, y: c.y + 20 };
  }
  return sim;
}

describe('scripted stalker: the grab', () => {
  // This is the empirical finding: a first draft of nextInput steered toward
  // the route's next door unconditionally, even mid-attempt. Measured against
  // a victim standing at zero distance, contact (CONTACT_RADIUS = 40) broke
  // by tick 19 — 70-odd ticks short of TAKE_TICKS — and across 3000 ticks
  // (100 simulated seconds, more than a full 90-second night) no grab ever
  // completed. Fixed by steering at the attempt's victim instead of the
  // route while an attempt is live. This test is what "attempts a grab when
  // the rules already allow one" actually means, made concrete.
  it('completes a grab against a stationary victim through its own tick loop', () => {
    const sim = pairInDarkRoom();
    const stalker = createStalker(HOLLOW, 'wren', 7);
    for (let t = 0; t < TAKE_TICKS + 5; t++) {
      sim.step(new Map([['wren', stalker.nextInput(sim)]]));
      stalker.tickBehaviour(sim);
    }
    expect(sim.state.actors.find(a => a.id === 'pike')!.alive).toBe(false);
    expect(sim.drain().filter(e => e.kind === 'take.complete')).toHaveLength(1);
  });

  // Per the brief's own note: a broken TakeAttempt latches broken and cannot
  // resume (core/take.ts), so the stalker MUST discard it and call
  // beginTake() again — otherwise a once-interrupted stalker could never
  // grab anyone for the rest of the match. Proven here by an interruption
  // partway through, not just at the very start.
  it('discards a broken attempt and serves the full duration again, not a resumed remainder', () => {
    const sim = pairInDarkRoom();
    const stalker = createStalker(HOLLOW, 'wren', 7);
    const clem = sim.state.actors.find(a => a.id === 'clem')!;
    const pike = sim.state.actors.find(a => a.id === 'pike')!;

    // Run well past the warning tick but nowhere near completion.
    for (let t = 0; t < WARN_AT_TICKS + 5; t++) {
      sim.step(new Map([['wren', stalker.nextInput(sim)]]));
      stalker.tickBehaviour(sim);
    }
    expect(pike.alive).toBe(true);

    // A witness walks in: canTake now reports 'witness', breaking the
    // in-progress attempt on the very next tick.
    clem.room = 'attic';
    clem.at = { x: pike.at.x + 30, y: pike.at.y };
    sim.step(new Map([['wren', stalker.nextInput(sim)]]));
    stalker.tickBehaviour(sim);

    // The witness leaves again, before tickBehaviour's next call (which is
    // the one that rescans for a target now that `attempt` is null).
    const bed = HOLLOW.rooms.find(r => r.id === 'shared_bedroom')!.bounds;
    clem.room = 'shared_bedroom';
    clem.at = { x: bed.x + 20, y: bed.y + 20 };

    // A RESUMED attempt (old elapsed count kept) would complete almost
    // immediately from here — it was already past the warning tick. A
    // correctly-restarted attempt needs the full TAKE_TICKS again.
    for (let t = 0; t < TAKE_TICKS - 1; t++) {
      sim.step(new Map([['wren', stalker.nextInput(sim)]]));
      stalker.tickBehaviour(sim);
    }
    expect(pike.alive).toBe(true);

    for (let t = 0; t < 5; t++) {
      sim.step(new Map([['wren', stalker.nextInput(sim)]]));
      stalker.tickBehaviour(sim);
    }
    expect(pike.alive).toBe(false);
  });

  // The chase steers at the victim only while `attempt` is live and never
  // touches `route`; once the victim is gone the very next tickBehaviour
  // scan finds nobody left to take (everyone else is in a different room)
  // and nextInput must fall back to patrolling rather than idling forever.
  it('resumes patrol movement once nobody is left to grab', () => {
    const sim = pairInDarkRoom();
    const stalker = createStalker(HOLLOW, 'wren', 7);
    for (let t = 0; t < TAKE_TICKS + 5; t++) {
      sim.step(new Map([['wren', stalker.nextInput(sim)]]));
      stalker.tickBehaviour(sim);
    }
    expect(sim.state.actors.find(a => a.id === 'pike')!.alive).toBe(false);

    let sawMovement = false;
    for (let t = 0; t < 30; t++) {
      const input = stalker.nextInput(sim);
      sim.step(new Map([['wren', input]]));
      stalker.tickBehaviour(sim);
      if (Math.hypot(input.moveX, input.moveY) > 0) sawMovement = true;
    }
    expect(sawMovement).toBe(true);
  });
});
