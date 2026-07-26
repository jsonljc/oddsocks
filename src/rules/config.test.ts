import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, ROSTER, ODDITY_OF, makeConfig } from './config.js';

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
    expect(DEFAULT_CONFIG.itemsCanBeDropped).toBe(false);
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
});
