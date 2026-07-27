import { describe, it, expect } from 'vitest';
import { runSweep, BASELINE_CELLS } from './sweep.js';
import { formatTable } from './report.js';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { heuristicBot } from '../bots/heuristic.js';
import { measure } from './metrics.js';

describe('runSweep', () => {
  it('returns one result per cell', () => {
    const cells = [
      { label: 'a', overrides: {}, games: 20 },
      { label: 'b', overrides: { trailRadius: 2 }, games: 20 },
    ];
    const r = runSweep(cells, 1);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.label)).toEqual(['a', 'b']);
    expect(r[0]!.games).toBe(20);
  });

  it('reports rates that sum to one across the three outcomes', () => {
    const [r] = runSweep([{ label: 'x', overrides: {}, games: 60 }], 5);
    expect(r!.caughtRate + r!.survivedRate + r!.villainWinRate).toBeCloseTo(1, 6);
  });

  it('is deterministic for the same seed base', () => {
    const cell = [{ label: 'x', overrides: {}, games: 40 }];
    expect(JSON.stringify(runSweep(cell, 9))).toBe(JSON.stringify(runSweep(cell, 9)));
  });

  it('ships a baseline matrix that covers the open questions', () => {
    const labels = BASELINE_CELLS.map((c) => c.label);
    expect(labels).toContain('baseline');
    expect(labels.some((l) => l.includes('hush'))).toBe(true);
    expect(labels.some((l) => l.includes('marking'))).toBe(true);
    expect(labels.some((l) => l.includes('trail'))).toBe(true);
  });

  // forcedNight/neverForcedRate is a tautology (safeLies.test.ts: "the true claim
  // history is always consistent, so no game can be 'forced'") — it can never
  // discriminate a config. The real signal is whether the viable set ever narrows
  // to exactly the true room (hidingSpace === 1), which safeLies.test.ts's own
  // "collapses ... when fully witnessed" case proves is a real, reachable event.
  // Pin collapseRate/medianCollapseNight/meanThefts/fullQuotaRate against values
  // computed fresh here from the raw games, not through runSweep's own internals,
  // so a wrong aggregation (off-by-one night index, <=1 instead of ===1, mixing up
  // "first" collapse with "any", a wrong quota threshold) would diverge from it.
  it('reports collapse-to-truth and theft tempo matching an independent recomputation', () => {
    const config = makeConfig();
    const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));
    const games = 150;
    const seedBase = 7;

    let collapsedGames = 0;
    const firstCollapseNights: number[] = [];
    let theftTotal = 0;
    let fullQuotaGames = 0;

    for (let i = 0; i < games; i++) {
      const m = measure(playGame(config, seedBase + i, bots));
      const night = m.hidingSpace.findIndex((n) => n === 1);
      if (night !== -1) {
        collapsedGames++;
        firstCollapseNights.push(night + 1);
      }
      theftTotal += m.thefts;
      if (m.thefts >= config.lightsRequired) fullQuotaGames++;
    }

    const [r] = runSweep([{ label: 'x', overrides: {}, games }], seedBase);

    expect(r!.collapseRate).toBeCloseTo(collapsedGames / games, 9);
    expect(r!.meanThefts).toBeCloseTo(theftTotal / games, 9);
    expect(r!.fullQuotaRate).toBeCloseTo(fullQuotaGames / games, 9);

    const sorted = [...firstCollapseNights].sort((a, b) => a - b);
    const expectedMedian = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : null;
    expect(r!.medianCollapseNight).toBe(expectedMedian);

    // The recomputation itself must not be vacuous: some games in this sample
    // actually do collapse, or the collapseRate/medianCollapseNight checks above
    // would hold trivially at 0/null regardless of what the implementation does.
    expect(collapsedGames).toBeGreaterThan(0);
  });
});

describe('formatTable', () => {
  it('renders a header and one row per result', () => {
    const out = formatTable(runSweep([
      { label: 'a', overrides: {}, games: 10 },
      { label: 'b', overrides: {}, games: 10 },
    ], 2));
    const lines = out.trim().split('\n');
    // header + rule + exactly one row per result (2 results here) — a dropped
    // row must fail this, which `>= 3` previously would not have caught.
    expect(lines.length).toBe(4);
    expect(out).toContain('trailAcc');
  });
});
