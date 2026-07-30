import type { Rect, Vec2 } from './geometry';

export type RoomId = string;
export type DoorId = string;

export interface Room {
  id: RoomId; name: string; floor: number; bounds: Rect; centralObject: string;
}
export interface Door {
  id: DoorId; a: RoomId; b: RoomId; at: Vec2; span: number;
  kind: 'doorway' | 'stair';
}
export interface House { rooms: Room[]; doors: Door[]; sealOrder: RoomId[] }

export function roomById(h: House, id: RoomId): Room {
  const r = h.rooms.find(x => x.id === id);
  if (!r) throw new Error(`unknown room: ${id}`);
  return r;
}

export function exitsOf(h: House, id: RoomId): Door[] {
  return h.doors.filter(d => d.a === id || d.b === id);
}

export function otherSide(d: Door, from: RoomId): RoomId {
  return d.a === from ? d.b : d.a;
}

/** v12.2 §3 — a room may have up to three doors. v12.0's two-door ceiling forced
 *  the whole house into a line or a loop, which deletes the point of hidden
 *  movement (v12.1 §15). */
export const MAX_DOORS = 3;

/** v12.2 §11 — the Bind works "only in a room with exactly two doors". */
export const BIND_DOORS = 2;

export function doorCount(h: House, id: RoomId): number {
  return exitsOf(h, id).length;
}

export function bindEligible(h: House): Room[] {
  return h.rooms.filter(r => doorCount(h, r.id) === BIND_DOORS);
}

/** v12.2 §13 — peripheral rooms start closing on Night Four. Returns the house
 *  as it stands after the first `count` entries of `sealOrder` have closed. */
export function houseAfterSealing(h: House, count: number): House {
  const sealed = new Set(h.sealOrder.slice(0, count));
  return {
    rooms: h.rooms.filter(r => !sealed.has(r.id)),
    doors: h.doors.filter(d => !sealed.has(d.a) && !sealed.has(d.b)),
    sealOrder: h.sealOrder.slice(count),
  };
}

function connected(h: House): boolean {
  const first = h.rooms[0];
  if (!first) return true;
  const seen = new Set([first.id]);
  const queue = [first.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const d of exitsOf(h, id)) {
      const other = otherSide(d, id);
      if (!seen.has(other)) { seen.add(other); queue.push(other); }
    }
  }
  return seen.size === h.rooms.length;
}

export function validateHouse(h: House): string[] {
  const problems: string[] = [];

  for (const d of h.doors) {
    if (!h.rooms.some(r => r.id === d.a)) problems.push(`door ${d.id} references unknown room ${d.a}`);
    if (!h.rooms.some(r => r.id === d.b)) problems.push(`door ${d.id} references unknown room ${d.b}`);
  }
  if (h.sealOrder.includes('hearth')) {
    problems.push('sealOrder contains hearth — the fireplace room never seals (v12.2 §11)');
  }
  for (const id of h.sealOrder) {
    if (!h.rooms.some(r => r.id === id)) problems.push(`sealOrder references unknown room ${id}`);
  }

  // Check the ceiling, the floor, connectivity and Bind-eligibility at every
  // stage of the collapse — not just at the start. A house that is legal on
  // Night One and unwinnable on Night Six is the failure this guards.
  for (let n = 0; n <= h.sealOrder.length; n++) {
    const stage = houseAfterSealing(h, n);
    const when = n === 0 ? 'as built' : `after ${n} seal(s)`;
    for (const room of stage.rooms) {
      const count = doorCount(stage, room.id);
      if (count > MAX_DOORS) {
        problems.push(`room ${room.id} has ${count} doors ${when}, maximum is ${MAX_DOORS} (v12.2 §3)`);
      }
      if (count === 0) problems.push(`room ${room.id} has no doors ${when}`);
    }
    if (bindEligible(stage).length === 0) {
      problems.push(`no two-door room ${when} — the Bind would be impossible (v12.2 §11)`);
    }
    if (!connected(stage)) problems.push(`house is not connected ${when}`);
  }

  return problems;
}
