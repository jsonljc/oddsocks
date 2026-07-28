import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, type GameState } from './state.js';
import { canPostCall, postCall, canJoinCall, resolveCall } from './call.js';

const armed = (): GameState => {
  const s = createGame(makeConfig(), makeRng(1));
  s.villain = 'moss';
  s.night = 3;
  s.held['bell'] = ['keyhole'];
  s.held['pike'] = ['lantern'];
  s.activeCall = { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false };
  return s;
};

describe('posting', () => {
  it('accepts a lit bedroom', () => {
    expect(canPostCall(armed(), 'moss', 'bed_clem')).toBe(true);
  });

  it('rejects commons and dark bedrooms', () => {
    const s = armed();
    expect(canPostCall(s, 'moss', 'kitchen')).toBe(false);
    s.lit['bed_clem'] = false;
    expect(canPostCall(s, 'moss', 'bed_clem')).toBe(false);
  });

  it('announces the call publicly', () => {
    const s = createGame(makeConfig(), makeRng(1));
    const events = postCall(s, { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false });
    expect(events[0]).toMatchObject({ t: 'callPosted', caller: 'bell', target: 'moss' });
    expect(s.activeCall?.target).toBe('moss');
  });
});

describe('joining', () => {
  it('requires an item and an unmarked hand', () => {
    const s = armed();
    expect(canJoinCall(s, 'bell')).toBe(true);
    expect(canJoinCall(s, 'clem')).toBe(false);
    s.marked['bell'] = true;
    expect(canJoinCall(s, 'bell')).toBe(false);
  });
});

describe('resolving', () => {
  it('catches the villain when two hands arrive and the target is Odd Socks', () => {
    const s = armed();
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', moss: 'bed_clem' }, ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(true);
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'caught')).toBe(true);
  });

  it('clears an innocent who arrives, and spends the items', () => {
    const s = armed();
    s.activeCall!.target = 'clem';
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', clem: 'bed_clem' }, ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(false);
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'cleared')).toBe(true);
    expect(s.held['bell']).toEqual([]);
    expect(s.held['pike']).toEqual([]);
  });

  it('spends the items even when the target never comes', () => {
    const s = armed();
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', moss: 'kitchen' }, ['bell', 'pike'], makeRng(1));
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'noShow')).toBe(true);
    expect(s.held['bell']).toEqual([]);
  });

  it('spends nothing when only one hand arrives', () => {
    const s = armed();
    const out = resolveCall(s, { bell: 'bed_clem', moss: 'bed_clem' }, ['bell'], makeRng(1));
    expect(out.caught).toBe(false);
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'fizzled')).toBe(true);
    expect(s.held['bell']).toEqual(['keyhole']);
  });

  it('ignores a joiner who did not actually reach the room', () => {
    const s = armed();
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'kitchen', moss: 'bed_clem' }, ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(false);
    expect(s.held['pike']).toEqual(['lantern']);
  });

  it('does not catch a villain who is present but was not the named target', () => {
    const s = armed();
    s.activeCall!.target = 'clem';
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', moss: 'bed_clem', clem: 'kitchen' },
      ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(false);
  });

  it('opens the eyes of a self-nominated target who fails to arrive', () => {
    const s = armed();
    s.activeCall = { caller: 'moss', target: 'moss', room: 'bed_clem', selfNominated: true };
    resolveCall(s, { bell: 'bed_clem', pike: 'bed_clem', moss: 'attic' }, ['bell', 'pike'], makeRng(1));
    expect(s.eyesOpen['moss']).toBe(true);
  });
});
