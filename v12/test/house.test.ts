import { validateHouse, exitsOf, roomById } from '../src/core/house';
import { HOLLOW } from '../src/house/hollow';

describe('HOLLOW', () => {
  it('has ten rooms: eight active plus the Shared Bedroom and the Hearth Room', () => {
    expect(HOLLOW.rooms).toHaveLength(10);
    expect(HOLLOW.rooms.map(r => r.id)).toContain('shared_bedroom');
    expect(HOLLOW.rooms.map(r => r.id)).toContain('hearth');
  });

  it('spans exactly two floors', () => {
    expect(new Set(HOLLOW.rooms.map(r => r.floor))).toEqual(new Set([0, 1]));
  });

  it('has exactly two stair connections', () => {
    expect(HOLLOW.doors.filter(d => d.kind === 'stair')).toHaveLength(2);
  });

  // rules §6.1 — a hard constraint, because §16.3's Bind requires sealing every exit
  it('gives no room more than two exits', () => {
    for (const room of HOLLOW.rooms) {
      expect(exitsOf(HOLLOW, room.id).length).toBeLessThanOrEqual(2);
    }
  });

  it('is fully connected — every room reachable from the Shared Bedroom', () => {
    const seen = new Set<string>(['shared_bedroom']);
    const queue = ['shared_bedroom'];
    while (queue.length) {
      const id = queue.shift()!;
      for (const d of exitsOf(HOLLOW, id)) {
        const other = d.a === id ? d.b : d.a;
        if (!seen.has(other)) { seen.add(other); queue.push(other); }
      }
    }
    expect(seen.size).toBe(HOLLOW.rooms.length);
  });

  it('validates clean', () => {
    expect(validateHouse(HOLLOW)).toEqual([]);
  });

  it('reports a violation when a room is given a third exit', () => {
    const broken = {
      ...HOLLOW,
      doors: [...HOLLOW.doors,
        { id: 'x1', a: 'nursery', b: 'attic', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
        { id: 'x2', a: 'nursery', b: 'cellar', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const }],
    };
    expect(validateHouse(broken).join(' ')).toMatch(/nursery.*exits/i);
  });

  it('roomById throws on an unknown id rather than returning undefined', () => {
    expect(() => roomById(HOLLOW, 'no_such_room')).toThrow();
  });
});
