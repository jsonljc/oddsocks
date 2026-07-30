import {
  AMBIENT_BY_NIGHT, ambientForNight, lightAt, visibilityAt,
  DARK_ENOUGH_FOR_TAKE, IDENTIFY_THRESHOLD, LANTERN_RADIUS,
} from '../src/core/light';

describe('ambient', () => {
  // rules §18: nights 1-2 keep faint ambient visibility; night 3 drops; 5-6 harsher
  it('falls monotonically from night one to night six', () => {
    for (let n = 2; n <= 6; n++) {
      expect(ambientForNight(n)).toBeLessThanOrEqual(ambientForNight(n - 1));
    }
    expect(ambientForNight(6)).toBeLessThan(ambientForNight(1));
  });

  it('is bright enough to identify on night one and too dark by night six', () => {
    expect(ambientForNight(1)).toBeGreaterThanOrEqual(IDENTIFY_THRESHOLD);
    expect(ambientForNight(6)).toBeLessThan(DARK_ENOUGH_FOR_TAKE);
  });

  it('clamps out-of-range nights rather than returning undefined', () => {
    expect(ambientForNight(0)).toBe(AMBIENT_BY_NIGHT[0]);
    expect(ambientForNight(99)).toBe(AMBIENT_BY_NIGHT[AMBIENT_BY_NIGHT.length - 1]);
  });
});

describe('lightAt', () => {
  const lantern = { room: 'kitchen', at: { x: 100, y: 100 }, radius: LANTERN_RADIUS };

  it('is ambient with no sources', () => {
    expect(lightAt(6, 'kitchen', { x: 0, y: 0 }, [])).toBe(ambientForNight(6));
  });

  it('is full at a lantern and ambient beyond its radius', () => {
    expect(lightAt(6, 'kitchen', { x: 100, y: 100 }, [lantern])).toBe(1);
    expect(lightAt(6, 'kitchen', { x: 100 + LANTERN_RADIUS + 1, y: 100 }, [lantern]))
      .toBe(ambientForNight(6));
  });

  it('does not leak between rooms', () => {
    expect(lightAt(6, 'library', { x: 100, y: 100 }, [lantern])).toBe(ambientForNight(6));
  });

  it('falls off with distance inside the radius', () => {
    const near = lightAt(6, 'kitchen', { x: 130, y: 100 }, [lantern]);
    const far  = lightAt(6, 'kitchen', { x: 190, y: 100 }, [lantern]);
    expect(near).toBeGreaterThan(far);
  });
});

describe('visibilityAt', () => {
  // rules §9: in deep darkness names disappear and silhouettes obscure,
  // but movement stays perceptible — so 'unseen' must be rare, not the default.
  it('identifies in light, silhouettes in the dark, and never blinds entirely at ambient', () => {
    expect(visibilityAt(1)).toBe('identified');
    expect(visibilityAt(IDENTIFY_THRESHOLD)).toBe('identified');
    expect(visibilityAt(IDENTIFY_THRESHOLD - 0.01)).toBe('silhouette');
    expect(visibilityAt(ambientForNight(6))).toBe('silhouette');
    expect(visibilityAt(0)).toBe('unseen');
  });
});
