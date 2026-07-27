import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, type GameState } from './state.js';
import { resolveOddities, type OddityContext } from './oddities.js';

const ctx = (over: Partial<OddityContext> = {}): OddityContext => ({
  startPositions: {}, duskPositions: {}, midnightPositions: {},
  duskSteps: {}, midnightSteps: {}, theftRoom: null, thiefDuskRoom: null, ...over,
});

const game = (): GameState => {
  const s = createGame(makeConfig(), makeRng(1)); s.villain = 'moss'; s.night = 3; return s;
};
const find = (events: ReturnType<typeof resolveOddities>, source: string) =>
  events.find((e) => e.t === 'oddity' && e.source === source) as
    { source: string; detail: string; payload: Record<string, unknown> } | undefined;

describe('public oddities', () => {
  it('Bell counts people in the rooms beside Bell', () => {
    const s = game();
    const events = resolveOddities(s, ctx({
      midnightPositions: { bell: 'west_hall', pike: 'kitchen', clem: 'bed_bell', moss: 'attic' },
    }));
    expect(find(events, 'bell')!.payload['count']).toBe(2);
  });

  it('Pike reports whether anyone used a staircase', () => {
    const s = game();
    const flat = resolveOddities(s, ctx({
      startPositions: { pike: 'bed_pike' },
      duskSteps: { pike: ['west_hall', 'kitchen'] },
      midnightSteps: { pike: ['west_hall', 'bed_bell'] },
    }));
    expect(find(flat, 'pike')!.payload['crossed']).toBe(false);

    const climbed = resolveOddities(s, ctx({
      startPositions: { pike: 'bed_pike' },
      duskSteps: { pike: ['west_hall', 'landing'] },
      midnightSteps: { pike: ['attic', 'bed_moss'] },
    }));
    expect(find(climbed, 'pike')!.payload['crossed']).toBe(true);
  });

  it('Clem counts item-holders sharing Clem\'s room', () => {
    const s = game();
    s.held['pike'] = ['keyhole'];
    s.held['moss'] = ['lantern'];
    const events = resolveOddities(s, ctx({
      midnightPositions: { clem: 'kitchen', pike: 'kitchen', moss: 'kitchen', bell: 'kitchen' },
    }));
    expect(find(events, 'clem')!.payload['count']).toBe(2);
  });
});

describe('private oddities', () => {
  it('announces Wren in the attic, publicly, whichever phase it was', () => {
    const s = game();
    const events = resolveOddities(s, ctx({
      duskPositions: { wren: 'attic' }, midnightPositions: { wren: 'landing' },
    }));
    expect(find(events, 'wren')!.detail).toBe('atticTell');
  });

  it('says nothing about Wren when Wren stayed out of the attic', () => {
    const s = game();
    const events = resolveOddities(s, ctx({
      duskPositions: { wren: 'landing' }, midnightPositions: { wren: 'bed_wren' },
    }));
    expect(find(events, 'wren')).toBeUndefined();
  });

  it('gives Sparrow the thief\'s dusk floor under sparrowMode dusk', () => {
    const s = game();
    const events = resolveOddities(s, ctx({ theftRoom: 'bed_bell', thiefDuskRoom: 'attic' }));
    expect(find(events, 'sparrow')!.payload['floor']).toBe(1);
  });

  it('reproduces the null oddity under sparrowMode asWritten', () => {
    const s = createGame(makeConfig({ sparrowMode: 'asWritten' }), makeRng(1));
    s.villain = 'moss'; s.night = 3;
    const events = resolveOddities(s, ctx({ theftRoom: 'bed_bell', thiefDuskRoom: 'attic' }));
    expect(find(events, 'sparrow')!.payload['floor']).toBe(0); // the robbed room's own floor
  });

  it('says nothing about Sparrow on a night with no theft', () => {
    expect(find(resolveOddities(game(), ctx()), 'sparrow')).toBeUndefined();
  });
});

describe('the layer switch', () => {
  it('emits nothing when oddities are off', () => {
    const s = createGame(
      makeConfig({ layers: { items: true, oddities: false, marking: true } }), makeRng(1));
    expect(resolveOddities(s, ctx({ midnightPositions: { bell: 'west_hall' } }))).toEqual([]);
  });
});
