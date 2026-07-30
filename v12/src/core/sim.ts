import { makeSink, type ActorId, type EventSink, type LanternId, type MatchEvent, type SoundKind } from './events';
import type { Vec2 } from './geometry';
import { exitsOf, roomById, type DoorId, type House, type RoomId } from './house';
import { CARRIED_LANTERN_RADIUS, LANTERN_RADIUS, darkRoomsFor, type LightSource } from './light';
import { ACTOR_RADIUS, stepPosition } from './movement';
import { makeRng } from './rng';

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;

export const WALK_SPEED = 110;      // px/s
export const RUN_SPEED = 190;
export const CARRY_SLOWDOWN = 0.8;  // rules §10.1 — carrying a lantern is slower

/** v12.2 §4 — the grabber moves slower than their target for the whole attempt.
 *  This is what makes the warning window mean something: a target with somewhere
 *  to run can outpace a grab in progress. */
export const GRAB_SPEED_PENALTY = 0.55;

// rules §9/§20 — a moving player emits a footstep on this cadence. Running is
// faster and therefore louder in frequency, which is how a listener tells
// hurried movement from careful movement without being told.
export const WALK_STEP_TICKS = 18;
export const RUN_STEP_TICKS = 11;

// rules §9 — how long a hide lasts. See Sim.beginHide for why brief matters.
export const HIDE_TICKS = 60; // 2s at TICK_HZ

export interface Input { moveX: number; moveY: number; run: boolean }

export interface Actor {
  id: ActorId; room: RoomId; at: Vec2; alive: boolean;
  carrying: 'none' | 'lantern' | 'sock';
  stepCooldown: number;
  hiddenUntilTick: number; // 0 when not hiding
  grabbing: boolean; // v12.2 §4 — true while this actor is mid-Take as the taker
}

export type LanternState =
  | { kind: 'held'; by: ActorId }
  | { kind: 'placed'; room: RoomId; at: Vec2; watching: DoorId; lit: boolean };

export interface Lantern { id: LanternId; state: LanternState }

export interface SimState {
  tick: number; night: number; actors: Actor[]; lanterns: Lantern[];
  closedDoors: Set<DoorId>;
}

export class Sim {
  readonly state: SimState;
  private readonly sink: EventSink = makeSink();

