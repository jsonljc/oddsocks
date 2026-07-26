import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame } from './state.js';
import { spawnItems, resolvePickups, spendItem, processReturns, itemHolders } from './items.js';
import { isBedroom } from './map.js';

const game = () => { const s = createGame(makeConfig(), makeRng(1)); s.villain = 'moss'; return s; };
const looseCount = (s: ReturnType<typeof game>) => Object.values(s.loose).flat().length;

describe('spawnItems', () => {
  it('tops the map up to itemsOnMap, in common rooms only', () => {
    const s = game();
    const events = spawnItems(s, makeRng(2));
    expect(looseCount(s)).toBe(3);
    expect(events).toHaveLength(3);
    for (const room of Object.keys(s.loose)) {
      if (s.loose[room]!.length > 0) expect(isBedroom(s.config.house, room)).toBe(false);
    }
  });

  it('draws from the reserve', () => {
    const s = game();
    spawnItems(s, makeRng(2));
    expect(s.reserve).toHaveLength(2);
  });

  it('adds nothing when the map is already full', () => {
    const s = game();
    spawnItems(s, makeRng(2));
    expect(spawnItems(s, makeRng(3))).toEqual([]);
    expect(looseCount(s)).toBe(3);
  });

  it('does nothing when the items layer is off', () => {
    const s = createGame(
      makeConfig({ layers: { items: false, oddities: true, marking: true } }), makeRng(1));
    expect(spawnItems(s, makeRng(2))).toEqual([]);
  });
});

describe('resolvePickups', () => {
  it('gives the item to a lone claimant and announces it', () => {
    const s = game();
    s.loose['kitchen'] = ['keyhole'];
    const events = resolvePickups(s, { bell: 'kitchen' }, { bell: true }, makeRng(1));
    expect(s.held['bell']).toEqual(['keyhole']);
    expect(s.loose['kitchen']).toEqual([]);
    expect(events[0]).toMatchObject({ t: 'itemTaken', player: 'bell', item: 'keyhole' });
  });

  it('gives a contested item to exactly one claimant', () => {
    const s = game();
    s.loose['kitchen'] = ['keyhole'];
    resolvePickups(s, { bell: 'kitchen', pike: 'kitchen' }, { bell: true, pike: true }, makeRng(6));
    expect(s.held['bell']!.length + s.held['pike']!.length).toBe(1);
  });

  it('leaves the item when nobody wants it', () => {
    const s = game();
    s.loose['kitchen'] = ['keyhole'];
    expect(resolvePickups(s, { bell: 'kitchen' }, { bell: false }, makeRng(1))).toEqual([]);
    expect(s.loose['kitchen']).toEqual(['keyhole']);
  });

  it('refuses a pickup that would exceed carrying capacity', () => {
    const s = game();
    s.held['bell'] = ['bell'];
    s.loose['kitchen'] = ['keyhole'];
    expect(resolvePickups(s, { bell: 'kitchen' }, { bell: true }, makeRng(1))).toEqual([]);
  });

  it('lets Moss carry two', () => {
    const s = game();
    s.held['moss'] = ['bell'];
    s.loose['kitchen'] = ['keyhole'];
    resolvePickups(s, { moss: 'kitchen' }, { moss: true }, makeRng(1));
    expect(s.held['moss']).toEqual(['bell', 'keyhole']);
  });
});

describe('spending and returning', () => {
  it('returns a spent item to the reserve after the configured delay', () => {
    const s = game();
    s.night = 3;
    s.held['bell'] = ['keyhole'];
    const before = s.reserve.length;
    spendItem(s, 'bell', 'keyhole');
    expect(s.held['bell']).toEqual([]);
    expect(s.reserve).toHaveLength(before);

    s.night = 4; processReturns(s);
    expect(s.reserve).toHaveLength(before);

    s.night = 5; processReturns(s);
    expect(s.reserve).toHaveLength(before + 1);
    expect(s.returning).toEqual([]);
  });

  it('throws when spending an item the player does not hold', () => {
    const s = game();
    expect(() => spendItem(s, 'bell', 'keyhole')).toThrow(/does not hold/i);
  });
});

describe('itemHolders', () => {
  it('lists every child with at least one item', () => {
    const s = game();
    s.held['bell'] = ['keyhole'];
    s.held['moss'] = ['lantern', 'bell'];
    expect(itemHolders(s)).toEqual(['bell', 'moss']);
  });
});
