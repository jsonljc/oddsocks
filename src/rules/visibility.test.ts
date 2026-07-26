import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame } from './state.js';
import { sightingsAt, seesNamesInDark } from './visibility.js';

const game = (villain = 'moss') => {
  const s = createGame(makeConfig(), makeRng(1));
  s.villain = villain;
  return s;
};

describe('sightingsAt', () => {
  it('names everyone else in a lit room', () => {
    const s = game();
    const sight = sightingsAt(s, { bell: 'kitchen', pike: 'kitchen', clem: 'kitchen' });
    expect(sight['bell']!.named.sort()).toEqual(['clem', 'pike']);
    expect(sight['bell']!.others).toBe(2);
    expect(sight['bell']!.lit).toBe(true);
  });

  it('gives a lone player an empty sighting', () => {
    const s = game();
    const sight = sightingsAt(s, { bell: 'kitchen', pike: 'attic' });
    expect(sight['bell']!.named).toEqual([]);
    expect(sight['bell']!.others).toBe(0);
  });

  it('gives shapes but not names in a dark bedroom', () => {
    const s = game();
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { bell: 'bed_clem', pike: 'bed_clem', clem: 'bed_clem' });
    expect(sight['bell']!.named).toEqual([]);
    expect(sight['bell']!.others).toBe(2);
    expect(sight['bell']!.lit).toBe(false);
  });

  it('lets the villain read names in the dark', () => {
    const s = game('moss');
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { moss: 'bed_clem', bell: 'bed_clem', pike: 'bed_clem' });
    expect(sight['moss']!.named.sort()).toEqual(['bell', 'pike']);
    expect(sight['bell']!.named).toEqual([]);
  });

  it('lets Wren read names in the dark when oddities are on', () => {
    const s = game('moss');
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { wren: 'bed_clem', bell: 'bed_clem' });
    expect(sight['wren']!.named).toEqual(['bell']);
  });

  it('takes Wren\'s dark vision away when the oddities layer is off', () => {
    const s = createGame(makeConfig({ layers: { items: true, oddities: false, marking: true } }),
      makeRng(1));
    s.villain = 'moss';
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { wren: 'bed_clem', bell: 'bed_clem' });
    expect(sight['wren']!.named).toEqual([]);
    expect(sight['wren']!.others).toBe(1);
  });

  it('treats a Lantern-lit room as lit', () => {
    const s = game();
    s.lit['bed_clem'] = false;
    s.lanternRoom = 'bed_clem';
    const sight = sightingsAt(s, { bell: 'bed_clem', pike: 'bed_clem' });
    expect(sight['bell']!.named).toEqual(['pike']);
  });

  it('never leaks a name into the dark for an ordinary child, over many states', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = createGame(makeConfig({ layers: { items: true, oddities: false, marking: true } }),
        makeRng(seed));
      const rng = makeRng(seed + 5000);
      const rooms = Object.keys(s.config.house.rooms);
      for (const p of ROSTER) if (rng.next() < 0.5) s.lit[`bed_${p}`] = false;
      const positions: Record<string, string> = {};
      for (const p of ROSTER) positions[p] = rng.pick(rooms);
      const sight = sightingsAt(s, positions);
      for (const p of ROSTER) {
        if (p === s.villain) continue;
        if (!sight[p]!.lit) expect(sight[p]!.named).toEqual([]);
        expect(sight[p]!.others).toBe(
          ROSTER.filter((q) => q !== p && positions[q] === positions[p]).length,
        );
      }
    }
  });
});

describe('seesNamesInDark', () => {
  it('is true for the villain and Wren, false for everyone else', () => {
    const s = game('bell');
    expect(seesNamesInDark(s, 'bell')).toBe(true);
    expect(seesNamesInDark(s, 'wren')).toBe(true);
    expect(seesNamesInDark(s, 'pike')).toBe(false);
  });
});
