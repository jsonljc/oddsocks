import type { House } from '../core/house';

const W = 260, H = 200, GAP = 40;
const cell = (col: number, row: number) =>
  ({ x: col * (W + GAP), y: row * (H + GAP), w: W, h: H });

/** Floor 0: bedroom — hearth — kitchen — library — cellar
 *  Floor 1: nursery — music_room — playroom — bathroom — attic
 *  Stairs join shared_bedroom↔nursery and cellar↔attic — the two open ends
 *  of each floor's chain — giving a single loop through all ten rooms with
 *  no room exceeding two exits.
 *
 *  Correction from the plan: the plan paired library↔playroom instead of
 *  shared_bedroom↔nursery. Both of those are interior chain rooms already
 *  at two exits apiece, so that pairing put library and playroom at three
 *  exits each, tripping validateHouse's rules §6.1 guard (confirmed by
 *  running the tests against the plan's verbatim data before this fix).
 *  Fixing the house data, not the constraint, per this task's brief. */
export const HOLLOW: House = {
  rooms: [
    { id: 'shared_bedroom', name: 'Shared Bedroom', floor: 0, bounds: cell(0, 1), centralObject: 'six beds' },
    { id: 'hearth',         name: 'Hearth Room',    floor: 0, bounds: cell(1, 1), centralObject: 'the five flames' },
    { id: 'kitchen',        name: 'Kitchen',        floor: 0, bounds: cell(2, 1), centralObject: 'a long table' },
    { id: 'library',        name: 'Library',        floor: 0, bounds: cell(3, 1), centralObject: 'a reading chair' },
    { id: 'cellar',         name: 'Cellar',         floor: 0, bounds: cell(4, 1), centralObject: 'a coal chute' },
    { id: 'nursery',        name: 'Nursery',        floor: 1, bounds: cell(0, 0), centralObject: 'a rocking horse' },
    { id: 'music_room',     name: 'Music Room',     floor: 1, bounds: cell(1, 0), centralObject: 'an upright piano' },
    { id: 'playroom',       name: 'Playroom',       floor: 1, bounds: cell(2, 0), centralObject: 'a toy chest' },
    { id: 'bathroom',       name: 'Bathroom',       floor: 1, bounds: cell(3, 0), centralObject: 'a claw-foot bath' },
    { id: 'attic',          name: 'Attic',          floor: 1, bounds: cell(4, 0), centralObject: 'a dust-sheeted mirror' },
  ],
  doors: [
    { id: 'd_bed_hearth',  a: 'shared_bedroom', b: 'hearth',      at: { x: 1 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_hearth_kit',  a: 'hearth',         b: 'kitchen',     at: { x: 2 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_kit_lib',     a: 'kitchen',        b: 'library',     at: { x: 3 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_lib_cellar',  a: 'library',        b: 'cellar',      at: { x: 4 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_nur_music',   a: 'nursery',        b: 'music_room',  at: { x: 1 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_music_play',  a: 'music_room',     b: 'playroom',    at: { x: 2 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_play_bath',   a: 'playroom',       b: 'bathroom',    at: { x: 3 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_bath_attic',  a: 'bathroom',       b: 'attic',       at: { x: 4 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 's_bed_nursery', a: 'shared_bedroom', b: 'nursery',     at: { x: 0 * (W + GAP) + W / 2,   y: 1 * (H + GAP) - GAP / 2 }, span: 60, kind: 'stair' },
    { id: 's_cellar_attic',a: 'cellar',         b: 'attic',       at: { x: 4 * (W + GAP) + W / 2,   y: 1 * (H + GAP) - GAP / 2 }, span: 60, kind: 'stair' },
  ],
};
