import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, ROSTER, ODDITY_OF, makeConfig, type GameConfig } from './config.js';

describe('config', () => {
  it('has the six-child roster', () => {
    expect([...ROSTER]).toEqual(['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss']);
    for (const p of ROSTER) expect(ODDITY_OF[p]).toBe(p);
  });

  it('encodes the six-player numbers from the rules document', () => {
    expect(DEFAULT_CONFIG.lightsRequired).toBe(5);
    expect(DEFAULT_CONFIG.activeNights).toBe(6);
    expect(DEFAULT_CONFIG.totalNights).toBe(7);
    expect(DEFAULT_CONFIG.activeNights).toBe(DEFAULT_CONFIG.lightsRequired + 1);
    expect(DEFAULT_CONFIG.totalNights).toBe(DEFAULT_CONFIG.activeNights + 1);
  });

  it('defaults to the rulings recorded in the spec', () => {
    expect(DEFAULT_CONFIG.hushMode).toBe('silent');
    expect(DEFAULT_CONFIG.selfSnuffCostsNight).toBe(true);
    expect(DEFAULT_CONFIG.sparrowMode).toBe('dusk');
    expect(DEFAULT_CONFIG.trailRadius).toBe(1);
    expect(DEFAULT_CONFIG.callHandsRequired).toBe(2);
    expect(DEFAULT_CONFIG.itemsOnMap).toBe(3);
    expect(DEFAULT_CONFIG.itemRespawnDelay).toBe(2);
    expect(DEFAULT_CONFIG.maxCallsPerNight).toBe(1);
    expect(DEFAULT_CONFIG.carryCapacity).toBe(1);
    expect(DEFAULT_CONFIG.mossCarryCapacity).toBe(2);
  });

  it('holds a reserve of five items', () => {
    const { itemCounts } = DEFAULT_CONFIG;
    expect(itemCounts.lantern + itemCounts.keyhole + itemCounts.bell).toBe(5);
  });

  it('makeConfig overlays without mutating the default', () => {
    const c = makeConfig({ hushMode: 'oneNight', trailRadius: 2 });
    expect(c.hushMode).toBe('oneNight');
    expect(c.trailRadius).toBe(2);
    expect(c.callHandsRequired).toBe(2);
    expect(DEFAULT_CONFIG.hushMode).toBe('silent');
  });

  it('locks nested config containers against writes at compile time', () => {
    // Never invoked — it exists so tsc checks it. Delete the readonly modifiers
    // and this @ts-expect-error becomes unused, which is itself a compile error
    // (TS2578), so `npm test` fails.
    const wouldNotCompile = (c: GameConfig): void => {
      // @ts-expect-error itemCounts is readonly: writing through any config would
      // corrupt DEFAULT_CONFIG, because makeConfig's spread shares the object.
      c.itemCounts.lantern = 999;
    };
    expect(wouldNotCompile).toBeTypeOf('function');
  });

  it('shares nested containers with the default, which is why they are locked', () => {
    expect(makeConfig({ trailRadius: 2 }).itemCounts).toBe(DEFAULT_CONFIG.itemCounts);
  });
});
