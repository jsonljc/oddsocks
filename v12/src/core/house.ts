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
export interface House { rooms: Room[]; doors: Door[] }

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

/** rules §6.1 is a hard constraint, not a preference: §16.3's Bind requires
 *  sealing every exit, so a three-exit room would be untrappable. */
export function validateHouse(h: House): string[] {
  const problems: string[] = [];
  for (const room of h.rooms) {
    const n = exitsOf(h, room.id).length;
    if (n > 2) problems.push(`room ${room.id} has ${n} exits, maximum is 2 (rules §6.1)`);
    if (n === 0) problems.push(`room ${room.id} has no exits`);
  }
  for (const d of h.doors) {
    if (!h.rooms.some(r => r.id === d.a)) problems.push(`door ${d.id} references unknown room ${d.a}`);
    if (!h.rooms.some(r => r.id === d.b)) problems.push(`door ${d.id} references unknown room ${d.b}`);
  }
  return problems;
}
