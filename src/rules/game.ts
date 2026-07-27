import type { GameConfig } from './config.js';
import { makeRng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import type { NightRecord, Sighting } from './state.js';
import { type GameState, createGame, darkBedroomCount } from './state.js';
import { runDusk, runMidnight, runMorning,
  type DuskAction, type MidnightAction, type MorningAction } from './night.js';
import type { Bot, Knowledge } from '../bots/types.js';

export interface GameRecord {
  seed: number;
  config: GameConfig;
  villain: PlayerId;
  nights: NightRecord[];
  outcome: { winner: 'children' | 'oddsocks'; how: 'caught' | 'survived' | 'lightsOut' };
}

export function knowledgeFor(
  state: GameState,
  player: PlayerId,
  mySightings: Sighting[],
  claims: Record<PlayerId, RoomId | null>[],
): Knowledge {
  return {
    me: player,
    isVillain: player === state.villain,
    night: state.night,
    position: state.positions[player]!,
    held: [...state.held[player]!],
    lit: { ...state.lit },
    publicEvents: state.history.flatMap((h) => h.events),
    // Copy, don't alias: sightingLog[player] and claimLog both keep growing
    // after this call returns. Handing over the live arrays would let a bot
    // that retains this Knowledge object watch future nights appear in what
    // is supposed to be a frozen point-in-time snapshot.
    mySightings: [...mySightings],
    claims: [...claims],
    activeCall: state.activeCall,
    config: state.config,
  };
}

export function playGame(
  config: GameConfig,
  seed: number,
  bots: Readonly<Record<PlayerId, Bot>>,
): GameRecord {
  const rng = makeRng(seed);
  const state = createGame(config, rng);
  const sightingLog: Record<PlayerId, Sighting[]> =
    Object.fromEntries(config.roster.map((p) => [p, [] as Sighting[]]));
  const claimLog: Record<PlayerId, RoomId | null>[] = [];

  const ask = <T,>(pick: (bot: Bot, k: Knowledge) => T): Record<PlayerId, T> =>
    Object.fromEntries(config.roster.map((p) =>
      [p, pick(bots[p]!, knowledgeFor(state, p, sightingLog[p]!, claimLog))]));

  // A free self-snuff buys the villain tempo, not just cover: when
  // selfSnuffCostsNight is false, snuffing their own light does not spend one of
  // their limited nights, so the deadline moves out by one. They own a single
  // bedroom, so this can happen at most once.
  let extraNights = 0;

  for (let night = 1; night <= config.totalNights + extraNights; night++) {
    state.night = night;

    const dusk = runDusk(state,
      ask<DuskAction>((bot, k) => bot.dusk(k, rng)) as Record<PlayerId, DuskAction>, rng);

    const midnight = runMidnight(state, dusk,
      ask<MidnightAction>((bot, k) => bot.midnight(k, rng)) as Record<PlayerId, MidnightAction>,
      rng);

    for (const p of config.roster) sightingLog[p]!.push(midnight.sightings[p]!);

    const morning = runMorning(state, dusk, midnight,
      ask<MorningAction>((bot, k) => bot.morning(k, rng)) as Record<PlayerId, MorningAction>, rng);
    claimLog.push(morning.claims);

    state.history.push({
      night,
      duskPositions: dusk.positions,
      midnightPositions: midnight.positions,
      events: [...dusk.events, ...midnight.events, ...morning.events],
      sightings: midnight.sightings,
      claims: morning.claims,
    });

    // theft.selfSnuff is internal — publicly a self-snuff is just a light going out.
    if (!config.selfSnuffCostsNight && extraNights === 0 && midnight.theft.selfSnuff) {
      extraNights = 1;
    }

    if (state.over) break;
    if (darkBedroomCount(state) >= config.lightsRequired) {
      state.over = { winner: 'oddsocks', how: 'lightsOut' };
      break;
    }
  }

  const outcome = state.over ?? { winner: 'children' as const, how: 'survived' as const };
  return { seed, config, villain: state.villain, nights: state.history, outcome };
}
