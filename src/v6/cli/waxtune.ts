import { runCell } from '../analysis/sweep.js';
const options = [[17,13,9],[21,16,11],[25,19,13],[29,22,15],[34,26,18]];
console.log('\n  wax          | kids win vs light / hunter / random | nights | Corner | naming acc');
console.log('  ' + '-'.repeat(80));
for (const startingWax of options) {
  const cells = (['light','hunter','random'] as const).map((v) =>
    runCell({ child: 'searcher', villain: v, overrides: { startingWax } }, 250));
  const hud = runCell({ child: 'huddle', villain: 'hunter', overrides: { startingWax } }, 150);
  const w = cells.map((c) => `${(c.childrenWin*100).toFixed(0).padStart(3)}%`).join(' / ');
  const n = (cells.reduce((a,c)=>a+c.meanNights,0)/3).toFixed(1);
  const acc = (cells.reduce((a,c)=>a+c.namingAccuracy,0)/3*100).toFixed(0);
  const cor = (cells.reduce((a,c)=>a+c.cornered,0)/3*100).toFixed(0);
  console.log(`  ${String(startingWax).padEnd(12)} |        ${w}          |  ${n.padStart(4)}  |  ${cor.padStart(3)}%  |  ${acc.padStart(3)}%   ${hud.childrenWin>0?'HUDDLE WINS':''}`);
}
