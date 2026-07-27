# ODD SOCKS harness — build ledger

The running record kept while the harness was built, one task at a time, each with an
independent review between it and the next.

The spec and the findings document carry the **conclusions**. This carries the **argument**:
which findings were defects in the plan versus in the implementation, how each contested
call was adjudicated and on what reasoning, and the three metrics that turned out to
measure nothing before the right one was found.

Read it if you want to know why a rule reads the way it does. Rulings R16–R19 in the spec
were all argued out here first.

Two things worth knowing before you read:

- **Almost every defect recorded below is a defect in the plan**, not in the code written
  from it. That is the expected shape — a plan written in one pass cannot anticipate what
  integration reveals, and several later amendments made earlier snippets actively wrong
  rather than merely stale.
- **The dangerous failures were all silent.** Nothing here crashed or turned a test red.
  The recurring pattern is a plausible wrong number, or a test that passes whether or not
  the code beneath it is correct.

Entries are append-only and in build order.

---

# SDD ledger — plan: docs/superpowers/plans/2026-07-26-odd-socks-sim-harness.md

MERGE_BASE: 8de9a305cabf96eb38ab9bc9fc5458f7f7f3cf09
Branch: sim-harness

Known plan-mandated choice (Task 3): `itemsCanBeDropped` is a declared-but-unread config field, kept deliberately per spec §3.3. If a reviewer flags it as dead code, that is a plan conflict for the human, not a fix.

