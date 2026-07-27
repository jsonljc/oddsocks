import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { randomBot } from '../bots/random.js';
import { HOLLOW_HOUSE } from '../rules/houses/hollow.js';
import { bedroomOf } from '../rules/map.js';
import { viableRoomsAt, solve, reachableInFourHops } from './safeLies.js';
import type { GameRecord } from '../rules/game.js';
import type { NightRecord, Sighting } from '../rules/state.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number): GameRecord => playGame(makeConfig(), seed, bots);

/** A lit or dark sighting, matching `sightingsAt`'s shape, for hand-built fixtures. */
const sighting = (room: string, lit: boolean, others: number, named: string[] = []): Sighting =>
  ({ room, named, others, lit });

describe('reachableInFourHops', () => {
  it('cannot enter a dead-end bedroom whose one door cannot make a three-edge round trip', () => {
    expect(reachableInFourHops(HOLLOW_HOUSE, 'east_hall', 'bed_clem')).toBe(false);
    expect(reachableInFourHops(HOLLOW_HOUSE, 'landing', 'bed_wren')).toBe(false);
    expect(reachableInFourHops(HOLLOW_HOUSE, 'sewing_room', 'bed_moss')).toBe(false);
    expect(reachableInFourHops(HOLLOW_HOUSE, 'attic', 'bed_moss')).toBe(false);
  });

  it('enters a dead-end bedroom whose neighbour can make the three-edge round trip', () => {
    expect(reachableInFourHops(HOLLOW_HOUSE, 'west_hall', 'bed_bell')).toBe(true);
  });
});

