import { describe, it, expect } from 'vitest';
import { runSweep, BASELINE_CELLS } from './sweep.js';
import { formatTable } from './report.js';

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
});

describe('formatTable', () => {
  it('renders a header and one row per result', () => {
    const out = formatTable(runSweep([
      { label: 'a', overrides: {}, games: 10 },
      { label: 'b', overrides: {}, games: 10 },
    ], 2));
    const lines = out.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(out).toContain('trailAcc');
  });
});
