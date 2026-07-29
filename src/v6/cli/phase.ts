/**
 * Per-night distribution audit.
 *
 * The sweep's take counts came out as 168 0 137 0 61 7 ... — takes on odd
 * nights and none on even ones. Before believing any aggregate built on top of
 * that, find out whether the house has a metronome: spokes are dead ends and
 * movement is mandatory, so anyone who steps into one is forced back out the
 * next night, and everybody starts together.
 */
import { CHILD_POLICIES, VILLAIN_POLICIES } from '../bots/policies.js';
import { makeConfig } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { isSpoke } from '../rules/house.js';
import type { Bot } from '../bots/types.js';

const config = makeConfig();
const GAMES = Number(process.argv[2] ?? 400);

const inSpokes: number[] = [];
const players: number[] = [];
const takes: number[] = [];
const nightsPlayed: number[] = [];

for (let i = 0; i < GAMES; i++) {
  const probe = playGame(config, 500 + i,
    Object.fromEntries(config.roster.map((p) => [p, CHILD_POLICIES.random as Bot])));
  const bots = Object.fromEntries(config.roster.map((p) =>
    [p, p === probe.villain ? VILLAIN_POLICIES.hunter : CHILD_POLICIES.searcher]));
  const g = playGame(config, 500 + i, bots);

  g.nights.forEach((n, idx) => {
    const pos = Object.values(n.positions);
    inSpokes[idx] = (inSpokes[idx] ?? 0) + pos.filter((r) => isSpoke(config.house, r)).length;
    players[idx] = (players[idx] ?? 0) + pos.length;
    takes[idx] = (takes[idx] ?? 0) + (n.took ? 1 : 0);
    nightsPlayed[idx] = (nightsPlayed[idx] ?? 0) + 1;
  });
}

console.log(`\nODD SOCKS v6 — per-night audit, ${GAMES} games, searcher vs hunter\n`);
console.log('  night  games   in spokes   takes   take rate/game-night');
console.log('  ' + '-'.repeat(58));
for (let i = 0; i < nightsPlayed.length; i++) {
  const g = nightsPlayed[i] ?? 0;
  if (g < 20) continue;                     // too thin to read
  const share = (inSpokes[i] ?? 0) / (players[i] ?? 1);
  const rate = (takes[i] ?? 0) / g;
  console.log(
    `  ${String(i + 1).padStart(5)} ${String(g).padStart(6)} ` +
    `${(share * 100).toFixed(1).padStart(10)}% ${String(takes[i] ?? 0).padStart(7)} ` +
    `${(rate * 100).toFixed(1).padStart(12)}%`,
  );
}

const odd = takes.filter((_, i) => i % 2 === 0).reduce((a, b) => a + (b ?? 0), 0);
const even = takes.filter((_, i) => i % 2 === 1).reduce((a, b) => a + (b ?? 0), 0);
console.log(`\n  takes on odd nights: ${odd}      on even nights: ${even}`);
console.log('  If that split is near-total, the house is a metronome and every');
console.log('  take-rate average is really a statement about half the nights.\n');