describe('viableRoomsAt', () => {
  it('never marks a room viable when a lit-room witness saw the villain elsewhere', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = play(seed);
      g.nights.forEach((n, i) => {
        // Only a witness the Hush still lets speak can pin the villain — a
        // Hushed witness's sighting is true but was never made public testimony.
        const seen = ROSTER.some((p) =>
          p !== g.villain && n.reporters.includes(p) &&
          n.sightings[p]!.lit && n.sightings[p]!.named.includes(g.villain));
        if (!seen) return;
        const truth = n.midnightPositions[g.villain]!;
        expect(viableRoomsAt(g, i + 1)).toEqual([truth]);
      });
    }
  });

  it('always includes the villain\'s true room — the truth is never contradicted', () => {
    for (let seed = 0; seed < 60; seed++) {
      const g = play(seed);
      g.nights.forEach((n, i) => {
        expect(viableRoomsAt(g, i + 1)).toContain(n.midnightPositions[g.villain]);
      });
    }
  });

  it('refutes a lit room whose occupants did not name the villain', () => {
    const g = play(3);
    const night = g.nights[1]!;
    const occupied = ROSTER.find((p) =>
      p !== g.villain && night.reporters.includes(p) && night.sightings[p]!.lit &&
      night.midnightPositions[p] !== night.midnightPositions[g.villain]);
    if (!occupied) return;
    expect(viableRoomsAt(g, 2)).not.toContain(night.midnightPositions[occupied]);
  });

  it('keeps a range of viable rooms when the only witness to the villain is Hushed', () => {
    // Bell truly shares the lit kitchen with the villain, moss — the exact
    // fact pattern that collapses the space to one truth in the seed-driven
    // test above. But Bell was Hushed and so neither claims nor reports: no
    // 'reported' event names them, and they are absent from `reporters`.
    // Nobody else's testimony touches moss at all. This is the scenario Task
    // 17 exists to fix: a witness's sighting is true but was never made
    // public, so it must not pin the villain the way a real report would.
    const night: NightRecord = {
      night: 1,
      duskPositions: {
        bell: 'kitchen', pike: 'bed_pike', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'kitchen',
      },
      midnightPositions: {
        bell: 'kitchen', pike: 'bed_pike', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'kitchen',
      },
      events: [
        { t: 'reported', player: 'pike', room: 'bed_pike', named: [], others: 0, lit: true },
        { t: 'reported', player: 'clem', room: 'bed_clem', named: [], others: 0, lit: true },
        { t: 'reported', player: 'wren', room: 'bed_wren', named: [], others: 0, lit: true },
        { t: 'reported', player: 'sparrow', room: 'bed_sparrow', named: [], others: 0, lit: true },
        { t: 'reported', player: 'moss', room: 'kitchen', named: ['bell'], others: 1, lit: true },
        // No 'reported' event for bell — the Hush silenced them.
      ],
      sightings: {
        // Bell's sighting is true — they really did see moss — but it never
        // became public. `night.reporters` (below) is where that shows up.
        bell: sighting('kitchen', true, 1, ['moss']),
        pike: sighting('bed_pike', true, 0),
        clem: sighting('bed_clem', true, 0),
        wren: sighting('bed_wren', true, 0),
        sparrow: sighting('bed_sparrow', true, 0),
        moss: sighting('kitchen', true, 1, ['bell']),
      },
      claims: {
        bell: null, pike: 'bed_pike', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'kitchen',
      },
      reporters: ['pike', 'clem', 'wren', 'sparrow', 'moss'],
    };

    const record: GameRecord = {
      seed: 0,
      config: makeConfig(),
      villain: 'moss',
      nights: [night],
      outcome: { winner: 'children', how: 'survived' },
    };

    const truth = night.midnightPositions['moss'];
    const result = viableRoomsAt(record, 1);
    expect(result).toContain(truth);
    expect(result).not.toEqual([truth]);
    expect(result.length).toBeGreaterThan(1);
  });

  it('does not refute Clem\'s room over an item count a live Call could explain away', () => {
    // A live Call spends items from anonymous hands — callResolved carries only a
    // count, never who paid — so the villain could have spent their dusk pickup
    // there without any public trace. randomBot never posts a Call, so this
    // scenario cannot arise from a real seed; it has to be constructed directly.
    // Labelled night 2: Calls never resolve on night 1 (night.ts gates on
    // state.night > 1), so a live Call could not actually happen on night 1.
    const night: NightRecord = {
      night: 2,
      duskPositions: {
        bell: 'bed_bell', pike: 'bed_pike', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'bed_clem',
      },
      midnightPositions: {
        bell: 'bed_bell', pike: 'bed_pike', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'bed_clem',
      },
      events: [
        { t: 'itemTaken', player: 'moss', item: 'lantern', room: 'kitchen' },
        { t: 'callResolved', target: 'bell', room: 'landing', hands: 2, outcome: 'cleared' },
        { t: 'oddity', source: 'clem', detail: 'itemHolders', payload: { count: 0 } },
        // Nobody is Hushed in this isolated fixture, so every child reports —
        // the solver now reads these, not `sightings`, for witness testimony.
        { t: 'reported', player: 'bell', room: 'bed_bell', named: [], others: 0, lit: true },
        { t: 'reported', player: 'pike', room: 'bed_pike', named: [], others: 0, lit: true },
        { t: 'reported', player: 'clem', room: 'bed_clem', named: [], others: 1, lit: false },
        { t: 'reported', player: 'wren', room: 'bed_wren', named: [], others: 0, lit: true },
        { t: 'reported', player: 'sparrow', room: 'bed_sparrow', named: [], others: 0, lit: true },
        { t: 'reported', player: 'moss', room: 'bed_clem', named: ['clem'], others: 1, lit: false },
      ],
      sightings: {
        bell: sighting('bed_bell', true, 0),
        pike: sighting('bed_pike', true, 0),
        clem: sighting('bed_clem', false, 1),
        wren: sighting('bed_wren', true, 0),
        sparrow: sighting('bed_sparrow', true, 0),
        moss: sighting('bed_clem', false, 1, ['clem']),
      },
      claims: {
        bell: 'bed_bell', pike: 'bed_pike', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'bed_clem',
      },
      reporters: [...ROSTER],
    };

    const record: GameRecord = {
      seed: 0,
      config: makeConfig(),
      villain: 'moss',
      nights: [night],
      outcome: { winner: 'children', how: 'survived' },
    };

    // moss (the villain) truly shares Clem's dark room, picked something up at
    // dusk, and no grip touched them — a naive reading (pickedUp=1, count=0)
    // would refute it, but the live Call means holdings aren't provable.
    expect(viableRoomsAt(record, 1)).toContain('bed_clem');
  });
});

