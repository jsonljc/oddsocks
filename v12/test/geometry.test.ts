import { clampInside, pointInRect } from '../src/core/geometry';

const room = { x: 0, y: 0, w: 100, h: 80 };

describe('clampInside', () => {
  it('leaves an interior point untouched', () => {
    expect(clampInside({ x: 50, y: 40 }, 5, room)).toEqual({ x: 50, y: 40 });
  });

  it('pulls a point back inside by the radius on each axis', () => {
    expect(clampInside({ x: -20, y: 40 }, 5, room)).toEqual({ x: 5, y: 40 });
    expect(clampInside({ x: 200, y: 40 }, 5, room)).toEqual({ x: 95, y: 40 });
    expect(clampInside({ x: 50, y: -3 }, 5, room)).toEqual({ x: 50, y: 5 });
    expect(clampInside({ x: 50, y: 999 }, 5, room)).toEqual({ x: 50, y: 75 });
  });
});

describe('pointInRect', () => {
  it('is inclusive of the boundary', () => {
    expect(pointInRect({ x: 0, y: 0 }, room)).toBe(true);
    expect(pointInRect({ x: 100, y: 80 }, room)).toBe(true);
    expect(pointInRect({ x: 101, y: 40 }, room)).toBe(false);
  });
});
