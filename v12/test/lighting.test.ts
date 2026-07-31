import { maskCirclesFor, overlayAlphaFor, glowPolygon, MAX_OVERLAY } from '../src/render/lighting';
import { HOLLOW } from '../src/house/hollow';
import { LANTERN_RADIUS } from '../src/core/light';

describe('maskCirclesFor', () => {
  it('produces one circle per source, positioned at the source', () => {
    const circles = maskCirclesFor(
      [{ room: 'kitchen', at: { x: 10, y: 20 }, radius: LANTERN_RADIUS }], HOLLOW);
    expect(circles).toEqual([{ x: 10, y: 20, r: LANTERN_RADIUS }]);
  });

  it('drops sources in rooms the house does not have', () => {
    expect(maskCirclesFor(
      [{ room: 'no_such_room', at: { x: 0, y: 0 }, radius: 50 }], HOLLOW)).toEqual([]);
  });

  it('is empty with no sources', () => {
    expect(maskCirclesFor([], HOLLOW)).toEqual([]);
  });
});

describe('overlayAlphaFor', () => {
  const none = new Set<string>();
  const allDark = new Set(HOLLOW.rooms.map(r => r.id));

  // v12.2 §3 — dark rooms hide who you are; they NEVER hide where the doors
  // are. An alpha of 1 would hide the doors.
  it('never fully blacks out, even in a dark room on night six', () => {
    for (let n = 1; n <= 6; n++) {
      expect(overlayAlphaFor(n, 'kitchen', allDark)).toBeLessThan(1);
      expect(overlayAlphaFor(n, 'kitchen', allDark)).toBeGreaterThanOrEqual(0);
    }
  });

  // The check above is nearly a tautology: ambientFor's tables never return
  // exactly 0, so (1 - ambient) * anything <= 1 is already true of the raw
  // curve, with or without a cap. It would pass unchanged even if the cap
  // were deleted entirely (MAX_OVERLAY = 1.0 gives 0.94 on night six, which
  // still clears "< 1"). What v12.2 §3 actually needs is the cap ITSELF —
  // pin that the function never exceeds it, and that the cap stays well
  // short of opaque, so "simplify this to 1.0" can't slip back in unnoticed.
  it('caps overlay alpha at a concrete, meaningfully-below-opaque ceiling', () => {
    for (let n = 1; n <= 6; n++) {
      expect(overlayAlphaFor(n, 'kitchen', allDark)).toBeLessThanOrEqual(MAX_OVERLAY);
      expect(overlayAlphaFor(n, 'kitchen', none)).toBeLessThanOrEqual(MAX_OVERLAY);
      // Belt-and-suspenders beyond the MAX_OVERLAY-keyed checks above: those two
      // are silent if the AMBIENT FLOOR moves instead of the cap (e.g. a future
      // night-6 dark value lower than today's 0.06 — see core/light.ts's own
      // "worth watching" note on this exact knob). Pin the actual output too.
      // 0.9 is derived from TODAY's tables (current worst case is 0.8648), not
      // handed down by a rule — if a future night legitimately darkens further
      // than this, raise the number here rather than reading a failure as a
      // regression.
      expect(overlayAlphaFor(n, 'kitchen', allDark)).toBeLessThanOrEqual(0.9);
    }
    expect(MAX_OVERLAY).toBeLessThanOrEqual(0.95);
  });

  it('darkens monotonically across the nights', () => {
    for (let n = 2; n <= 6; n++) {
      expect(overlayAlphaFor(n, 'kitchen', allDark))
        .toBeGreaterThanOrEqual(overlayAlphaFor(n - 1, 'kitchen', allDark));
    }
  });

  // The reason it is per room: a player must be able to tell a dark room from
  // a lit one through a doorway, or the escalation is invisible.
  it('makes a dark room visibly darker than a lit one on the same night', () => {
    expect(overlayAlphaFor(4, 'kitchen', allDark))
      .toBeGreaterThan(overlayAlphaFor(4, 'kitchen', none));
  });
});

// Task 9's report quantified an unclipped light circle bleeding up to 66px
// past a wall into the room next door for a PLACED lantern (LANTERN_RADIUS
// 120) hugging it: at the closest a clampInside() position allows
// (ACTOR_RADIUS = 14 from the wall), reach past the wall is 120 - 14 = 106px,
// and the inter-room GAP is only 40px, so 66px lands inside the neighbour's
// own bounds — a room v12.2 §13 still calls dark, lit anyway. A CARRIED
// lantern (radius 45) never reaches: 45 - 14 = 31 < 40, short of even
// crossing the gap. glowPolygon is the fix: approximate a glow ring as an
// N-gon and clamp every vertex into the SOURCE's OWN room rect, so nothing
// drawn from it can ever land in a different room's bounds, regardless of
// source radius or distance to the wall.
describe('glowPolygon', () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 };

  it('never returns a vertex outside the room rect, even for a wall-hugging, oversized circle', () => {
    // Worst case: centre near a corner, radius far larger than the room —
    // deliberately more extreme than the 120-in-a-260x200-room worst case
    // this is meant to guard, to prove the clamp is unconditional.
    const pts = glowPolygon(5, 5, 500, rect);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(rect.x);
      expect(p.x).toBeLessThanOrEqual(rect.x + rect.w);
      expect(p.y).toBeGreaterThanOrEqual(rect.y);
      expect(p.y).toBeLessThanOrEqual(rect.y + rect.h);
    }
  });

  it('leaves a circle that already fits inside the rect undistorted', () => {
    const pts = glowPolygon(50, 50, 10, rect);
    for (const p of pts) expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(10, 5);
  });

  it('produces the requested number of vertices', () => {
    expect(glowPolygon(50, 50, 10, rect, 16)).toHaveLength(16);
  });
});