describe('solve', () => {
  it('reports a hiding space for every night played', () => {
    const g = play(11);
    const r = solve(g);
    expect(r.hidingSpace).toHaveLength(g.nights.length);
    for (const n of r.hidingSpace) expect(n).toBeGreaterThanOrEqual(0);
  });

  it('never reports a forced contradiction, since the truth is always available', () => {
    // The true claim history is always consistent, so no game can be "forced"
    // unless a constraint is wrong. This is the solver's own correctness check.
    for (let seed = 0; seed < 100; seed++) {
      expect(solve(play(seed)).forcedNight).toBeNull();
    }
  });

  it('collapses the hiding space to one when the villain is fully witnessed', () => {
    const g = play(5);
    const r = solve(g);
    g.nights.forEach((n, i) => {
      const witnessed = ROSTER.some((p) =>
        p !== g.villain && n.reporters.includes(p) &&
        n.sightings[p]!.lit && n.sightings[p]!.named.includes(g.villain));
      if (witnessed) expect(r.hidingSpace[i]).toBe(1);
    });
  });

  it('forces night 1 when the claim is unreachable from the villain\'s own starting bedroom', () => {
    // Everyone starts the game in bed_<playerId>, and bed_bell cannot reach
    // bed_wren in exactly four hops (see `reachableInFourHops` above). A
    // fully-witnessed night 1 placing the villain there anyway is exactly the
    // single-night fact pattern that would otherwise call it viable.
    const night: NightRecord = {
      night: 1,
      duskPositions: {
        bell: 'bed_wren', pike: 'bed_wren', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'bed_moss',
      },
      midnightPositions: {
        bell: 'bed_wren', pike: 'bed_wren', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'bed_moss',
      },
      events: [
        // Night 1 always precedes any theft, so nobody could yet be Hushed —
        // every child reports, matching their sighting exactly.
        { t: 'reported', player: 'bell', room: 'bed_wren', named: ['pike', 'wren'], others: 2, lit: true },
        { t: 'reported', player: 'pike', room: 'bed_wren', named: ['bell', 'wren'], others: 2, lit: true },
        { t: 'reported', player: 'clem', room: 'bed_clem', named: [], others: 0, lit: true },
        { t: 'reported', player: 'wren', room: 'bed_wren', named: ['bell', 'pike'], others: 2, lit: true },
        { t: 'reported', player: 'sparrow', room: 'bed_sparrow', named: [], others: 0, lit: true },
        { t: 'reported', player: 'moss', room: 'bed_moss', named: [], others: 0, lit: true },
      ],
      sightings: {
        bell: sighting('bed_wren', true, 2, ['pike', 'wren']),
        pike: sighting('bed_wren', true, 2, ['bell', 'wren']),
        clem: sighting('bed_clem', true, 0),
        wren: sighting('bed_wren', true, 2, ['bell', 'pike']),
        sparrow: sighting('bed_sparrow', true, 0),
        moss: sighting('bed_moss', true, 0),
      },
      claims: {
        bell: 'bed_wren', pike: 'bed_wren', clem: 'bed_clem',
        wren: 'bed_wren', sparrow: 'bed_sparrow', moss: 'bed_moss',
      },
      reporters: [...ROSTER],
    };

    const record: GameRecord = {
      seed: 0,
      config: makeConfig(),
      villain: 'bell',
      nights: [night],
      outcome: { winner: 'children', how: 'survived' },
    };

    // Confirms the fixture exercises the fix, not something else: single-night
    // facts alone (an accurate lit-room witness naming the villain) call
    // bed_wren viable.
    expect(viableRoomsAt(record, 1)).toEqual(['bed_wren']);

    // solve additionally requires night 1 to be reachable from bed_bell — it
    // is not, so the claim is forced out on the very first night.
    const r = solve(record);
    expect(r.forcedNight).toBe(1);
    expect(r.hidingSpace).toEqual([0]);
  });

  it('never breaks the chain solve\'s DP relies on: every true transition is reachable', () => {
    // forcedNight === null is an aggregate signal: a *different, false* room
    // surviving in the DP can satisfy it even if the true room was wrongly
    // dropped along the way. viableRoomsAt's own truth-inclusion test (above)
    // only covers the single-night constraints — it says nothing about solve's
    // chain, which has no equivalent per-night identity check, because solve
    // exposes only an aggregate count and a nullable forcedNight, never the
    // surviving room sets themselves. So verify the DP's premise directly,
    // against the real relation it is built from (the night-1 anchor at
    // bed_<villain>, and every forward/backward transition), rather than
    // solve's black-box output.
    for (let seed = 0; seed < 100; seed++) {
      const g = play(seed);
      const house = g.config.house;
      const start = bedroomOf(house, g.villain);
      const trueRooms = g.nights.map((n) => n.midnightPositions[g.villain]!);

      expect(reachableInFourHops(house, start, trueRooms[0]!)).toBe(true);
      for (let i = 1; i < trueRooms.length; i++) {
        expect(reachableInFourHops(house, trueRooms[i - 1]!, trueRooms[i]!)).toBe(true);
      }
    }
  });
});
