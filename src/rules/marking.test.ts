import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, type GameState } from './state.js';
import { resolveMarking } from './marking.js';

const dark = (villain = 'moss'): GameState => {
  const s = createGame(makeConfig(), makeRng(1));
  s.villain = villain;
  s.night = 3;
  s.lit['bed_bell'] = false;
  return s;
};

describe('resolveMarking', () => {
  it('marks the one eligible child in a dark room', () => {
    const s = dark();
    const out = resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1));
    expect(out.marked).toBe('pike');
    expect(s.marked['pike']).toBe(true);
  });

  it('marks one at random when several are present', () => {
    const s = dark();
    const out = resolveMarking(s,
      { moss: 'bed_bell', pike: 'bed_bell', clem: 'bed_bell' }, makeRng(4));
    expect(['pike', 'clem']).toContain(out.marked);
  });

  it('wastes the night when the room is empty', () => {
    const s = dark();
    expect(resolveMarking(s, { moss: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });

  it('never marks the villain or an already-marked child', () => {
    const s = dark();
    s.marked['pike'] = true;
    expect(resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });

  it('does nothing in a lit room', () => {
    const s = dark();
    expect(resolveMarking(s, { moss: 'kitchen', pike: 'kitchen' }, makeRng(1)).marked).toBeNull();
    expect(resolveMarking(s, { moss: 'bed_clem', pike: 'bed_clem' }, makeRng(1)).marked).toBeNull();
  });

  it('does nothing in a room a Lantern has relit', () => {
    const s = dark();
    s.lanternRoom = 'bed_bell';
    expect(resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });

  it('does nothing when the marking layer is off', () => {
    const s = createGame(
      makeConfig({ layers: { items: true, oddities: true, marking: false } }), makeRng(1));
    s.villain = 'moss';
    s.lit['bed_bell'] = false;
    expect(resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });
});
