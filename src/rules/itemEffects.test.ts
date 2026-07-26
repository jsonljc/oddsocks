import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, isLit } from './state.js';
import { applyItemUses, resolveBellWatch, clearNightlyItemEffects } from './itemEffects.js';

const game = () => { const s = createGame(makeConfig(), makeRng(1)); s.villain = 'moss'; s.night = 3; return s; };

describe('the Lantern', () => {
  it('relights a dead bedroom for one night only', () => {
    const s = game();
    s.lit['bed_bell'] = false;
    s.held['pike'] = ['lantern'];
    const events = applyItemUses(s, [{ kind: 'lantern', spender: 'pike', room: 'bed_bell' }]);
    expect(isLit(s, 'bed_bell')).toBe(true);
    expect(events.some((e) => e.t === 'lantern')).toBe(true);
    expect(s.held['pike']).toEqual([]);

    clearNightlyItemEffects(s);
    expect(isLit(s, 'bed_bell')).toBe(false);
  });
});

describe('the Keyhole', () => {
  it('announces who was really in a room on a past night', () => {
    const s = game();
    s.held['pike'] = ['keyhole'];
    s.history.push({
      night: 2, duskPositions: {}, midnightPositions: { bell: 'kitchen', moss: 'kitchen' },
      events: [], sightings: {}, claims: {},
    });
    const events = applyItemUses(s, [
      { kind: 'keyhole', spender: 'pike', room: 'kitchen', night: 2 }]);
    expect(events[0]).toMatchObject({ t: 'keyhole', room: 'kitchen', night: 2 });
    expect((events[0] as { occupants: string[] }).occupants.sort()).toEqual(['bell', 'moss']);
  });

  it('reports an empty room honestly', () => {
    const s = game();
    s.held['pike'] = ['keyhole'];
    s.history.push({
      night: 2, duskPositions: {}, midnightPositions: { bell: 'kitchen' },
      events: [], sightings: {}, claims: {},
    });
    const events = applyItemUses(s, [{ kind: 'keyhole', spender: 'pike', room: 'attic', night: 2 }]);
    expect((events[0] as { occupants: string[] }).occupants).toEqual([]);
  });
});

describe('the Bell', () => {
  it('watches a named child and announces their midnight room that night', () => {
    const s = game();
    s.held['pike'] = ['bell'];
    applyItemUses(s, [{ kind: 'bell', spender: 'pike', target: 'moss' }]);
    expect(s.bellWatch).toBe('moss');

    const events = resolveBellWatch(s, { moss: 'sewing_room' });
    expect(events[0]).toMatchObject({ t: 'bell', target: 'moss', room: 'sewing_room' });

    clearNightlyItemEffects(s);
    expect(s.bellWatch).toBeNull();
  });

  it('announces nothing when no Bell is in play', () => {
    expect(resolveBellWatch(game(), { moss: 'attic' })).toEqual([]);
  });
});

describe('spending', () => {
  it('refuses a use the spender cannot pay for', () => {
    const s = game();
    expect(() => applyItemUses(s, [{ kind: 'bell', spender: 'pike', target: 'moss' }]))
      .toThrow(/does not hold/i);
  });
});
