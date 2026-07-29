import { makeRng } from '../../rules/rng.js';
import type { Bot, Knowledge, Sighting } from '../bots/types.js';
import type { GameState } from './state.js';
import type { GameConfig } from './config.js';
import { landingOf } from './house.js';
import { type MorningAction, type NightAction, resolveMorning, resolveNight } from './night.js';
import { type HouseEvent, type NightRecord, alive, createGame } from './state.js';
import type { Outcome, PlayerId } from './types.js';

export type GameOutcome = Outcome | { readonly winner: 'stalled'; readonly how: 'maxNights' };

export interface GameRecord {
  readonly seed: number;
  readonly config: GameConfig;
  readonly villain: PlayerId;
  readonly nights: readonly NightRecord[];
  readonly outcome: GameOutcome;
}

function knowledgeFor(
  s: GameState, p: PlayerId, sightings: readonly Sighting[], events: readonly HouseEvent[],
): Knowledge {
  return {
    me: p,
    isVillain: p === s.villain,
    night: s.night,
    position: s.positions[p]!,
    held: s.held[p] ?? null,
    alive: alive(s),
    cleared: [...s.cleared],
    // Copies, not aliases: these keep growing after the call returns, and a bot
    // that retained the object would otherwise watch future nights appear in
    // what is meant to be a frozen snapshot.
    publicEvents: [...events],
    mySightings: [...sightings],
    wax: { ...s.wax },
    burningAt: { ...s.lanternsAt },
    namedTonight: s.naming?.target ?? null,
    config: s.config,
  };
}

export function playGame(
  config: GameConfig,
  seed: number,
  bots: Readonly<Record<PlayerId, Bot>>,
): GameRecord {
  const rng = makeRng(seed);
  const s = createGame(config, rng);
  const sightings: Record<PlayerId, Sighting[]> =
    Object.fromEntries(config.roster.map((p) => [p, [] as Sighting[]]));
  const publicEvents: HouseEvent[] = [];

  for (let night = 1; night <= config.maxNights; night++) {
    s.night = night;
    const living = alive(s);

    // Step 1. Morning declarations. A pair of socks buys one Naming.
    const morning: Record<PlayerId, MorningAction> = Object.fromEntries(living.map((p) =>
      [p, bots[p]!.morning(knowledgeFor(s, p, sightings[p]!, publicEvents), rng)]));
    const carried = resolveMorning(s, morning);
    publicEvents.push(...carried);

    // Step 2. If a Naming stands, the Named commits first and in the open, so
    // everyone else chooses knowing where they will be.
    const actions: Record<PlayerId, NightAction> = {};
    const named = s.naming?.target ?? null;
    if (named) {
      actions[named] = bots[named]!.night(
        knowledgeFor(s, named, sightings[named]!, publicEvents), rng);
      publicEvents.push({ t: 'walksOpen', player: named, to: actions[named]!.to });
    }
    // Step 3. Everyone else commits in secret.
    for (const p of living) {
      if (p === named) continue;
      actions[p] = bots[p]!.night(knowledgeFor(s, p, sightings[p]!, publicEvents), rng);
    }

    const record = resolveNight(s, actions, carried);
    for (const p of alive(s)) {
      const saw = record.sightings[p];
      if (saw) sightings[p]!.push({ night, ...saw });
    }
    publicEvents.push(...record.events);
    s.history.push(record);

    if (s.over) break;
  }

  return {
    seed,
    config,
    villain: s.villain,
    nights: s.history,
    // Wax is monotone and every candle loses at least one a night, so the house
    // always darkens. Reaching the cap means a rule stopped being monotone.
    outcome: s.over ?? { winner: 'stalled', how: 'maxNights' },
  };
}

/** The landing a sock in this room implicates on the nights either side. */
export const pins = (config: GameConfig, room: string): string =>
  landingOf(config.house, room);
