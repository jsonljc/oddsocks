import type { ActorId } from '../core/events';
import { exitsOf, otherSide, type House, type RoomId } from '../core/house';
import { makeRng } from '../core/rng';
import type { Input, Sim } from '../core/sim';
import { beginTake, canTake, type TakeAttempt } from '../core/take';

export interface Stalker {
  nextInput(sim: Sim): Input;
  tickBehaviour(sim: Sim): void;
}

/** SPEC §9.1: this is a scripted actor and it never produces a number.
 *  It walks a seeded route and attempts a Take when the rules already allow
 *  one. It does not evaluate, score, adapt, or report. If you find yourself
 *  wanting a win rate out of it, that is the signal to read spec §9.1 —
 *  bot defects have mimicked rules defects three times in this repository. */
export function createStalker(house: House, id: ActorId, seed: number): Stalker {
  const rng = makeRng(seed);
  let route: RoomId[] = [];
  let attempt: TakeAttempt | null = null;

  function extendRoute(from: RoomId): void {
    let here = from;
    for (let i = 0; i < 8; i++) {
      const exits = exitsOf(house, here);
      const door = rng.pick(exits);
      here = otherSide(door, here);
      route.push(here);
    }
  }

  return {
    nextInput(sim: Sim): Input {
      const self = sim.state.actors.find(a => a.id === id);
      if (!self?.alive) return { moveX: 0, moveY: 0, run: false };

      // rules §4/§7: a grab needs "about three seconds of contact", and
      // running only saves the target because the grabber is slower — a
      // chase, not a freeze. Without this branch an attempt starts and is
      // immediately abandoned: the patrol logic below steers toward its own
      // next door regardless of any live attempt, dragging the taker out of
      // CONTACT_RADIUS in well under 20 ticks (measured empirically against
      // a stationary, adjacent victim — contact broke at tick 19), 70-odd
      // short of the 90 a Take needs, so a grab could never complete. While
      // an attempt is live, steer toward ITS victim instead of the route.
      // Walking pace only, never run: 0.55x of RUN_SPEED is 104.5 px/s,
      // still under a merely-walking victim's 110 px/s, but by a 5.5 px/s
      // margin a future speed tune could invert; walking pace (60.5 px/s)
      // keeps "the grabber is always slower" true with headroom. The route
      // is left untouched on purpose: canTake requires taker and victim to
      // share a room, so this steers to a point inside the room the stalker
      // is already in and never crosses a door, so `route` cannot go stale.
      if (attempt) {
        const victimId = attempt.victim;
        const victim = sim.state.actors.find(a => a.id === victimId);
        if (!victim?.alive) return { moveX: 0, moveY: 0, run: false };
        const dx = victim.at.x - self.at.x, dy = victim.at.y - self.at.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return { moveX: 0, moveY: 0, run: false };
        return { moveX: dx / len, moveY: dy / len, run: false };
      }

      if (route.length === 0) extendRoute(self.room);

      const target = route[0]!;
      if (self.room === target) { route.shift(); }

      const next = route[0];
      if (!next) return { moveX: 0, moveY: 0, run: false };

      // Steer toward the door that leads to the next room on the route. If no
      // such door exists the route is stale, so drop it and re-plan next tick.
      const door = exitsOf(house, self.room).find(d => otherSide(d, self.room) === next);
      if (!door) { route = []; return { moveX: 0, moveY: 0, run: false }; }

      const dx = door.at.x - self.at.x, dy = door.at.y - self.at.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return { moveX: 0, moveY: 0, run: false };
      return { moveX: dx / len, moveY: dy / len, run: false };
    },

    tickBehaviour(sim: Sim): void {
      if (attempt) {
        const r = attempt.tick(sim);
        if (r === 'complete' || r === 'broken') attempt = null;
        return;
      }
      const self = sim.state.actors.find(a => a.id === id);
      if (!self?.alive) return;
      for (const other of sim.state.actors) {
        if (other.id === id || !other.alive) continue;
        if (canTake(sim, id, other.id).ok) { attempt = beginTake(id, other.id); return; }
      }
    },
  };
}
