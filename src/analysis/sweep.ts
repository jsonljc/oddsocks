import type { GameConfig } from '../rules/config.js';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { heuristicBot } from '../bots/heuristic.js';
import { measure, type GameMetrics } from './metrics.js';

export interface SweepCell {
  label: string;
  overrides: Partial<GameConfig>;
  games: number;
}

export interface SweepResult {
  label: string;
  games: number;
  villainWinRate: number;
  caughtRate: number;
  survivedRate: number;
  /** Mean theft-type events (incl. self-snuffs) per game — the villain's raw tempo. */
  meanThefts: number;
  /** Share of games in which the villain's theft count reached its full quota
   *  (config.lightsRequired). Not identical to villainWinRate: a self-snuff
   *  counts here but does not by itself satisfy the win condition. */
  fullQuotaRate: number;
  /**
   * `neverForcedRate`/`medianForcedNight` are a structural property of the
   * solver's truth-preservation invariant, not a per-config measurement — the
   * villain's true claim history is always internally consistent, so
   * `forcedNight` is null for every game, in every config (see
   * safeLies.test.ts, "never reports a forced contradiction"). Kept because
   * they are still exact, real values (never wrong to report), but they
   * cannot discriminate one config from another. Read `collapseRate` /
   * `medianCollapseNight` below for the signal this looks like it should be.
   */
  neverForcedRate: number;
  medianForcedNight: number | null;
  /** Share of games in which the viable set ever narrows to exactly one room —
   *  which, by truth-preservation, can only be the villain's true room. This is
   *  the real "is the villain's cover ever blown down to a confession" signal. */
  collapseRate: number;
  /** Median night of the first such collapse, among games where it happens. */
  medianCollapseNight: number | null;
  /**
   * Share of games where a collapse happens on night 2 or later — i.e.
   * excluding night 1, which has no theft, marking, or Call, so a collapse
   * there costs the villain nothing. This is the number that answers "how
   * often is the villain's story pinned on a night where being pinned
   * actually matters," which `collapseRate` alone conflates with the (usually
   * much larger, usually free) night-1 exposure.
   */
  lateCollapseRate: number;
  meanHidingSpace: number;
  trailAccuracy: number;
  callsPostedPerGame: number;
  callsLivePerGame: number;
  /** Live Calls the target walked away from, per game — spec §6.2 #7. */
  dodgesPerGame: number;
  /** Live Calls that caught the villain, per game. Structurally 0 against any
   *  villain that notices its own name; kept because §6.2 #5 asks for it. */
  callsCaughtPerGame: number;
  /** Nights the villain marked somebody, per game. */
  markingsPerGame: number;
  /** Self-snuffs per game — the Hush exploit's own tempo cost, or lack of it. */
  selfSnuffsPerGame: number;
  /** Mean players per night holding an item and unmarked: the pool a Call can
   *  physically draw its hands from. Compare against `callHandsRequired`. */
  meanCallPool: number;
  encounterRate: number;
}

/** First night (1-indexed) the viable set narrows to exactly the true room, or
 *  null if it never does in the nights played. */
const firstCollapseNight = (hidingSpace: readonly number[]): number | null => {
  const i = hidingSpace.findIndex((n) => n === 1);
  return i === -1 ? null : i + 1;
};

/** Whether the viable set narrows to exactly the true room on night 2 or
 *  later — night 1 (index 0) is deliberately excluded, since it precedes any
 *  theft, marking, or Call and so cannot cost the villain anything. */
const collapsesAfterNight1 = (hidingSpace: readonly number[]): boolean =>
  hidingSpace.slice(1).some((n) => n === 1);

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export function runSweep(cells: readonly SweepCell[], seedBase = 0): SweepResult[] {
  const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));

  return cells.map((cell) => {
    const config = makeConfig(cell.overrides);
    const all: GameMetrics[] = [];
    for (let i = 0; i < cell.games; i++) {
      all.push(measure(playGame(config, seedBase + i, bots)));
    }

    const namings = all.reduce((n, m) => n + m.trailNamings, 0);
    const hits = all.reduce((n, m) => n + m.trailHits, 0);
    const forced = all.map((m) => m.forcedNight).filter((n): n is number => n !== null);
    const collapseNights = all
      .map((m) => firstCollapseNight(m.hidingSpace))
      .filter((n): n is number => n !== null);

    return {
      label: cell.label,
      games: cell.games,
      villainWinRate: all.filter((m) => m.winner === 'oddsocks').length / cell.games,
      caughtRate: all.filter((m) => m.how === 'caught').length / cell.games,
      survivedRate: all.filter((m) => m.how === 'survived').length / cell.games,
      meanThefts: mean(all.map((m) => m.thefts)),
      fullQuotaRate: all.filter((m) => m.thefts >= config.lightsRequired).length / cell.games,
      neverForcedRate: all.filter((m) => m.forcedNight === null).length / cell.games,
      medianForcedNight: median(forced),
      collapseRate: collapseNights.length / cell.games,
      medianCollapseNight: median(collapseNights),
      lateCollapseRate: all.filter((m) => collapsesAfterNight1(m.hidingSpace)).length / cell.games,
      meanHidingSpace: mean(all.flatMap((m) => m.hidingSpace)),
      trailAccuracy: namings > 0 ? hits / namings : 0,
      callsPostedPerGame: mean(all.map((m) => m.callsPosted)),
      callsLivePerGame: mean(all.map((m) => m.callsLive)),
      dodgesPerGame: mean(all.map((m) => m.dodges)),
      callsCaughtPerGame: mean(all.map((m) => m.callsCaught)),
      markingsPerGame: mean(all.map((m) => m.markings)),
      selfSnuffsPerGame: mean(all.map((m) => m.selfSnuffs)),
      meanCallPool: mean(all.map((m) => m.meanCallPool)),
      encounterRate: mean(all.map((m) => m.encounterRate)),
    };
  });
}

const N = 2000;

/** The matrix that answers the spec's six open questions. */
export const BASELINE_CELLS: SweepCell[] = [
  { label: 'baseline', overrides: {}, games: N },

  // Rung 1: does the core night loop work without items or oddities?
  { label: 'core-only', games: N,
    overrides: { layers: { items: false, oddities: false, marking: false } } },
  { label: 'core+items', games: N,
    overrides: { layers: { items: true, oddities: false, marking: false } } },

  // The Hush question — the one that could change the design.
  { label: 'hush-oneNight', overrides: { hushMode: 'oneNight' }, games: N },
  { label: 'hush-none', overrides: { hushMode: 'none' }, games: N },
  { label: 'hush-silent-freeSnuff',
    overrides: { hushMode: 'silent', selfSnuffCostsNight: false }, games: N },

  // Is marking dominant now that a Call needs only two hands?
  { label: 'marking-off', games: N,
    overrides: { layers: { items: true, oddities: true, marking: false } } },

  // Trail signal.
  { label: 'trail-radius-0', overrides: { trailRadius: 0 }, games: N },
  { label: 'trail-radius-2', overrides: { trailRadius: 2 }, games: N },

  // Can a Call ever assemble?
  { label: 'call-hands-3', overrides: { callHandsRequired: 3 }, games: N },
  { label: 'items-on-map-2', overrides: { itemsOnMap: 2 }, games: N },
  { label: 'items-on-map-4', overrides: { itemsOnMap: 4 }, games: N },
];
