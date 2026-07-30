import type { House } from '../core/house';

const W = 260, H = 200, GAP = 40;

/** World rows 0–1 are the upper floor, 2–3 the ground floor. Stacking them so
 *  row 1 touches row 2 is what lets a stair sit on a shared edge and be walked
 *  through like any other door. */
const cell = (col: number, worldRow: number) =>
  ({ x: col * (W + GAP), y: worldRow * (H + GAP), w: W, h: H });

/** Door on the vertical edge between (col-1,row) and (col,row). */
const vEdge = (col: number, worldRow: number) =>
  ({ x: col * (W + GAP) - GAP / 2, y: worldRow * (H + GAP) + H / 2 });

/** Door on the horizontal edge between (col,row-1) and (col,row). */
const hEdge = (col: number, worldRow: number) =>
  ({ x: col * (W + GAP) + W / 2, y: worldRow * (H + GAP) - GAP / 2 });

/**
 *  Upper floor        Ground floor
 *  nursery music bath shared_bedroom hearth kitchen
 *  attic  play  study cellar        library conservatory
 *
 *  Branching, not a ring: on each floor both middle-column rooms (music_room
 *  and playroom upstairs, hearth and library downstairs) are three-door hubs
 *  from in-floor doorways alone, and both stairs turn the corner room at each
 *  of their four ends (attic, shared_bedroom, study, kitchen) into a
 *  three-door hub too — eight in all. The remaining four corners — nursery,
 *  bathroom, cellar and conservatory — stay two-door and Bind-eligible.
 */
export const HOLLOW: House = {
  rooms: [
    { id: 'nursery',       name: 'Nursery',      floor: 1, bounds: cell(0, 0), centralObject: 'a rocking horse' },
    { id: 'music_room',    name: 'Music Room',   floor: 1, bounds: cell(1, 0), centralObject: 'an upright piano' },
    { id: 'bathroom',      name: 'Bathroom',     floor: 1, bounds: cell(2, 0), centralObject: 'a claw-foot bath' },
    { id: 'attic',         name: 'Attic',        floor: 1, bounds: cell(0, 1), centralObject: 'a dust-sheeted mirror' },
    { id: 'playroom',      name: 'Playroom',     floor: 1, bounds: cell(1, 1), centralObject: 'a toy chest' },
    { id: 'study',         name: 'Study',        floor: 1, bounds: cell(2, 1), centralObject: 'a writing desk' },
    { id: 'shared_bedroom',name: 'Shared Bedroom',floor: 0, bounds: cell(0, 2), centralObject: 'six beds' },
    { id: 'hearth',        name: 'Hearth Room',  floor: 0, bounds: cell(1, 2), centralObject: 'the five flames' },
    { id: 'kitchen',       name: 'Kitchen',      floor: 0, bounds: cell(2, 2), centralObject: 'a long table' },
    { id: 'cellar',        name: 'Cellar',       floor: 0, bounds: cell(0, 3), centralObject: 'a coal chute' },
    { id: 'library',       name: 'Library',      floor: 0, bounds: cell(1, 3), centralObject: 'a reading chair' },
    { id: 'conservatory',  name: 'Conservatory', floor: 0, bounds: cell(2, 3), centralObject: 'a dead fern' },
  ],
  doors: [
    // Upper floor
    { id: 'd_nursery_music',   a: 'nursery',    b: 'music_room',   at: vEdge(1, 0), span: 60, kind: 'doorway' },
    { id: 'd_music_bathroom',  a: 'music_room', b: 'bathroom',     at: vEdge(2, 0), span: 60, kind: 'doorway' },
    { id: 'd_attic_playroom',  a: 'attic',      b: 'playroom',     at: vEdge(1, 1), span: 60, kind: 'doorway' },
    { id: 'd_playroom_study',  a: 'playroom',   b: 'study',        at: vEdge(2, 1), span: 60, kind: 'doorway' },
    { id: 'd_nursery_attic',   a: 'nursery',    b: 'attic',        at: hEdge(0, 1), span: 60, kind: 'doorway' },
    { id: 'd_music_playroom',  a: 'music_room', b: 'playroom',     at: hEdge(1, 1), span: 60, kind: 'doorway' },
    { id: 'd_bathroom_study',  a: 'bathroom',   b: 'study',        at: hEdge(2, 1), span: 60, kind: 'doorway' },
    // Ground floor
    { id: 'd_bed_hearth',      a: 'shared_bedroom', b: 'hearth',       at: vEdge(1, 2), span: 60, kind: 'doorway' },
    { id: 'd_hearth_kitchen',  a: 'hearth',         b: 'kitchen',      at: vEdge(2, 2), span: 60, kind: 'doorway' },
    { id: 'd_cellar_library',  a: 'cellar',         b: 'library',      at: vEdge(1, 3), span: 60, kind: 'doorway' },
    { id: 'd_library_consv',   a: 'library',        b: 'conservatory', at: vEdge(2, 3), span: 60, kind: 'doorway' },
    { id: 'd_bed_cellar',      a: 'shared_bedroom', b: 'cellar',       at: hEdge(0, 3), span: 60, kind: 'doorway' },
    { id: 'd_hearth_library',  a: 'hearth',         b: 'library',      at: hEdge(1, 3), span: 60, kind: 'doorway' },
    { id: 'd_kitchen_consv',   a: 'kitchen',        b: 'conservatory', at: hEdge(2, 3), span: 60, kind: 'doorway' },
    // Stairs — on the shared edge between world rows 1 and 2
    { id: 's_attic_bedroom',   a: 'attic', b: 'shared_bedroom', at: hEdge(0, 2), span: 60, kind: 'stair' },
    { id: 's_study_kitchen',   a: 'study', b: 'kitchen',        at: hEdge(2, 2), span: 60, kind: 'stair' },
  ],
  /** v12.2 §13 — peripheral rooms close from Night Four. Chosen so that every
   *  stage keeps a two-door room, strands nobody, and never touches the Hearth. */
  sealOrder: ['bathroom', 'conservatory', 'nursery'],
};
