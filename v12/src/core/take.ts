import type { ActorId } from './events';
import { dist } from './geometry';
import { DARK_ENOUGH_FOR_TAKE, LANTERN_RADIUS, lightAt } from './light';
import type { Sim } from './sim';

export const CONTACT_RADIUS = 40;
export const INTERVENE_RADIUS = 200;

// v12.2 §7 — "about three seconds of contact". v12.0 left the duration unstated
// and this plan had guessed 1.5 s.
export const TAKE_TICKS = 90;      // 3 s at 30 Hz
export const WARN_AT_TICKS = 30;   // 1 s of warning before it lands

export type TakeBlock =
  | 'too-lit' | 'lantern-protected' | 'witness'
  | 'out-of-contact' | 'night-one' | 'carrying';

export type TakeCheck = { ok: true } | { ok: false; reason: TakeBlock };

export function canTake(sim: Sim, takerId: ActorId, victimId: ActorId): TakeCheck {
  // rules §8 — no Take is possible on Night One. The victim would have no
  // information with which to have chosen differently.
  if (sim.state.night <= 1) return { ok: false, reason: 'night-one' };

  const taker = sim.state.actors.find(a => a.id === takerId);
  const victim = sim.state.actors.find(a => a.id === victimId);
  if (!taker?.alive || !victim?.alive) return { ok: false, reason: 'out-of-contact' };

  // rules §11.4 — carrying a sock blocks your special action
  if (taker.carrying === 'sock') return { ok: false, reason: 'carrying' };

  // rules §9 — a hidden child is not there to be taken. Hiding was built in
  // Task 5A; this is the half of it that needed canTake to exist first.
  if (sim.isHidden(victimId)) return { ok: false, reason: 'out-of-contact' };

  if (taker.room !== victim.room) return { ok: false, reason: 'out-of-contact' };
  if (dist(taker.at, victim.at) > CONTACT_RADIUS) return { ok: false, reason: 'out-of-contact' };

  // rules §10.2 — a placed lantern prevents Takes inside its radius. Checked
  // before ambient so the two blocks stay distinguishable to the caller: the
  // UI needs to say WHICH rule stopped you, or the rule cannot be learned.
  for (const l of sim.state.lanterns) {
    if (l.state.kind !== 'placed' || !l.state.lit) continue;
    if (l.state.room !== victim.room) continue;
    if (dist(l.state.at, victim.at) < LANTERN_RADIUS) {
      return { ok: false, reason: 'lantern-protected' };
    }
  }

  const level = lightAt(
    sim.state.night, victim.room, victim.at, sim.lightSources(), sim.darkRooms);
  if (level >= DARK_ENOUGH_FOR_TAKE) return { ok: false, reason: 'too-lit' };

  // rules §12.1 — no second living child close enough to intervene. A hidden
  // child does not qualify: if hiding both saved you and protected everyone
  // near you, it would strictly dominate standing guard.
  const witness = sim.state.actors.some(a =>
    a.alive && a.id !== takerId && a.id !== victimId && !sim.isHidden(a.id)
    && a.room === victim.room && dist(a.at, victim.at) <= INTERVENE_RADIUS);
  if (witness) return { ok: false, reason: 'witness' };

  return { ok: true };
}

export type TakeTick = 'warned' | 'progressing' | 'broken' | 'complete';

export class TakeAttempt {
  private elapsed = 0;
  private done = false;
  private broken = false;
  constructor(readonly taker: ActorId, readonly victim: ActorId) {}

  tick(sim: Sim): TakeTick {
    if (this.done) return 'complete';

    // v12.2 §4 — "Reaching lantern light SAVES you. So does someone else
    // walking in." Once broken, an attempt is dead and stays dead; the taker
    // must call beginTake() again and start the three seconds over.
    //
    // Without this latch the escape only PAUSES the grab: `elapsed` survives,
    // so a victim who reaches light on tick 89 and loses it again is taken on
    // the very next tick of contact — one tick instead of ninety. Escaping
    // would leave you worse off than never having been noticed, which inverts
    // the rule. Measured before this latch existed: baseline completed on tick
    // 90; escape-then-return completed on the tick after the escape.
    if (this.broken) return 'broken';

    const check = canTake(sim, this.taker, this.victim);
    if (!check.ok) {
      this.broken = true;
      sim.setGrabbing(this.taker, false);
      return 'broken';
    }

    // v12.2 §4 — "While the Odd Sock is grabbing you, they move slower than you
    // do. So running actually works." The penalty must be live for the whole
    // attempt, including the warning tick, or the warning buys the victim
    // nothing. Set before the early returns below, cleared on every exit.
    sim.setGrabbing(this.taker, true);

    this.elapsed++;
    const victim = sim.state.actors.find(a => a.id === this.victim)!;

    if (this.elapsed === WARN_AT_TICKS) {
      sim.emitTake('take.warn', this.taker, this.victim, victim.room);
      return 'warned';
    }
    if (this.elapsed >= TAKE_TICKS) {
      victim.alive = false;
      this.done = true;
      sim.setGrabbing(this.taker, false);
      sim.emitTake('take.complete', this.taker, this.victim, victim.room);
      // v12.2 §7 — a muffled noise is heard on that floor
      sim.emitSound('take', victim.room);
      return 'complete';
    }
    return 'progressing';
  }
}

export function beginTake(taker: ActorId, victim: ActorId): TakeAttempt {
  return new TakeAttempt(taker, victim);
}
