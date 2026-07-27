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
  neverForcedRate: number;
  medianForcedNight: number | null;
  meanHidingSpace: number;
  trailAccuracy: number;
  callsPostedPerGame: number;
  callsLivePerGame: number;
  meanItemHolders: number;
  encounterRate: number;
}

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

    return {
      label: cell.label,
      games: cell.games,
      villainWinRate: all.filter((m) => m.winner === 'oddsocks').length / cell.games,
      caughtRate: all.filter((m) => m.how === 'caught').length / cell.games,
      survivedRate: all.filter((m) => m.how === 'survived').length / cell.games,
      neverForcedRate: all.filter((m) => m.forcedNight === null).length / cell.games,
      medianForcedNight: median(forced),
      meanHidingSpace: mean(all.flatMap((m) => m.hidingSpace)),
      trailAccuracy: namings > 0 ? hits / namings : 0,
      callsPostedPerGame: mean(all.map((m) => m.callsPosted)),
      callsLivePerGame: mean(all.map((m) => m.callsLive)),
      meanItemHolders: mean(all.map((m) => m.meanItemHolders)),
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
