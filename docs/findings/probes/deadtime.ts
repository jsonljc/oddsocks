/**
 * How long does a taken child sit silent?
 *
 * The v6 spec's mitigation for early elimination is Rescue (§8). `grep -ri rescue src/v6`
 * returns nothing, so the mitigation is unbuilt and the raw number below is what a player
 * actually experiences today.
 *
 * Run: npx tsx docs/findings/probes/deadtime.ts
 */
import { CHILD_POLICIES, VILLAIN_POLICIES, type ChildPolicy, type VillainPolicy } from '../../../src/v6/bots/policies.js';
import { makeConfig } from '../../../src/v6/rules/config.js';
import { playGame } from '../../../src/v6/rules/game.js';
import type { Bot } from '../../../src/v6/bots/types.js';
import type { PlayerId } from '../../../src/v6/rules/types.js';

const GAMES = 2000;
const config = makeConfig();

function playWithRoles(seed: number, child: ChildPolicy, villain: VillainPolicy) {
  // Mirrors analysis/sweep.ts: villain is the first rng draw, so probe then replay.
  const probe = playGame(config, seed,
    Object.fromEntries(config.roster.map((p) => [p, CHILD_POLICIES.random])) as Record<PlayerId, Bot>);
  const boss = VILLAIN_POLICIES[villain];
  const kid = CHILD_POLICIES[child];
  return playGame(config, seed,
    Object.fromEntries(config.roster.map((p) => [p, p === probe.villain ? boss : kid])) as Record<PlayerId, Bot>);
}

function pct(n: number, d: number) { return d === 0 ? '  n/a' : `${((n / d) * 100).toFixed(1)}%`; }

for (const villain of ['light', 'hunter', 'random'] as VillainPolicy[]) {
  let games = 0, gameNights = 0;
  let takenTotal = 0;
  let deadNightsTotal = 0;          // nights a taken child spent silent
  let livePlayerNights = 0;         // total child-nights that were actually played
  let allPlayerNights = 0;          // total child-nights the session lasted
  const takeNight: number[] = [];   // histogram of the night each take happened
  const deadNightsHist: number[] = [];
  let gamesWithEarlyTake = 0;       // a take on night 1 or 2
  let worstDead = 0;

  for (let i = 0; i < GAMES; i++) {
    const rec = playWithRoles(1 + i, 'searcher', villain);
    const N = rec.nights.length;
    games++; gameNights += N;

    const children = config.roster.filter((p) => p !== rec.villain);
    allPlayerNights += children.length * N;

    let early = false;
    const diedOn: Record<string, number> = {};
    rec.nights.forEach((n, idx) => {
      if (n.took) {
        const night = idx + 1;
        diedOn[n.took] = night;
        takeNight[night] = (takeNight[night] ?? 0) + 1;
        takenTotal++;
        const dead = N - night;      // nights after the one they were taken on
        deadNightsTotal += dead;
        deadNightsHist[dead] = (deadNightsHist[dead] ?? 0) + 1;
        if (dead > worstDead) worstDead = dead;
        if (night <= 2) early = true;
      }
    });
    if (early) gamesWithEarlyTake++;

    for (const c of children) {
      const d = diedOn[c];
      livePlayerNights += d === undefined ? N : d;
    }
  }

  console.log(`\n${'='.repeat(64)}\nVILLAIN: ${villain}   (${GAMES} games, searcher children)\n${'='.repeat(64)}`);
  console.log(`mean game length          ${(gameNights / games).toFixed(2)} nights`);
  console.log(`children taken per game   ${(takenTotal / games).toFixed(2)}`);
  console.log(`games w/ take by night 2  ${pct(gamesWithEarlyTake, games)}   <-- players who lose the session early`);
  console.log(`\ntake by night:`);
  for (let n = 1; n < takeNight.length; n++) {
    const c = takeNight[n] ?? 0;
    if (c === 0) continue;
    console.log(`  night ${String(n).padStart(2)}  ${String(c).padStart(5)}  ${pct(c, takenTotal).padStart(6)} of all takes  ${'#'.repeat(Math.round((c / takenTotal) * 50))}`);
  }
  console.log(`\nnights spent dead, per taken child:`);
  for (let d = 0; d < deadNightsHist.length; d++) {
    const c = deadNightsHist[d] ?? 0;
    if (c === 0) continue;
    console.log(`  ${String(d).padStart(2)} nights  ${String(c).padStart(5)}  ${pct(c, takenTotal).padStart(6)}  ${'#'.repeat(Math.round((c / takenTotal) * 50))}`);
  }
  console.log(`\nmean dead nights          ${(deadNightsTotal / Math.max(takenTotal, 1)).toFixed(2)}  (worst seen: ${worstDead})`);
  console.log(`SHARE OF CHILD-NIGHTS SPENT DEAD   ${pct(allPlayerNights - livePlayerNights, allPlayerNights)}`);
  console.log(`  -> of every 100 nights a child sits at the table, that many are silent.`);
}
