import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, type GameState } from './state.js';
import { runDusk, runMidnight, type DuskAction, type MidnightAction } from './night.js';
import type { Path } from './types.js';

const stay = (s: GameState, p: string): Path => {
  const here = s.positions[p]!;
  return [s.config.house.rooms[here]!.doors[0]!, here] as Path;
};

const allDusk = (s: GameState, over: Record<string, Path> = {}): Record<string, DuskAction> =>
  Object.fromEntries(ROSTER.map((p) => [p, { path: over[p] ?? stay(s, p), pickUp: false }]));

const allMid = (s: GameState, over: Record<string, Path> = {},
  extra: Partial<MidnightAction> = {}): Record<string, MidnightAction> =>
  Object.fromEntries(ROSTER.map((p) => [p,
    { path: over[p] ?? stay(s, p), joinCall: false, snuffOwn: false, ...extra }]));

const game = (villain = 'moss'): GameState => {
  const s = createGame(makeConfig(), makeRng(1)); s.villain = villain; return s;
};

describe('night one is safe', () => {
  it('takes no light even when the villain stands in a lit bedroom', () => {
    const s = game();
    s.night = 1;
    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk,
      allMid(s, { moss: ['sewing_room', 'bed_sparrow'] }), makeRng(1));
    expect(mid.theft.stole).toBe(false);
    expect(s.lit['bed_sparrow']).toBe(true);
  });
});

describe('midnight ordering', () => {
  it('resolves a landed Call before the theft, so the light survives', () => {
    const s = game();
    s.night = 3;
    s.held['bell'] = ['keyhole'];
    s.held['pike'] = ['lantern'];
    // Everyone starts in the kitchen: bed_clem is a dead end off east_hall, so it
    // is reachable in exactly two edges only from two rooms away.
    s.positions['bell'] = 'kitchen';
    s.positions['pike'] = 'kitchen';
    s.positions['moss'] = 'kitchen';
    s.activeCall = { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false };

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s),
      bell: { path: ['east_hall', 'bed_clem'], joinCall: true, snuffOwn: false },
      pike: { path: ['east_hall', 'bed_clem'], joinCall: true, snuffOwn: false },
      moss: { path: ['east_hall', 'bed_clem'], joinCall: false, snuffOwn: false },
    }, makeRng(1));

    expect(mid.caught).toBe(true);
    expect(s.lit['bed_clem']).toBe(true);
    expect(mid.theft.stole).toBe(false);
    expect(s.over).toEqual({ winner: 'children', how: 'caught' });
  });

  it('computes sightings after the theft, so the victim sees only a shadow', () => {
    const s = game();
    s.night = 3;
    s.positions['moss'] = 'kitchen'; // two rooms from bed_bell, so it can be reached
    s.positions['bell'] = 'bed_bell';

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s),
      moss: { path: ['west_hall', 'bed_bell'], joinCall: false, snuffOwn: false },
      bell: { path: ['west_hall', 'bed_bell'], joinCall: false, snuffOwn: false },
    }, makeRng(1));

    expect(mid.theft.stole).toBe(true);
    expect(mid.sightings['bell']!.named).toEqual([]);
    expect(mid.sightings['bell']!.others).toBe(1);
    expect(mid.sightings['bell']!.lit).toBe(false);
    // The villain reads names in the dark.
    expect(mid.sightings['moss']!.named).toEqual(['bell']);
  });
});
