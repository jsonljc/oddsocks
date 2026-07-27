import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, type GameState } from './state.js';
import {
  runDusk, runMidnight, runMorning,
  type DuskAction, type MidnightAction, type MorningAction,
} from './night.js';
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
  it('takes no light even when the villain stands in a lit bedroom, and resolves no Call or marking', () => {
    const s = game();
    s.night = 1;
    // A live Call with two willing hands, and a villain who would otherwise be
    // eligible to mark — both must sit inert, since night 1 shares the same
    // `active` guard as the theft.
    s.held['bell'] = ['keyhole'];
    s.held['pike'] = ['lantern'];
    s.positions['bell'] = 'kitchen';
    s.positions['pike'] = 'kitchen';
    s.activeCall = { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false };

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s, { moss: ['sewing_room', 'bed_sparrow'] }),
      bell: { path: ['east_hall', 'bed_clem'], joinCall: true, snuffOwn: false },
      pike: { path: ['east_hall', 'bed_clem'], joinCall: true, snuffOwn: false },
    }, makeRng(1));

    expect(mid.theft.stole).toBe(false);
    expect(s.lit['bed_sparrow']).toBe(true);
    expect(mid.caught).toBe(false);
    expect(mid.marked).toBeNull();
    expect(mid.events.some((e) => e.t === 'callResolved')).toBe(false);
    // If the Call had actually resolved, both hands would have spent their item.
    expect(s.held['bell']).toEqual(['keyhole']);
    expect(s.held['pike']).toEqual(['lantern']);
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

describe('marking through runMidnight', () => {
  it('marks the lone other occupant of a dark bedroom, and it is not a theft', () => {
    const s = game();
    s.night = 3;
    s.lit['bed_bell'] = false;
    s.positions['moss'] = 'kitchen'; // two rooms from bed_bell, so it can be reached

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s),
      // bell stays home by default, so this puts exactly the villain and bell
      // together in bed_bell — no third player.
      moss: { path: ['west_hall', 'bed_bell'], joinCall: false, snuffOwn: false },
    }, makeRng(1));

    expect(mid.theft.stole).toBe(false);
    expect(mid.marked).toBe('bell');
    expect(s.marked['bell']).toBe(true);
  });

  it('never marks in a common room, even though nothing else happened', () => {
    const s = game();
    s.night = 3;
    s.positions['moss'] = 'kitchen';

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    // moss "stays" in the kitchen — a common room, never dark — through midnight too.
    const mid = runMidnight(s, dusk, allMid(s), makeRng(1));

    expect(mid.theft.stole).toBe(false);
    expect(mid.theft.events).toEqual([]);
    expect(mid.marked).toBeNull();
  });

  it('does not mark on a self-snuffed night, even with another player in the now-dark room', () => {
    const s = game();
    s.night = 3;

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s),
      // moss stays home and snuffs their own light; sparrow walks in to share it.
      moss: { path: ['sewing_room', 'bed_moss'], joinCall: false, snuffOwn: true },
      sparrow: { path: ['sewing_room', 'bed_moss'], joinCall: false, snuffOwn: false },
    }, makeRng(1));

    expect(mid.theft.stole).toBe(false);
    expect(mid.theft.events).toEqual([{ t: 'selfSnuff', room: 'bed_moss' }]);
    // The self-snuff already produced an event, so the marking gate — which
    // requires *no* theft event, not merely no theft — must stay shut.
    expect(mid.marked).toBeNull();
    expect(s.marked['sparrow']).toBe(false);
  });
});

describe('runMorning Call gating', () => {
  const morningActions = (
    over: Record<string, Partial<MorningAction>> = {},
  ): Record<string, MorningAction> =>
    Object.fromEntries(ROSTER.map((p) => [
      p, { claim: null, call: null, itemUses: [], ...over[p] },
    ]));

  it('does not post a Call aimed at a common room', () => {
    const s = game();
    s.night = 3;
    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, allMid(s), makeRng(1));

    runMorning(s, dusk, mid, morningActions({
      bell: { call: { caller: 'bell', target: 'moss', room: 'kitchen', selfNominated: false } },
    }), makeRng(1));

    expect(s.activeCall).toBeNull();
  });

  it('does not post a Call aimed at a dark bedroom', () => {
    const s = game();
    s.night = 3;
    s.lit['bed_clem'] = false;
    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, allMid(s), makeRng(1));

    runMorning(s, dusk, mid, morningActions({
      bell: { call: { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false } },
    }), makeRng(1));

    expect(s.activeCall).toBeNull();
  });

  it('still posts a legal Call on a lit bedroom', () => {
    const s = game();
    s.night = 3;
    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, allMid(s), makeRng(1));

    runMorning(s, dusk, mid, morningActions({
      bell: { call: { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false } },
    }), makeRng(1));

    expect(s.activeCall).toEqual({ caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false });
  });

  it('does not spend the maxCallsPerNight slot on an illegal Call, leaving it free for a legal one', () => {
    const s = game();
    s.night = 3;
    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, allMid(s), makeRng(1));

    // bell (processed first) proposes an illegal common-room Call; pike proposes
    // a legal one. Only one call should ever go through (maxCallsPerNight is 1),
    // and it must be pike's — proof the illegal Call didn't consume the slot.
    runMorning(s, dusk, mid, morningActions({
      bell: { call: { caller: 'bell', target: 'moss', room: 'kitchen', selfNominated: false } },
      pike: { call: { caller: 'pike', target: 'moss', room: 'bed_clem', selfNominated: false } },
    }), makeRng(1));

    expect(s.activeCall).toEqual({ caller: 'pike', target: 'moss', room: 'bed_clem', selfNominated: false });
  });
});
