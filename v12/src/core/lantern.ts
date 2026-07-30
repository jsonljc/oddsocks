import type { ActorId, LanternId } from './events';
import { exitsOf, type DoorId } from './house';
import type { Sim } from './sim';

export type LanternAction =
  | { kind: 'pickup'; lantern: LanternId }
  | { kind: 'place'; watching: DoorId }
  | { kind: 'snuff'; lantern: LanternId }
  | { kind: 'relight'; lantern: LanternId };

export interface ActionResult { ok: boolean; reason?: string }

export function applyLanternAction(
  sim: Sim, actorId: ActorId, action: LanternAction,
): ActionResult {
  const actor = sim.state.actors.find(a => a.id === actorId);
  if (!actor?.alive) return { ok: false, reason: 'no such living actor' };
  const emit = (kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight',
                lantern: LanternId, watching?: DoorId) =>
    sim.emitLantern(kind, actorId, lantern, actor.room, watching);

  switch (action.kind) {
    case 'pickup': {
      // rules §5 ("Carrying one") — you cannot hold a lantern while carrying a sock
      if (actor.carrying === 'sock') return { ok: false, reason: 'carrying a sock' };
      if (actor.carrying === 'lantern') return { ok: false, reason: 'already carrying a lantern' };
      const l = sim.state.lanterns.find(x => x.id === action.lantern);
      if (!l) return { ok: false, reason: 'no such lantern' };
      if (l.state.kind !== 'placed') return { ok: false, reason: 'lantern is held' };
      if (l.state.room !== actor.room) return { ok: false, reason: 'lantern is elsewhere' };
      l.state = { kind: 'held', by: actorId };
      actor.carrying = 'lantern';
      emit('lantern.carry', l.id);
      return { ok: true };
    }
    case 'place': {
      const l = sim.state.lanterns.find(
        x => x.state.kind === 'held' && x.state.by === actorId);
      if (!l) return { ok: false, reason: 'not carrying a lantern' };
      // rules §5 ("Putting one down") — the watched doorway must be one of this room's exits
      if (!exitsOf(sim.house, actor.room).some(d => d.id === action.watching)) {
        return { ok: false, reason: 'that door is not an exit of this room' };
      }
      l.state = {
        kind: 'placed', room: actor.room, at: { ...actor.at },
        watching: action.watching, lit: true,
      };
      actor.carrying = 'none';
      emit('lantern.place', l.id, action.watching);
      return { ok: true };
    }
    case 'snuff':
    case 'relight': {
      const l = sim.state.lanterns.find(x => x.id === action.lantern);
      if (!l) return { ok: false, reason: 'no such lantern' };
      if (l.state.kind !== 'placed') return { ok: false, reason: 'lantern is held' };
      if (l.state.room !== actor.room) return { ok: false, reason: 'lantern is elsewhere' };
      l.state.lit = action.kind === 'relight';
      emit(action.kind === 'snuff' ? 'lantern.snuff' : 'lantern.relight', l.id);
      return { ok: true };
    }
  }
}
