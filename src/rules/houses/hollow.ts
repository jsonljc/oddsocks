import type { House, Room } from '../types.js';

const room = (
  id: string, kind: 'bedroom' | 'common', floor: 0 | 1,
  doors: string[], owner?: string,
): Room => ({ id, kind, floor, doors, ...(owner ? { owner } : {}) });

/**
 * Hollow House — 12 rooms, 6 bedrooms, 6 commons, two floors, 14 edges.
 * Diameter 4, so crossing the house takes exactly two nights.
 * Two staircases, so no single choke point carries every floor crossing.
 */
export const HOLLOW_HOUSE: House = {
  id: 'hollow',
  rooms: Object.fromEntries(
    [
      // Ground floor
      room('kitchen',     'common',  0, ['west_hall', 'east_hall', 'bed_pike']),
      room('west_hall',   'common',  0, ['kitchen', 'bed_bell', 'bed_pike', 'landing']),
      room('east_hall',   'common',  0, ['kitchen', 'bed_clem', 'sewing_room']),
      room('bed_bell',    'bedroom', 0, ['west_hall'], 'bell'),
      room('bed_pike',    'bedroom', 0, ['west_hall', 'kitchen'], 'pike'),
      room('bed_clem',    'bedroom', 0, ['east_hall'], 'clem'),
      // Upper floor
      room('landing',     'common',  1, ['west_hall', 'sewing_room', 'attic', 'bed_wren']),
      room('sewing_room', 'common',  1, ['east_hall', 'landing', 'bed_sparrow', 'bed_moss']),
      room('attic',       'common',  1, ['landing', 'bed_moss']),
      room('bed_wren',    'bedroom', 1, ['landing'], 'wren'),
      room('bed_sparrow', 'bedroom', 1, ['sewing_room'], 'sparrow'),
      room('bed_moss',    'bedroom', 1, ['sewing_room', 'attic'], 'moss'),
    ].map((r) => [r.id, r]),
  ),
};
