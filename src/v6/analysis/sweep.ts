import { CHILD_POLICIES, VILLAIN_POLICIES, type ChildPolicy, type VillainPolicy } from '../bots/policies.js';
import type { Bot } from '../bots/types.js';
import { type GameConfig, makeConfig } from '../rules/config.js';
import { type GameRecord, playGame } from '../rules/game.js';
import type { PlayerId } from '../rules/types.js';

export interface Cell {
  readonly child: ChildPolicy;
  readonly villain: VillainPolicy;
  readonly overrides?: Partial<GameConfig>;
}

export interface Result {
  readonly label: string;
  readonly games: number;
  readonly childrenWin: number;
  readonly cornered: number;
  readonly takenOut: number;
  readonly darkOut: number;
  readonly stalled: number;
  readonly meanNights: number;
  readonly meanTakes: number;
  readonly meanSocksShed: number;
  readonly namings: number;
  /** Namings that hit the villain, over namings made. NaN when none were made. */
  readonly namingAccuracy: number;
  /** Share of nights on which a take was legal — exactly two in a room, one of them Odd Socks. */
  readonly takeLegalRate: number;
  /** Per-night take counts. This project has been burned four times by an
   *  aggregate that was one night's artefact; always read this before the mean. */
  readonly takesByNight: readonly number[];
  /** Diagnostics: is the children's route physically happening at all? */
  readonly meanFloorsRead: number;
  readonly meanSocksLifted: number;
  readonly pairsAssembled: number;
}

function botsFor(config: GameConfig, villain: PlayerId, cell: Cell): Record<PlayerId, Bot> {
  const child = CHILD_POLICIES[cell.child];
  const boss = VILLAIN_POLICIES[cell.villain];
  return Object.fromEntries(config.roster.map((p) => [p, p === villain ? boss : child]));
}

/**
 * The villain is drawn inside `playGame`, but policies differ by role, so each
 * game is played twice on one seed: once with uniform bots to learn who the
 * villain is, then again with the right policies. Reported `games` is therefore
 * half the games actually simulated.
 *
 * DEPENDS ON THE VILLAIN BEING THE FIRST RNG DRAW in `createGame`. If that ever
 * stops being true the probe silently desynchronises from the real game, every
 * policy is assigned to the wrong player, and nothing in the suite fails.
 */
function playWithRoles(config: GameConfig, seed: number, cell: Cell): GameRecord {
  // createGame picks the villain with the first rng draw, so play once with a
  // uniform bot set to learn who it is, then replay with the right policies.
  const probe = playGame(config, seed,
    Object.fromEntries(config.roster.map((p) => [p, CHILD_POLICIES.random])));
  return playGame(config, seed, botsFor(config, probe.villain, cell));
}

export function runCell(cell: Cell, games: number, seed0 = 1): Result {
  const config = makeConfig(cell.overrides);
  let childrenWin = 0, cornered = 0, takenOut = 0, darkOut = 0, stalled = 0;
  let nights = 0, takes = 0, shed = 0, namings = 0, namingHits = 0;
  let takeLegal = 0, nightCount = 0, floorsRead = 0, socksLifted = 0, pairs = 0;
  const takesByNight: number[] = [];

  for (let i = 0; i < games; i++) {
    const rec = playWithRoles(config, seed0 + i, cell);
    nights += rec.nights.length;
    nightCount += rec.nights.length;

    rec.nights.forEach((n, idx) => {
      if (n.took) {
        takes++;
        takeLegal++;
        takesByNight[idx] = (takesByNight[idx] ?? 0) + 1;
      }
      if (n.shedAt) shed++;
      floorsRead += n.litSpokeReads;
      socksLifted += n.socksLifted;
      pairs += n.pairsFormed;
      for (const e of n.events) {
        if (e.t === 'naming') {
          namings++;
          if (e.target === rec.villain) namingHits++;
        }
      }
    });

    if (rec.outcome.winner === 'children') { childrenWin++; cornered++; }
    else if (rec.outcome.winner === 'stalled') stalled++;
    else if (rec.outcome.how === 'taken') takenOut++;
    else darkOut++;
  }

  return {
    label: `${cell.child} vs ${cell.villain}`,
    games,
    childrenWin: childrenWin / games,
    cornered: cornered / games,
    takenOut: takenOut / games,
    darkOut: darkOut / games,
    stalled: stalled / games,
    meanNights: nights / games,
    meanTakes: takes / games,
    meanSocksShed: shed / games,
    namings,
    namingAccuracy: namings === 0 ? NaN : namingHits / namings,
    takeLegalRate: nightCount === 0 ? 0 : takeLegal / nightCount,
    takesByNight: Array.from({ length: takesByNight.length }, (_, i) => takesByNight[i] ?? 0),
    meanFloorsRead: floorsRead / games,
    meanSocksLifted: socksLifted / games,
    pairsAssembled: pairs,
  };
}

export function sweep(cells: readonly Cell[], games: number): Result[] {
  return cells.map((c) => runCell(c, games));
}
