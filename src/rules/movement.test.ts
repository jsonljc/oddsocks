import { describe, it, expect } from 'vitest';
import { HOLLOW_HOUSE as H } from './houses/hollow.js';
import { resolveMovement, crossedFloors } from './movement.js';

describe('resolveMovement', () => {
  it('ends each player on the second room of their path', () => {
    const r = resolveMovement(H,
      { bell: 'bed_bell', clem: 'bed_clem' },
      { bell: ['west_hall', 'kitchen'], clem: ['east_hall', 'kitchen'] });
    expect(r.positions['bell']).toBe('kitchen');
    expect(r.positions['clem']).toBe('kitchen');
  });

  it('records the intermediate step', () => {
    const r = resolveMovement(H, { bell: 'bed_bell' }, { bell: ['west_hall', 'kitchen'] });
    expect(r.steps['bell']).toEqual(['west_hall', 'kitchen']);
  });

  it('allows staying home by stepping out and back', () => {
    const r = resolveMovement(H, { bell: 'bed_bell' }, { bell: ['west_hall', 'bed_bell'] });
    expect(r.positions['bell']).toBe('bed_bell');
  });

  it('throws on a path that walks through a wall', () => {
    expect(() => resolveMovement(H, { bell: 'bed_bell' }, { bell: ['attic', 'landing'] }))
      .toThrow(/illegal path/i);
  });

  it('throws when a player has no path', () => {
    expect(() => resolveMovement(H, { bell: 'bed_bell', pike: 'bed_pike' },
      { bell: ['west_hall', 'kitchen'] })).toThrow(/no path/i);
  });

  it('returns exactly one position per player', () => {
    const r = resolveMovement(H,
      { bell: 'bed_bell', pike: 'bed_pike', clem: 'bed_clem' },
      { bell: ['west_hall', 'bed_bell'], pike: ['kitchen', 'west_hall'],
        clem: ['east_hall', 'kitchen'] });
    expect(Object.keys(r.positions).sort()).toEqual(['bell', 'clem', 'pike']);
  });

  it('cannot end in an adjacent dead-end room', () => {
    // bed_bell's only door is west_hall, so from west_hall the only two-edge walk
    // through it comes straight back. You must start two rooms away to sleep there.
    expect(() => resolveMovement(H, { bell: 'west_hall' }, { bell: ['west_hall', 'bed_bell'] }))
      .toThrow(/illegal path/i);
    expect(resolveMovement(H, { bell: 'kitchen' }, { bell: ['west_hall', 'bed_bell'] })
      .positions['bell']).toBe('bed_bell');
  });
});

describe('crossedFloors', () => {
  it('detects a staircase anywhere in the walk', () => {
    expect(crossedFloors(H, 'bed_bell', ['west_hall', 'landing'])).toBe(true);
    expect(crossedFloors(H, 'landing', ['west_hall', 'landing'])).toBe(true);
  });

  it('returns false for a walk that stays on one floor', () => {
    expect(crossedFloors(H, 'bed_bell', ['west_hall', 'kitchen'])).toBe(false);
  });
});