  constructor(readonly house: House, private readonly seed: number, actorIds: ActorId[]) {
    const rng = makeRng(seed);
    // rules §8: six different starting rooms, one player each, randomised.
    const pool = this.house.rooms.filter(r => r.id !== 'hearth').map(r => r.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    this.state = {
      tick: 0,
      night: 1,
      actors: actorIds.map((id, i) => {
        const room = pool[i]!;
        const b = roomById(this.house, room).bounds;
        return {
          id, room, alive: true, carrying: 'none' as const, stepCooldown: 0,
          hiddenUntilTick: 0, grabbing: false,
          at: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
        };
      }),
      lanterns: [
        { id: 'lantern_a', state: { kind: 'placed', room: 'shared_bedroom', at: { x: 0, y: 0 }, watching: 'd_bed_hearth', lit: true } },
        { id: 'lantern_b', state: { kind: 'placed', room: 'hearth', at: { x: 0, y: 0 }, watching: 'd_hearth_kitchen', lit: true } },
      ],
      closedDoors: new Set(),
    };
    // Park the starting lanterns at their room centres.
    for (const l of this.state.lanterns) {
      if (l.state.kind !== 'placed') continue;
      const b = roomById(this.house, l.state.room).bounds;
      l.state.at = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }
  }

  step(inputs: Map<ActorId, Input>): void {
    this.state.tick++;
    for (const actor of this.state.actors) {
      if (!actor.alive) continue;
      const input = inputs.get(actor.id);
      if (!input) continue;

      const len = Math.hypot(input.moveX, input.moveY);
      if (len === 0) continue;
      let speed = input.run ? RUN_SPEED : WALK_SPEED;
      if (actor.carrying === 'lantern') speed *= CARRY_SLOWDOWN;
      if (actor.grabbing) speed *= GRAB_SPEED_PENALTY;

      const delta = {
        x: (input.moveX / len) * speed * DT,
        y: (input.moveY / len) * speed * DT,
      };
      const result = stepPosition(this.house, actor.room, actor.at, delta, this.state.closedDoors);
      actor.at = result.at;
      if (result.crossed) {
        actor.room = result.room;
        this.sink.emit({
          kind: 'move.enter', tick: this.state.tick, night: this.state.night,
          actor: actor.id, room: result.room, via: result.crossed,
        });
      }

      // rules §9 — footsteps remain perceptible however dark it gets. This is
      // the only channel by which a player learns someone is in the next room.
      if (actor.stepCooldown > 0) actor.stepCooldown--;
      if (actor.stepCooldown === 0) {
        actor.stepCooldown = input.run ? RUN_STEP_TICKS : WALK_STEP_TICKS;
        this.sink.emit({
          kind: 'step', tick: this.state.tick, night: this.state.night,
          actor: actor.id, room: actor.room,
          floor: roomById(this.house, actor.room).floor, hurried: input.run,
        });
      }
    }
  }

  /** v12.2 §13 — which rooms are dark tonight. A getter rather than a field
   *  because both the scene and the tests set `state.night` directly, and a
   *  cached set would silently go stale the moment they did. `darkRoomsFor` is
   *  deterministic from (house, night, seed), so this stays replay-safe. */
  get darkRooms(): ReadonlySet<RoomId> {
    return darkRoomsFor(this.house, this.state.night, this.seed);
  }

  lightSources(): LightSource[] {
    const out: LightSource[] = [];
    for (const l of this.state.lanterns) {
      if (l.state.kind === 'placed') {
        if (l.state.lit) out.push({ room: l.state.room, at: l.state.at, radius: LANTERN_RADIUS });
      } else {
        const holderId = l.state.by;
        const holder = this.state.actors.find(a => a.id === holderId);
        if (holder?.alive) {
          out.push({ room: holder.room, at: holder.at, radius: CARRIED_LANTERN_RADIUS });
        }
      }
    }
    return out;
  }

  drain(): MatchEvent[] { return this.sink.drain(); }

  isHidden(id: ActorId): boolean {
    const a = this.state.actors.find(x => x.id === id);
    return !!a && a.alive && a.hiddenUntilTick > this.state.tick;
  }

  /** rules §9 — hide BRIEFLY behind furniture. Brief is the whole point: it
   *  buys you the length of a Take's warning window and nothing more. */
  beginHide(id: ActorId): { ok: boolean; reason?: string } {
    const a = this.state.actors.find(x => x.id === id);
    if (!a?.alive) return { ok: false, reason: 'no such living actor' };
    if (a.carrying !== 'none') return { ok: false, reason: 'carrying something' };
    a.hiddenUntilTick = this.state.tick + HIDE_TICKS;
    return { ok: true };
  }

  /** v12.2 §4 — on while a Take attempt is holding this actor as the taker.
   *  core/take.ts flips this every tick of an attempt (true while it stands,
   *  false the instant it breaks or completes) so the speed penalty in `step`
   *  never outlives the attempt that earned it. */
  setGrabbing(id: ActorId, on: boolean): void {
    const a = this.state.actors.find(x => x.id === id);
    if (a) a.grabbing = on;
  }

  /** The only door into the event sink for action modules outside this file
   *  (e.g. core/lantern.ts, core/take.ts) — they get `house` and `state`
   *  read-only access but the sink itself stays private to Sim. */
  emitLantern(
    kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight',
    actor: ActorId, lantern: LanternId, room: RoomId, watching?: DoorId,
  ): void {
    this.sink.emit({ kind, tick: this.state.tick, night: this.state.night, actor, lantern, room, watching });
  }

  emitTake(kind: 'take.warn' | 'take.complete', actor: ActorId, victim: ActorId, room: RoomId): void {
    this.sink.emit({ kind, tick: this.state.tick, night: this.state.night, actor, victim, room });
  }

  emitSound(sound: SoundKind, room: RoomId): void {
    this.sink.emit({
      kind: 'sound', tick: this.state.tick, night: this.state.night,
      floor: roomById(this.house, room).floor, sound, room,
    });
  }

  toggleDoor(actorId: ActorId, doorId: DoorId): { ok: boolean; reason?: string } {
    const a = this.state.actors.find(x => x.id === actorId);
    if (!a?.alive) return { ok: false, reason: 'no such living actor' };
    if (!exitsOf(this.house, a.room).some(d => d.id === doorId)) {
      return { ok: false, reason: 'that door is not an exit of this room' };
    }
    // Set.delete() returns true iff the door WAS closed — i.e. this call is
    // the one that reopens it. `open` names the state the door is in after
    // this toggle, for both the emitted event and the caller.
    const open = this.state.closedDoors.delete(doorId);
    if (!open) this.state.closedDoors.add(doorId);
    this.sink.emit({
      kind: 'door.toggle', tick: this.state.tick, night: this.state.night,
      actor: actorId, door: doorId, open,
    });
    return { ok: true };
  }
}

export function createSim(house: House, seed: number, actorIds: ActorId[]): Sim {
  return new Sim(house, seed, actorIds);
}

export { ACTOR_RADIUS };
