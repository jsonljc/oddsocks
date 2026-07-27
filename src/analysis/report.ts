import type { SweepResult } from './sweep.js';

const COLUMNS: { key: keyof SweepResult; head: string; width: number }[] = [
  { key: 'label', head: 'config', width: 24 },
  { key: 'villainWinRate', head: 'villain', width: 8 },
  { key: 'caughtRate', head: 'caught', width: 8 },
  { key: 'survivedRate', head: 'survived', width: 9 },
  { key: 'neverForcedRate', head: 'neverFrc', width: 9 },
  { key: 'medianForcedNight', head: 'medFrc', width: 7 },
  { key: 'meanHidingSpace', head: 'hiding', width: 7 },
  { key: 'trailAccuracy', head: 'trailAcc', width: 9 },
  { key: 'callsPostedPerGame', head: 'posted', width: 7 },
  { key: 'callsLivePerGame', head: 'live', width: 6 },
  { key: 'meanItemHolders', head: 'holders', width: 8 },
  { key: 'encounterRate', head: 'encntr', width: 7 },
];

const cell = (value: unknown, width: number): string => {
  const text = value === null ? '—'
    : typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toFixed(3))
    : String(value);
  return text.padEnd(width).slice(0, width);
};

export function formatTable(results: readonly SweepResult[]): string {
  const head = COLUMNS.map((c) => c.head.padEnd(c.width)).join(' ');
  const rule = COLUMNS.map((c) => '─'.repeat(c.width)).join(' ');
  const rows = results.map((r) => COLUMNS.map((c) => cell(r[c.key], c.width)).join(' '));
  return [head, rule, ...rows].join('\n') + '\n';
}
