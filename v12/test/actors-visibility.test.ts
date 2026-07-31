import { appearanceOf } from '../src/render/actors';
import { createSim } from '../src/core/sim';
import { HOLLOW } from '../src/house/hollow';
import { IDENTIFY_THRESHOLD, LANTERN_RADIUS } from '../src/core/light';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

const ATTIC = HOLLOW.rooms.find(r => r.id === 'attic')!.bounds;
const SPOT = { x: ATTIC.x + ATTIC.w / 2, y: ATTIC.y + ATTIC.h / 2 };

function twoInRoom(night: number, lit: boolean) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.night = night;
  for (const id of ['bell', 'pike']) {
    const a = sim.state.actors.find(x => x.id === id)!;
    a.room = 'attic'; a.at = { ...SPOT };
  }
  sim.state.lanterns[0]!.state = lit
    ? { kind: 'placed', room: 'attic', at: { ...SPOT }, watching: 'd_attic_playroom', lit: true }
    : { kind: 'placed', room: 'shared_bedroom', at: { x: 0, y: 0 }, watching: 'd_bed_hearth', lit: false };
  sim.state.lanterns[1]!.state = { kind: 'placed', room: 'shared_bedroom', at: { x: 0, y: 0 }, watching: 'd_bed_hearth', lit: false };
  return sim;
}

describe('appearanceOf', () => {
  // v12.2 §4 "In the dark" — names disappear and colours wash out
  it('hides the name and desaturates in an unlit room on night six', () => {
    const a = appearanceOf(twoInRoom(6, false), 'bell', 'pike');
    expect(a.visibility).toBe('silhouette');
    expect(a.showName).toBe(false);
    // This fixture sits at the deep-dark extreme (ambient 0.06 on night six),
    // so 0.5 is nowhere near a tight bound here — as level approaches
    // IDENTIFY_THRESHOLD (0.45) from below, the formula (level * 1.2)
    // approaches 0.45 * 1.2 = 0.54, never quite reaching it since silhouette
    // requires level strictly < the threshold (see the boundary test below,
    // which checks saturation at level 0.4250, close to that supremum, and
    // pins the property that actually generalises: saturation stays under
    // full even at the harder, close-to-threshold end, not just here).
    expect(a.saturation).toBeLessThan(0.5);
  });

  it('shows the name inside lantern light', () => {
    const a = appearanceOf(twoInRoom(6, true), 'bell', 'pike');
    expect(a.visibility).toBe('identified');
    expect(a.showName).toBe(true);
  });

  it('shows the name on night one, before the house darkens', () => {
    const sim = twoInRoom(1, false);
    // Seed-42-coupled: true today because seed 42's shuffle puts {cellar,
    // library, nursery} in night one's 3 dark rooms, not attic (verified
    // directly against darkRoomsFor rather than assumed). Pinning that fact
    // as its own assertion means a future seed/RNG/DARK_ROOM_COUNT_BY_NIGHT
    // change fails HERE with "attic went dark on night 1", not three lines
    // down as a confusing showName mismatch.
    expect(sim.darkRooms.has('attic')).toBe(false);
    expect(appearanceOf(sim, 'bell', 'pike').showName).toBe(true);
  });

  // v12.2 §4 — "You can still hear footsteps": a silhouette must still be
  // drawn, never fully transparent.
  it('keeps a silhouette visible rather than erasing it', () => {
    expect(appearanceOf(twoInRoom(6, false), 'bell', 'pike').alpha).toBeGreaterThan(0);
  });

  it('reports a target in another room as unseen', () => {
    const sim = twoInRoom(6, false);
    sim.state.actors.find(a => a.id === 'pike')!.room = 'cellar';
    expect(appearanceOf(sim, 'bell', 'pike').visibility).toBe('unseen');
  });

  // The brief's one bolded requirement: "the render layer decides nothing" —
  // appearanceOf must read core's visibilityAt/IDENTIFY_THRESHOLD, not
  // re-derive its own number. None of the five tests above are sensitive to
  // that claim: they sit at the extremes (deep dark with no lantern, dead
  // centre of a lit lantern, ambient-lit room, a different room entirely),
  // never near the actual identify boundary. A version of appearanceOf with
  // `showName: level >= 0.5` hardcoded in place of `visibility ===
  // 'identified'` (i.e. re-deriving instead of calling visibilityAt) passes
  // all five of the tests above unchanged — verified empirically, see
  // task-10-report.md's mutation-test evidence. This test places the target
  // on either side of the EXACT boundary core computes, derived from the
  // live constants rather than a duplicated literal, so a legitimate future
  // retune of either constant doesn't make this test stale, but a
  // hardcoded/re-derived threshold in THIS file still gets caught.
  it('draws the identify line exactly where core/light.ts puts it, not a value duplicated here', () => {
    const sim = twoInRoom(6, true); // lit lantern, dead centre at SPOT
    const pike = sim.state.actors.find(a => a.id === 'pike')!;
    // level = 1 - (d/LANTERN_RADIUS)^2 crosses IDENTIFY_THRESHOLD at this d.
    const flip = LANTERN_RADIUS * Math.sqrt(1 - IDENTIFY_THRESHOLD);

    pike.at = { x: SPOT.x + flip - 2, y: SPOT.y }; // just inside: level ~0.4744
    const inside = appearanceOf(sim, 'bell', 'pike');
    expect(inside.visibility).toBe('identified');
    expect(inside.showName).toBe(true);

    pike.at = { x: SPOT.x + flip + 2, y: SPOT.y }; // just outside: level ~0.4250
    const outside = appearanceOf(sim, 'bell', 'pike');
    expect(outside.visibility).toBe('silhouette');
    expect(outside.showName).toBe(false);
    // The harder end of "colours wash out": saturation stays under full even
    // this close to the line, not just at test 1's deep-dark extreme.
    expect(outside.saturation).toBeLessThan(1);
  });
});