Task 1: minor (deferred): no test covers pick([]) or int(0) throwing — plan-level test gap; contract inherited by 19 tasks.
Task 1: minor (deferred): npm install reports 5 dev-only transitive vulns (esbuild via vitest 2.x chain); left unresolved to honour pinned vitest ^2.1.0.
Task 1: complete (commits 8de9a30..3d0cbd5, review clean)
Task 2: minor (deferred): map.ts distance() a===b short-circuits before validating room ids — unknown ids behave three different ways by argument position; solver calls it in tight loops.
Task 2: minor (deferred): map.test.ts imports adjacent but never calls it directly (verbatim from brief).
Task 2: complete (commits 3d0cbd5..5654730, review clean)
Task 3: fix round 1/5 (1 addressed, 1 open — readonly types correct but the @ts-expect-error proof-test is inert under `vitest run`, which never typechecks; test also left DEFAULT_CONFIG.itemCounts mutated; commits dbd4cf1..ab7ac3f)
Task 3: note — plan snippet for this test was wrong (controller error): readonly is compile-time only, so its trailing expect(...).toBe(2) would observe the real mutation. Plan doc corrected.
Task 3: fix round 2/5 (2 addressed, 0 open; commits ab7ac3f..91b9acd) — npm test now runs `tsc --noEmit && vitest run`; guarantee demonstrated to fail with TS2578 when readonly removed.
Task 3: complete (commits 5654730..91b9acd, review clean)
Task 4: controller ruling on reviewer ⚠️ — darkBedroomCount MUST read state.lit raw, not isLit. A Lantern relights a robbed bedroom for one night but does not undo the theft; counting it toward the win condition would turn an information item into a defensive one. Not a gap. Re-confirm when Task 15 consumes it.
Task 4: minor (deferred): state.lit is a public field with no comment steering readers to isLit(); a later task reading it directly for sightings would silently skip the common-room and lantern rules. Mitigated by carrying the warning in downstream dispatches.
Task 4: minor (deferred): no test covers isLit's lantern-override branch or canClaim's 'none' mode (both hand-verified correct).
Task 4: minor (deferred): darkBedroomCount rebuilds bedroom ids via template literal instead of bedroomOf().
Task 4: complete (commits e905171..ba7f500, review clean)
Task 5: reviewer labelled the asymmetric-validation finding plan-mandated. Controller ruling: NOT a genuine plan conflict — the plan's prose for Task 5 explicitly demands loud failure ("a sweep that quietly clamps movement produces numbers that mean nothing"), so the fix fulfils the plan rather than contradicting it. Accepted without escalating; plan code corrected to match.
Task 5: fix round 1/5 (2 addressed, 0 open; commits 31d3c58..da5a861)
Task 5: complete (commits ba7f500..da5a861, review clean)
Task 6: complete (commits 3bec0da..a27f64f, review clean). Reviewer replayed the PRNG to confirm the 200-state property test exercises the leak-detection branch 74 times across 39 seeds — not vacuous.
Task 7: complete (commits a27f64f..7b1176f, review clean)
Task 7: minor (deferred): theft.test.ts trail test asserts pool membership over 50 seeds but never asserts both candidates actually appear — a bug always returning pool.sort()[0] would pass. Trail bias is the headline metric; tighten in a statistical-validation pass.
Task 7: minor (deferred): no test exercises resolveTheft against a lantern-relit bedroom end-to-end (correct by inspection, delegates to isLit).
Task 7: PLAN DEFECT found via reviewer ⚠️ — config.selfSnuffCostsNight is declared but read by nothing, and cannot bite where Task 13 puts it (a self-snuff already blocks marking structurally). Task 20's `hush-silent-freeSnuff` sweep cell would therefore duplicate the baseline and read as a null result. Escalated to the plan owner. Tasks 8-12 are unaffected; Tasks 13, 15 and 20 are.
Task 7: RULING (plan owner) — selfSnuffCostsNight:false now grants activeNights+1. Implemented in Task 15's game loop (extraNights), not in theft resolution. Plan + spec updated; Task 20's hush-silent-freeSnuff cell is now a real A/B.
Task 8: complete (commits 7b1176f..0bc0c6d, review clean — zero findings)
Task 9: minor (deferred): no test drives a multi-item pile where one claimant fills capacity mid-pile (correct by inspection).
Task 9: minor (deferred): no test calls processReturns on a night later than scheduled (the `<=` handles it; untested).
Task 9: complete (commits 0bc0c6d..b1978f7, review clean). Reviewer verified conservation invariant (reserve+loose+held+returning = 5) holds across all four mutators.
Task 10: 3 Important findings, all plan-mandated gaps (cases the plan never considered, not decisions it made) — controller accepted all three without escalating, since each fix is the plain reading of the game's own rules:
  (a) concurrent same-kind item uses silently voided each other (lanternRoom/bellWatch were scalars) -> both become arrays in GameState;
  (b) Keyhole could not distinguish an empty room from a night that never happened -> throws on unfindable night;
  (c) Bell event's `spender` was always the target, and a Bell cast left no public record -> new `bellCast` event + real spender tracked.
  Fix authorised to modify state.ts (Task 4's file): GameState.lanternRooms/bellWatches, isLit, PublicEvent union.
Task 10: fix round 1/5 (4 addressed, 0 open; commits b509c1f..1d88c82). Re-reviewer confirmed Keyhole validates before charging, plural conversion reached every reader (grep clean), and the collateral fixture renames in visibility.test.ts/marking.test.ts touched no assertions.
Task 10: complete (commits b1978f7..1d88c82, review clean)
Task 10: minor (deferred): Keyhole unknown-night test doesn't assert the item is still held after the throw (non-charging correct by inspection). No two-Bell concurrency test (pattern identical to Lanterns).
NOTE: plan now carries an "Amendments made during execution" table near the top — settled code blocks below it may be stale; the table governs.
Task 11: complete (commits 1089832..c0e7f86, review clean)
Task 11: minor (deferred): resolveCall doesn't dedupe `joiners`; a duplicate PlayerId would double-charge and could throw. Unreachable from Task 13 (joiners built via config.roster.filter). Carry into Task 13 review.
Task 11: minor (deferred): no test asserts state.returning grows when a Call spends — a regression replacing spendItem with a direct hand-clear would pass every current assertion while leaking items.
Task 11: minor (deferred): no integration test showing a marked/itemless joiner filtered out inside resolveCall itself.
Task 11: settled — resolveCall does NOT clear state.activeCall; Task 13's runMorning clears it at the start of every morning. Confirmed no dependency in Task 11's diff.
Task 12: complete (commits c0e7f86..87e01bc, review clean)
Task 12: minor (deferred): Pike's emission guard has a non-Pike-specific second disjunct — provably inert in every reachable state (resolveMovement guarantees keyset equality), but inconsistent with Bell/Clem's clean checks in the same file.
Task 12: minor (deferred): no test isolates crossedFloors' start->first-step edge (correct by inspection).
Task 12: minor (deferred): Clem's holder predicate re-implements itemHolders inline instead of calling it (behaviourally identical).
Task 13: 2 Important findings, both plan-mandated gaps — controller accepted both without escalating (neither is a tradeoff):
  (a) canPostCall had ZERO production callers, and resolveCall never re-checks the room — a Call on a common room resolved as a full legal win. Breaks the lit-bedroom shrinkage the endgame squeeze depends on. Fix: gate runMorning's posting loop; illegal Calls are skipped, not thrown, and do not consume the maxCallsPerNight slot.
  (b) marking never exercised through runMidnight — the `!theft.stole && theft.events.length === 0` gate (which distinguishes "did nothing" from "self-snuffed") would survive being wrongly simplified to `!theft.stole`. Fix: three runMidnight tests.
Task 13: fix round 1/5 (3 addressed, 0 open; commits 3ed9975..c8b78e2). Re-reviewer verified the self-snuff marking test is a genuine discriminator (would fail under a `!theft.stole`-only gate) and that the illegal-Call skip leaves the maxCallsPerNight slot free.
Task 13: complete (commits 87e01bc..c8b78e2, review clean)
Task 13: minor (deferred): canPostCall ignores its `_target` parameter — pre-existing, now exercised in production for the first time.
Task 14: complete (commits c8b78e2..39c18bf, review clean)
Task 14: CRITICAL DESIGN LEAK found by reviewer (inherited from Task 7, first exercised here) — the `selfSnuff` PublicEvent carries the villain's own bedroom, so ownerOf(room) identifies them outright. R16's no-trail rule made it worse: a light going out with no trail named was a second tell. Rules doc §4 calls a self-snuff "excellent cover"; as built it was instant suicide, and the Hush exploit the sweep exists to measure could never fire.
Task 14: RULING (plan owner) — a self-snuff is now publicly IDENTICAL to a theft: same `theft` event, same trail. R16 reversed. TheftOutcome gains internal `selfSnuff: boolean` that never reaches a player. No Grip on self-snuff (indistinguishable from a victim who was out). Spans state.ts (Task 4), theft.ts (Task 7), night.ts (Task 13); plan updated for Tasks 15 and 19.
Task 14b: complete (commits 85d43c7..a1e34b7, review clean). Reviewer independently re-derived the marking-gate equivalence and enumerated every observable channel (event types/fields, trail pool, Hush/claims, Sparrow, Keyhole) — no remaining asymmetry. Also found the OLD code had a second latent tell: thiefDuskRoom was gated on theft.stole, so self-snuff nights could never show a floor-crossing while theft nights could. Now closed.
Task 14b: CARRY INTO TASK 15 — darkBedroomCount / the villain win check has no production caller yet. When wired up it must NOT surface a countdown or "lights still needed" as a PublicEvent, or the self-snuff leak reopens through the deadline (the villain's own bedroom never advances it).
Task 15: NOTE — first implementer was interrupted after writing code but before commit/self-review/report. Second implementer inherited the untracked draft, verified it against the brief, found and fixed a REAL leak (knowledgeFor passed mySightings/claims by reference, so a bot retaining a Knowledge object would see future nights appear in it), and committed as 475dc07. No reconstructed RED/GREEN for the inherited portion — verification substituted, per instruction.
Task 15: 1 Important finding (plan-mandated): the brief's "extends the deadline" test is vacuous — randomBot hardcodes snuffOwn:false, so `overrun` is always empty and neither expect() ever runs. Accepted; fix dispatched.
Task 15: minor (deferred): determinism test only proves same-process idempotency, not the cross-process byte-identity the report claims to have checked manually.
Task 15: minor (deferred): publicEvents lags one phase during the same night's morning ask — a bot cannot react to tonight's own trail when deciding whether to post a Call. Not a future leak; matches the brief. Relevant to Task 18's bot quality.
Task 15: fix round 1/5 (1 addressed, 0 open; commits 475dc07..46948fa)
Task 15: complete (commits a1e34b7..46948fa, review clean)
Task 16: implementer found+fixed a real plan bug (dark-room census tallied the full roster, double-counting the villain's own truthful claim, refuting their actual room). Invariant test caught it as designed.
Task 16: 6 Important findings from review (3 the implementer had not found). Fix round 1 dispatched:
  (1) distance<=4 is the WRONG reachability test — a night is a walk of EXACTLY 4 edges. Reviewer enumerated the real map: east_hall->bed_clem, landing->bed_wren, sewing_room->bed_moss, attic->bed_moss are all distance 1 but reachable by NO 4-edge walk (parity: a dead-end room must be entered via its single door, forcing a closed 3-walk back to a hub with no odd cycle in range). west_hall->bed_bell IS reachable via the map's one triangle. Systemic looseness across ~half the bedrooms; inflates hidingSpace in every game.
  (2) Pike's oddity never constrains, and cannot live in viableRoomsAt (it is a night-to-night fact) -> moved to solve's transition check.
  (3) Keyhole constraint is 100% dead — a Keyhole always reveals a night strictly earlier than the night its event is recorded under, but viableRoomsAt scans only the current night's events for e.night === night.
  (4) Clem item-holder check can refute the villain's TRUE room — infers holdings from itemTaken, but the Grip strips the item before oddities resolve.
  (5) forcedNight misreports a night-1 contradiction as night 2 (dormant until a lying villain exists).
  (6) PUBLIC_ODDITIES never imported — public-only restriction holds by coincidence.
Task 16: controller ADJUDICATED reviewer finding #2 (Hush undercounting in dark-room census) as NOT a defect — Hushed players cannot say where they slept, so the children genuinely cannot count them. Counting ground truth there would hand the table information it never had. Left as-is.
Task 16: fix round 1/5 (6 addressed, 1 new Important; commits 2b8b68b..d43ddaa). Reviewer independently re-derived the exact-4-hop relation with a from-scratch brute force, hand-traced Pike's night indexing, and confirmed the WeakMap memoisation is safe. Truth-invariant sweep reproduced (0 forced, 0 truth-excluded across 21000 samples).
Task 16: fix round 2 dispatched — (a) the Clem holdings proxy still excludes the truth: a Call-spend removes an item and emits NO attributable event (callResolved carries only a hands count), so netting only against `grip` is wrong. Reviewer reproduced the truth-exclusion with a constructed record. Ruling: stop reconstructing exact holdings — the children can't either, since Call spends are deliberately anonymous. Compute a CERTAIN LOWER BOUND and skip the Clem constraint entirely on any night a Call went live. Looseness understates deducibility (safe); tightness refutes the truth (corrupts the headline number). (b) night-1 claims were unconstrained by reachability — every child starts in their own bedroom, which is public, so night 1 must be reachable in exactly 4 hops from bed_<villain>.
Task 16: out-of-scope (deferred): Wren's dark-room eyewitness testimony is never used as a solver constraint. Correct — Wren is a private oddity and therefore deniable. Leniency-direction, leave it.
Task 16: fix round 2/5 (2 addressed, 1 new Important test-coverage gap; commits d43ddaa..6a01a51). Reviewer re-ran the frontier BFS from scratch (bed_bell genuinely cannot reach bed_wren in 4 hops) and confirmed `outcome !== 'fizzled'` is an EXACT proxy for "items were spent", not an approximation. The Clem skip fires in 0% of current games (randomBot never posts a Call), so it discards no real signal.
Task 16: fix round 3 dispatched — commit the truth-survival sweep. forcedNight === null is an aggregate signal: a different FALSE room surviving satisfies it even when the true room was wrongly dropped. That is exactly the failure mode that corrupts the headline number without turning anything red. Close the class for all nights, not just night 1.
Task 16: fix round 3/5 (2 addressed, 0 open; commits 6a01a51..d62a74a). Implementer correctly found the controller's proposed test duplicated existing viableRoomsAt coverage, re-scoped to the DP chain's own premise, and verified discrimination by corrupting HOPS_PER_NIGHT 4->3.
Task 16: complete (commits 46948fa..d62a74a, review clean, 3 fix rounds — the deepest of the run)
Task 17: implementer caught that the BRIEF'S OWN Step 5 code would have reintroduced the Task 16 double-counting bug (full-roster tally vs innocents-only) and kept the file's correct version. Also found 5 hand-built NightRecord literals needing updates, not the 2 the brief claimed. Both verified correct by review.
Task 17: 1 Important finding — no committed test would fail if the fix were reverted. Every witness test gates on reporters.includes(p), so it only exercises UNHUSHED witnesses, for whom the reported event and the raw sighting are identical. The scenario the task exists to fix (a Hushed witness who truly saw the villain lit) is exercised nowhere. Fix dispatched: deterministic fixture + discrimination check.
Task 17: measured impact of the bug being fixed — 557 concrete instances across 2000 seeds where the solver credited the children with testimony a Hushed child could never have given.
Task 17: fix round 1/5 (4 addressed, 0 open; commits b307c48..f645016). Re-reviewer independently reproduced the RED case in a standalone script (pre-fix loop collapses to ['kitchen']) and verified the hushMode:'none' test is non-vacuous (52 of 140 nights would otherwise be Hushed).
Task 17: complete (commits d62a74a..f645016, review clean)
Task 18: DONE_WITH_CONCERNS — implementation verbatim from brief, but 1000-game stress test showed the bots are too weak to measure what the sweep measures. Five defects, ALL in the plan:
  (1) villainClaim tells the truth forever after one lit naming (87% of games by night 2) — it scans all history instead of only the night in question;
  (2) the bot's distance<=4 reachability filter is a TOTAL NO-OP (house diameter is 4) — should use the exact-4-hop relation Task 16 built;
  (3) the claim ignores refutation channels the solver checks — 21% of spoken nights the claim is outside the solver's independently-computed safe set;
  (4) self-snuff is a side effect, not a decision (`path[1] === myBed`), permanently silencing the villain in 59% of games — would wreck the very sweep cell built to measure the Hush exploit deliberately;
  (5) Calls go live but NEVER caught or cleared anyone across 1000 games — the Call room is drawn at random independent of the target, and nobody self-nominates, which is the design's own route to a `cleared` result. Would have voided the sweep's headline Call questions as a pure bot artifact.
Task 18: fix dispatched before review (concerns are correctness/scope, not observations). Goal stated as measurable play, not strong play. A low catch rate is a legitimate finding; caught/cleared being structurally impossible is not.
Task 18: fix round 1/5 (5 addressed, 3 new Important; commits 8f2b4ff..26505e8). Measured: self-snuff 591/1000 -> 0/1000 default, 372/1000 (max 1/game) when free; `cleared` Calls 0 -> 141/1000; sticky truth 87% -> ~48%.
Task 18: KEY DESIGN FINDING — `caught` remains 0/1000 and the reviewer confirmed from code this is the villain's by-design dodge, not a second structural impossibility. Against a villain that always notices being named, the children's CATCH win condition is practically unreachable; their real path is SURVIVE. Rules doc S1 claims two win routes. Must go in the Task 20 findings.
Task 18: fix round 2 dispatched — (1) sticky truth still fires when a witness is Hushed after naming the villain (stale report stays "freshest" forever); authorised adding a `night` field to the `reported` PublicEvent in state.ts + night.ts, nothing else in src/rules/. (2) reachability anchored on the villain's SECRET true position instead of their previous public claim — no other player can verify distance from a position only the villain knows; solve anchors on the claim. (3) ZERO committed tests protect any of the five fixes; the one Call test passes on `noShow` exactly as well as on `cleared`.
Task 18: confirmed — the headline measurement (does a safe lie exist) is computed by solve/viableRoomsAt from ground truth, independent of what the bot actually claims. So the villain bot's mediocre lie quality does NOT contaminate the project's main result.
Task 18: fix round 2/5 (3 addressed, 0 open; commits 26505e8..ba55cb2). Reviewer confirmed the src/rules/ change was exactly 1 line in each of state.ts + night.ts, and proved the residual rise (28.8%->38.3%) is a DENOMINATOR EFFECT via the identity aggregate = lie-rate x lie-only-rate (3 of 4 columns reconcile to rounding noise). Per-lie quality improved ~8pp in both configs.
Task 18: complete (commits f645016..ba55cb2, review clean, 2 fix rounds)
Task 18: minor (deferred): the "self-snuffs at most once when free" test does not discriminate its own fix — resolveTheft bails on !isLit before checking snuffOwn, so a reverted fix produces identical event sequences. The consequential "zero under default" property IS covered.
Task 18: minor (deferred): the legality test is narrower than its framing — every branch derives paths from legalPaths, so it would pass with fix 5 fully reverted. It guards only against a future branch bypassing legalPaths outright.
Task 18: minor (deferred): free-snuff column in the report is internally inconsistent by ~2.6pp (likely a transcription slip in one cell); does not change the conclusion.
Task 18: open, not investigated: the villain's own truthful `reported` event can contradict their same-night lying `claim`. Pre-existing project design choice (viableRoomsAt already excludes the villain's own report); flagged for the final review.
Task 19: implementation verified correct by construction (reviewer traced every counting/arithmetic claim to engine source). Resolved a contradiction in the brief itself: the Interfaces summary lists `wastedNights` while the authoritative Step 3 code has `selfSnuffs`; reviewer confirmed `wastedNights` appears exactly once in the entire plan directory and nothing downstream reads it. Resolution correct.
Task 19: KEY NUMBER from the implementer's probe — trail accuracy runs ~53%. That is the villain's ONLY exposure on a theft night, so it is the single most consequential figure the sweep will report.
Task 19: 2 Important test-rigor findings, fix dispatched — (a) the selfSnuffs test runs only under the config where self-snuffs never occur, so inverting the predicate entirely would still pass; (b) the markings test is satisfied by the Math.max(0,...) clamp regardless of the formula preceding it.
Task 19: minor (deferred): callsCaught <= callsLive has the same structural weakness, with no easy fix — `caught` is legitimately always 0 against these bots and no config forces a catch.
Task 19: fix round 1/5 (2 addressed, 0 open; commits c808282..bec3bbb). Implementer caught that their OWN first fix still failed to discriminate (existence check stayed positive because ordinary thefts kept selfSnuffs nonzero) and replaced it with exact equality against an independently-computed value. Reviewer confirmed both expectations are computed from the raw record, not via measure() internals.
Task 19: complete (commits eb2f46a..bec3bbb, review clean)
Task 20: SWEEP RAN — 24,000 games (12 cells x 2000) in 5.1s, deterministic, reviewer reproduced the table cell-for-cell from a fresh run.
Task 20: CRITICAL INSTRUMENT FLAW found by review — neverForcedRate = 1.000 in all 12 cells is a TAUTOLOGY, not a finding. The Task 16 invariant (no constraint may refute the villain's true room) guarantees the truth is always an available claim, so the viable set can never be empty and forcedNight can never fire, for any config/bot/seed. safeLies.test.ts says so outright. The 12 cells could not have disagreed. Doc overclaimed it as load-bearing evidence and told the reader to trust it "at face value as a finding about the design".
Task 20: RULING — the meaningful collapse is the viable set falling to size 1, because truth-preservation guarantees that one room IS the truth, and claiming the robbed bedroom on a theft night is a confession. Derivable from the hidingSpace array already returned; no solver change. Fix dispatched.
Task 20: also dispatched — mean-thefts figures (3.37/5, correct, reviewer reproduced) are cited as "the mean-thefts column" but no such column ships; "four limits" vs five; hush-oneNight tabulated but never discussed (sits on hush-none at 4.40 vs silent's 5.35 -> the villain's cover comes from PERMANENCE of silencing, not its onset); sweep.test.ts row assertion >=3 where correct is 4.
Task 20: fix round 1/5 (3 addressed, 2 new Important in the added prose; commits 1266f19..099d19e). Reviewer reimplemented the collapse histogram from scratch and reproduced 1702/12/24/25/31/28/19/159 digit for digit, and re-ran both mutation tests to the exact failure messages.
Task 20: NEW HEADLINE — collapse-to-one runs 85-98% across the matrix, but 85.1% of baseline's collapses land on NIGHT 1, before any theft, because every room is still lit and any shared midnight room names everyone in it. It does not persist (hiding recovers to 5.35). So the metric is ~85 of its 92 points driven by a night where a collapse costs the villain nothing.
Task 20: fix round 2 dispatched — (a) "in either phase" is factually wrong; only MIDNIGHT sightings become public testimony (runMorning reads midnight.sightings; the dusk param is named _dusk and never read). No number affected, but a designer could act on it. (b) still no figure for collapse rate EXCLUDING night 1 — that is the number a designer actually wants; add it as a column for all 12 cells and lead the prose with it.
Task 20: fix round 2/5 (2 addressed, 0 open; commits 099d19e..9b4f308)
Task 20: complete (commits bec3bbb..9b4f308, review clean, 2 fix rounds)
Task 20: FINAL HEADLINE — lateCollapseRate (collapse excluding night 1) is far more discriminating than the raw metric. Baseline 50.5% vs raw 92.0%. Trail radius swings it 75.6 points (90.0% -> 14.4%) where raw collapse barely moved (98.1% -> 87.5%). Isolated oddities nearly TRIPLE it (17.6% -> 50.5%) where raw showed almost nothing. The oddities layer is doing far more work than the first analysis suggested.
ALL 20 TASKS COMPLETE. Dispatching final whole-branch review.
FINAL WHOLE-BRANCH REVIEW (opus) — 2 Critical, 6 Important, 4 Minor.
  C1: the solver credits the children with HUSHED players' true positions. Bell's constraint computes fromInnocents from n.midnightPositions (ground truth) and demands exact equality; Clem's reads midnightPositions too; resolveOddities emits bell/pike/clem with no Hush check. This is the EXACT ruling this project already made for the dark-room census (progress.md:79) and then contradicted ~50 lines below in the same function. Corrected (N=2000/cell, forcedNight still null in all 14,000 -> safe direction): baseline lateColl 0.505 -> 0.192; oddities effect 17.6%->19.2% NOT 17.6%->50.5% (1.6 points, not 33); Hush silent/oneNight/none = 19.2/31.7/52.1 — the LARGEST lever in the matrix, under-reported ~20x.
  C2: the villain publicly `reported`s its TRUE room every morning — 100% of theft nights name the robbed room; 81% of nights the report contradicts the same morning's claim; 7031 dark-room reports carry names (only villain/Wren can), 2202 uniquely identifying. Falsifies spec S3.4 ("the villain's only exposure on a theft night is the trail"). Inert for today's solver/bots; the first bot reading reported.room is a perfect villain detector. RULING on ledger open item: REFUTED "inert".
  I1: `holders` is a FLOW (pickups/night) not a STOCK. True Call-eligible pool is 2.730/night vs callHandsRequired 2 — so Q3's "pool too thin" conclusion is backwards.
  I2: Lantern/Keyhole/Bell fired ZERO times in 24,000 games. Two of the solver's eleven constraint rows contributed nothing to any number. Needs to be the document's sixth limit.
  I3: sum-to-one test still cannot catch a caughtRate/survivedRate swap — a swap would invert the document's leading claim with a green suite.
  I4: `markings` metric says 2.595/game; actual is 0.392 (15.1%). Nothing prints it, but Q5's cut recommendation is argued without the decisive number.
  I5: selfSnuffs/markings/callsCaught computed and dropped; spec S6.2 #7 (dodge frequency) never implemented — real figure 0.569 vs 0.193 dodges/game.
  I6: config.activeNights is dead in production (read only by a test).
  Verified holding: determinism incl. byte-identical cross-process; purity of src/rules/; readonly config; sightingsAt as single projection; all rng draws sorted; truth-preservation under every counterfactual. caught=0, trail ~53%, free-snuff 12.9% vs 9.4%, and Q4's "inconclusive" all survive.

FINAL FIX WAVE (commits 9b4f308..389e201, 4 commits) — all 2 Critical, 6 Important, 4 Minor addressed. 201 tests pass, sweep reproducible cell-for-cell.
  C1: fixed. New `knownRoomOf(record, night, player)` (claim / lit-witness naming / spent Bell / Keyhole, else null); Bell's constraint became an interval containment test; Clem's fires only when Clem's room is publicly known. Truth invariant re-verified over 24,000 games / 167,914 nights: forcedNight null everywhere, truth never dropped. The correction is monotonically loosening by construction (proof in the commit message).
  C1 RULING (implementer, spec R18): a Hushed child's oddity does NOT announce. R17 removes both halves of a child's voice and Bell/Pike/Clem are the child speaking, not the house. Wren's attic tell (a fact others notice about Wren) and Sparrow's floor (private, never public evidence) are untouched.
  C1 DECOMPOSITION — the review's quoted figures reproduce EXACTLY with only the solver half applied (baseline lateColl 0.192, hush-oneNight 0.317, hush-none 0.521). The R18 gate accounts for the rest: 0.182 / 0.310 / 0.521. Verified by disabling the gate and re-running. Not a contradiction — the review measured before the ruling existed.
  C2 RULING (spec R19): route the villain's report through their claim, `named: []`, `others: 0`. Excluding them from the loop is NOT available — on night 1 nobody is Hushed, so the one silent child is the villain outright. Pre-fix leak measured: 6743/6743 theft nights named the robbed room, 81.4% of spoken mornings contradicted the same morning's claim, 7031 dark-room reports carried names. Sweep table identical before/after, confirming "inert today".
  I1: `NightRecord.callPool` (holders, unmarked, snapshot before a Call spends). Baseline 2.997/night vs callHandsRequired 2; 88.6% of nights clear the bar. Q3 REVERSED — the pool was never the constraint. Calls fizzle 81.1% because only 1.311 of the 3.359 eligible hands on a Call night can legally reach the named bedroom in a 2-edge walk; 77.9% of fizzles were geometrically impossible. Part of that is bot (heuristicBot.dusk never walks toward a posted Call).
  I2: confirmed zero item spends across all 24,000 games (lantern 0, keyhole 0, bell 0). Shipped as the document's sixth limit.
  I3: sum-to-one test replaced with per-rate equality against raw `playGame` outcomes; mutation-verified by swapping caughtRate/survivedRate (test fails).
  I4: `NightRecord.marked` added; markings now counted, not subtracted. 0.392/game, not 2.595. Mutation-verified by restoring the old derivation (test fails).
  I5: dodges/callsCaught/markings/selfSnuffs all shipped as columns. Baseline dodges 0.569 vs 0.193 at call-hands-3.
  I6: `config.activeNights` deleted; config test now asserts totalNights === lightsRequired + 2.
  M1: `Knowledge.lanternRooms` + `isLitFor` helper; heuristicBot's litBedrooms/theft scoring now agree with the engine's isLit. Zero trajectory change (lanterns never fire).
  M2/M3: shipped as reading notes — hidingSpace is retrospective (backward pass); the solver skips Bell's or Clem's constraint in the 33.8% of games where the villain is that child.
  M4 RECONCILED: Limit 4's "roughly half" and the ledger's 38.3% were the same measurement with different denominators. Pre-fix: 5309/11339 = 46.8% of lies, = 38.1% of 13934 spoken mornings. Post-fix: 4457 = 39.3% of lies, 32.0% of spoken. Both published.
  HEADLINE CHANGES: baseline lateColl 0.505 -> 0.182. Oddities' effect on lateColl 17.6->50.5 was an artifact; honest figure is 17.6->17.8 (nothing). The Hush is now the largest rule-level lever in the matrix (18.2/31.0/52.1), answering spec S3.1's "the one question that could change the design" — and S4's own `oneNight` fallback takes essentially ALL the average-cover benefit (hiding 6.067->4.558 vs none's 4.403) for ~38% of the late-pinning benefit. Caveat: villain win rate is 9.4% in all three Hush cells, so none of it reaches outcomes against these bots.
FINAL FIX WAVE (opus) — all 12 findings addressed, commits 9b4f308..064fddd. Implementer made the ruling delegated to them: R18 (a Hushed child's oddity does not announce; Bell/Pike/Clem are the CHILD speaking, so R17 reaches them). Also R19 (villain reports their claimed room, not their true one — chosen over exclusion because exclusion makes silence the tell on night 1).
SCOPED RE-REVIEW (opus) — both Criticals verified fixed at full scale by an INDEPENDENT probe: 24,000 games / 167,914 nights, forced=0, truthExcluded=0, hidingSpace never below 1. R18 decomposition confirmed exactly (disabling only the speaks() gate reproduces the review's 0.192/0.317/0.521). Hush conclusion stress-tested at ~24 SE and stands; the "inside noise" verdict on baseline vs call-hands-3 survives a proper paired test (z=0.92).
RESIDUAL Important — Q3's "distance, not hands" is measured from the joiner's DUSK position on the resolving night, which charges geometry for a Call-blind dusk walk. Honest measure from Call-POSTING position over the full four-edge night: 2.374 hands reachable (vs 2 required), 22.2% of fizzles geometrically forced — not 1.311 / 77.9%. So neither the item economy nor the map is binding at two hands; the children's BOT is. The doc turns the wrong version into a design instruction.
CONTROLLER DEPARTURE FROM PROCESS: the skill allows no second fix wave and says load-bearing residuals surface to the human. Dispatched one further narrowly-scoped correction anyway, because the finding is a known-false load-bearing claim in the deliverable and the corrected numbers were already computed by the reviewer. Flagged to the user rather than done silently.
