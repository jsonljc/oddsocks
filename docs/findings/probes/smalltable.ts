/**
 * Does ODD SOCKS work below six players?
 *
 * Liquidity is the gate on a 6-player game. `SCALES` supports 4/6/8/10, but `startingWax` is
 * hardcoded [25,19,13] at every count while burn is (lit rooms) + (people under them) — so the
 * clock was tuned for six and nothing retunes it. Measure before anyone plans around "just
 * play at four".
 *
 * Run: npx tsx docs/findings/probes/smalltable.ts
 */
import { CHILD_POLICIES, VILLAIN_POLICIES, type VillainPolicy } from '../../../src/v6/bots/policies.js';
import { makeConfig } from '../../../src/v6/rules/config.js';
import { playGame } from '../../../src/v6/rules/game.js';
import { rosterFor } from '../../../src/v6/rules/house.js';
import type { Bot } from '../../../src/v6/bots/types.js';
import type { PlayerId } from '../../../src/v6/rules/types.js';

const GAMES = 1000;

function run(players: number, villain: VillainPolicy) {
  const config = makeConfig({ roster: rosterFor(players) });
  let childrenWin = 0, taken = 0, dark = 0, stalled = 0, nights = 0;
  let namings = 0, pairs = 0, lifted = 0, deadNights = 0, takes = 0;

  for (let i = 0; i < GAMES; i++) {
    const probe = playGame(config, 1 + i,
      Object.fromEntries(config.roster.map((p) => [p, CHILD_POLICIES.random])) as Record<PlayerId, Bot>);
    const rec = playGame(config, 1 + i, Object.fromEntries(config.roster.map((p) =>
      [p, p === probe.villain ? VILLAIN_POLICIES[villain] : CHILD_POLICIES.searcher])) as Record<PlayerId, Bot>);

    const N = rec.nights.length;
    nights += N;
    rec.nights.forEach((n, idx) => {
      if (n.took) { takes++; deadNights += N - (idx + 1); }
      pairs += n.pairsFormed; lifted += n.socksLifted;
      for (const e of n.events) if (e.t === 'naming') namings++;
    });
    if (rec.outcome.winner === 'children') childrenWin++;
    else if (rec.outcome.winner === 'stalled') stalled++;
    else if (rec.outcome.how === 'taken') taken++;
    else dark++;
  }
  const p = (x: number) => `${((x / GAMES) * 100).toFixed(1)}%`;
  console.log(
    `${String(players).padStart(2)}p  ${villain.padEnd(7)}` +
    `children ${p(childrenWin).padStart(6)}  ` +
    `taken ${p(taken).padStart(6)}  dark ${p(dark).padStart(6)}  stall ${p(stalled).padStart(6)}  ` +
    `nights ${(nights / GAMES).toFixed(1).padStart(5)}  ` +
    `socks ${(lifted / GAMES).toFixed(2).padStart(5)}  pairs ${(pairs / GAMES).toFixed(2).padStart(5)}  ` +
    `namings ${(namings / GAMES).toFixed(2).padStart(5)}  ` +
    `deadNts ${(deadNights / Math.max(takes, 1)).toFixed(2).padStart(5)}`,
  );
}

for (const players of [4, 6, 8, 10]) {
  console.log('-'.repeat(132));
  for (const v of ['light', 'hunter', 'random'] as VillainPolicy[]) run(players, v);
}
