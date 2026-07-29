import { type Cell, type Result, runCell } from '../analysis/sweep.js';
import type { ChildPolicy, VillainPolicy } from '../bots/policies.js';
import { HOLLOW_20, HOLLOW_20_RING } from '../rules/house.js';

const ring = process.argv.includes('--ring');
const house = ring ? HOLLOW_20_RING : HOLLOW_20;

const games = Number(process.argv[2] ?? 500);

const children: ChildPolicy[] = ['huddle', 'searcher', 'random'];
const villains: VillainPolicy[] = ['light', 'hunter', 'random'];

const pct = (x: number) => (Number.isNaN(x) ? '   —  ' : `${(x * 100).toFixed(1).padStart(5)}%`);

console.log(`\nODD SOCKS v6 — ${games} games per cell — ${ring ? 'spokes RINGED' : 'spokes are dead ends'}\n`);
console.log(
  '  children   villain  | kids win  cornrd  taken   dark  stall | nights takes  shed | namings  acc  |' +
  ' reads lifted pairs',
);
console.log('  ' + '-'.repeat(115));

const results: Result[] = [];
for (const child of children) {
  for (const villain of villains) {
    const cell: Cell = { child, villain, overrides: { house } };
    const r = runCell(cell, games);
    results.push(r);
    console.log(
      `  ${child.padEnd(9)} ${villain.padEnd(8)} |` +
      `${pct(r.childrenWin)} ${pct(r.cornered)} ${pct(r.takenOut)} ${pct(r.darkOut)} ${pct(r.stalled)} |` +
      ` ${r.meanNights.toFixed(1).padStart(5)} ${r.meanTakes.toFixed(2).padStart(5)}` +
      ` ${r.meanSocksShed.toFixed(1).padStart(5)} |` +
      ` ${String(r.namings).padStart(7)} ${pct(r.namingAccuracy)} |` +
      ` ${r.meanFloorsRead.toFixed(1).padStart(5)} ${r.meanSocksLifted.toFixed(2).padStart(5)}` +
      ` ${String(r.pairsAssembled).padStart(5)}`,
    );
  }
}

console.log('\n  Per-night takes (index = night 1..n). Read this before believing any mean:');
for (const r of results) {
  if (r.meanTakes === 0) continue;
  console.log(`    ${r.label.padEnd(22)} ${r.takesByNight.join(' ')}`);
}

const huddle = results.filter((r) => r.label.startsWith('huddle'));
console.log('\n  THE ASSERTION THE DESIGN LIVES ON — the huddle must lose:');
for (const r of huddle) {
  const verdict = r.childrenWin === 0 ? 'loses' : `WINS ${pct(r.childrenWin)} — SPINE FAILED`;
  console.log(`    ${r.label.padEnd(22)} ${verdict}`);
}
console.log();
