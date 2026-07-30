import { maskCirclesFor, overlayAlphaFor, MAX_OVERLAY } from '../src/render/lighting';
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
