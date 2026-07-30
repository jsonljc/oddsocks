# ODD SOCKS v12.0 — adversarial design review

**Run 2026-07-29 → 2026-07-30.** 14-lane parallel review of `docs/rules-v12.0.md` against
`docs/superpowers/specs/2026-07-29-odd-socks-v12-prototype-design.md`. Per-lane files and all
scripts: session scratchpad `v12-review/`. **No file in this repo was modified by the review** —
`rules-v12.0.md` forbids editing and every lane was instructed accordingly.

**Method.** The fleet was split to defeat this project's recorded failure mode (arguing a question a
computation could answer). Six `[COMPUTE]` lanes had to write and run a real script and paste its
output; eight `[ANALYTIC]` lanes were **forbidden from stating any invented quantity** and had to
route numeric questions to a compute lane. Every finding required a concrete failure scenario, a
blocks-which-slice field, and a falsifier.

**Honest limits of this run.** A session limit killed 8 of 14 lanes mid-write. **11 of 14 wrote
complete findings files first.** Lanes 4, 5 and 6 left runnable scripts but no write-up; I re-ran all
three myself and their results are included and attributed, but they lack their authors'
verdict-and-delta layer. **Lane 12 (genre prior art) hit a fetch rate limit and self-flagged
unverified claims — treat it as the weakest lane and do not cite its numbers.**

---

## 1. Sock persistence — a wording pin, NOT the fork it first appeared to be

Recorded because I initially framed this as the item everything else was conditional on, and that
was wrong. Lane 3 correctly found that **v12.0 never states unsecured socks persist overnight**, and
I inferred a game-deciding dichotomy from it. Checking the text kills the dichotomy.

**No clause anywhere in §11–§14 deletes an unsecured sock**, and five separate clauses imply
persistence:

- **§11.4: "The Odd Sock may not carry a sock into the Shared Bedroom, and must drop it before
  dawn."** Decisive. If socks despawned at dawn this rule would be pointless — dropping it would
  achieve nothing and the villain would not need to. The clause only has force if the dropped sock
  survives into the next night.
- **§11.2 records "night it appeared"** — a night-stamp is meaningful only if a sock can be found on
  a *later* night.
- §11.4: "You drop it if Taken, and **anyone may pick it up**."
- §12.3: Displace "picks up an **unsecured** sock" — unsecured socks are findable objects.
- §14.1: ghosts see "socks **on the floor**" — an ongoing observed state.

§11.3's "A sock on the floor is worth nothing" is a **value** claim, explicitly contrasted with
"Once secured it is permanent and public." The contrast is secured-vs-unsecured *worth*, not
existence.

⇒ **Persistence is implied by five clauses and stated by none. Pin the wording (MINOR).** Lane 1's
enumeration therefore stands **unconditionally**, and the lead finding of this review is **B1**.

---

## 2. Verified strengths — read these before the defects

The review confirmed real structural soundness. This matters as much as the defect list.

- **The villain cannot starve the children of evidence.** Lane 1, exhaustive DFS over all legal
  villain lines: **minimum total sock supply = 2 across all 8 rule-reading configurations,
  `lines_under_2 = 0` everywhere**, and 2 is exactly the Call price. A Call is payable on all 1,312
  survive-to-dawn lines. Acting produces a sock directly; not acting produces one via Shed. **This is
  an elegant, verified invariant and §7's stated engine holds.**
- **The Bind's survivor case is sound.** Lane 5: floor of 2 living children at Last Night entry
  against a maximum requirement of 2 (1 with two lanterns). No entry state fails for lack of
  survivors. §16.3's unaddressed analogous case is *not* a defect.
- **§5's timing arithmetic is correct** (1080s = 18.0 min), as the build spec already established.
- **§6.2's readability checklist survives the corridor topology**, and §27's variety promise holds at
  1,825 distinct floor plans (Lane 3 — refuting my own prior, see §6).
- **The 90-second night is not the binding constraint** — traversal and securing envelopes both have
  slack for any per-room step ≤ 5.0s (Lane 3).
- **§8.8's moving vote denominator is not exploitable by villain timing** — Takes make correct Calls
  *easier* (4-of-5 → 3-of-4 → 2-of-3), and ghost votes are never perverse (Lane 9).
- **The six mornings are the villain's best-designed phase** — procedurally identical to a child's,
  no villain-only bookkeeping, no tell surface (Lane 7).
- **§15.4's refusal to clear the accused is consistent and intended** (Lane 7).

---

## 3. BLOCKERs

### B1 — Two Snuffs delete the children's only win condition
**Confirmed independently by three lanes** (Lane 2 F2.1, Lane 11 F11.2, and Lane 5's script). I
verified the chain clause-by-clause myself.

§16.3 requires at least one exit sealed by a **placed lit lantern**. Exactly two lanterns exist
(§10). A Snuff disables one (§10.4). The *only* relight is a Matchbox, consumed on use (§10.5). §17
lists four objects and draws two, so **3 of 6 draws contain no Matchbox**. §16.3's rule 2 protects
lanterns only "during the Last Night"; §16.1 restores nothing.

⇒ A villain who Snuffs on Nights Two and Three permanently removes the Bind. Lane 2: **6 reachable
Last-Night entry states have zero working lanterns; 0 of 469 double-Snuff lines reach a Last Night
with a living lantern.** Lane 5 confirms a 0-lantern entry admits **no legal Bind configuration**.

§16.3 states the exact guarantee it fails to deliver: *"It must never be impossible because of which
lantern died on Night Three."* This is a self-contradiction, not a gap.

**Severity is conditional on §17's draw, and the two fixes differ.** With a Matchbox in the draw the
villain nets only one dead lantern (two Snuffs, one relight) and **one lantern is sufficient for a
Bind** (Lane 5's table). So B1 is a **BLOCKER on the 3 of 6 draws without a Matchbox and a MAJOR on
the other 3** — which one depends on Lane 11 F11.13's §17 "two of four" pin. Two different one-line
fixes follow: guarantee the Matchbox is always in the draw (cheap, but leaves relighting on a timer
of finding it), or make §16.3's guarantee self-delivering by having lanterns survive into the Last
Night regardless (fixes the invariant at its source). Prefer the second; §16.3 is where the promise
is made.

**The kicker:** those two Snuffs produce exactly the two socks a Call costs. **The villain funds the
correct Call and destroys the weapon with the same two actions.**

**Both horns are bad.** The only defence is never placing a lantern (legal — §10.1 permits carrying).
That deletes §10.2's Take-prevention, §10.2's faster searches, and **§10.3's dawn doorway records —
the game's primary public information channel** — and falsifies §30's "Dominant lantern-placement
pattern: none." Lane 5: *"it installs an unteachable defensive meta that deletes the surveillance
system §19's whole anti-turtling argument is built on."*

### B2 — Displace is dead
**Confirmed by Lane 11 F11.1 (BLOCKER) and Lane 7 F7.1 (MAJOR), converging from different angles.**

§2 cut the Plant because it "needed five supporting systems and fired once per match." Displace
inherits the profile. Lane 7's mechanism is the sharpest: §11.4 makes a sock-carrier unable to hold a
lantern, **louder**, and directionally visible to the villain, walking to a known destination — so
**an unsecured sock on the floor is the best ambush the villain will ever get, and Displace removes
it.** Lane 11 adds that §15.2's person-only Call means a sock's recorded room has no mechanical
bearing on anything; it is pure currency. Lane 4 quantifies the payload: a Displace recovers 1 bit
and leaves 2.32 missing, but **§12.3's misdirection converts to 0 bits of *who*** publicly.

Lane 7's honest limit: **not strictly dominated** — a narrow four-condition state exists where it
wins. Hence MAJOR there, BLOCKER in Lane 11.

### B3 — §15 never defines how a Call is made
Lane 11 F11.3, net-new, on nobody's prior. §15 specifies the Call's price and two of three outcomes
but **no trigger, no nomination procedure, and no no-majority result.** Lane 7 independently found
the same hole from the villain's side: with no nomination step, **the villain's minimum defensive
window is structurally zero.** Lane 11 F11.11: §5's flow requires a Call phase and §5's timing table
has **no row for it**, against a total with no slack.

### B4 — §13.1's report cannot be computed as specified
Lane 9 F9.1 (blocks **slice 1**, which is next). §13.1's nine categories include "Inactivity traces",
which §12.4 defines as *which floor the Odd Sock ended on*. Computing that needs **role identity**.
Build spec §3.3 hands `houseReport` a projection with identities stripped "except for the one field
§13.1 grants it, which children did not return." **The specified architecture cannot render one of
its own nine categories**, and the needed exception is about the villain, not the victims. Two of the
nine categories also falsify §13.1's own voice rule. Lane 7 F7.4 flags the same field as the only
slice-1 blocker in its file.

---

## 4. The strategic picture: the game may be deterministically solvable

Three lanes converge on a single unintended equilibrium.

**Grouping is free, and §19 is aimed at the wrong section.** Lane 8: all seven §19 bullets target the
sock economy, but what makes grouping safe is one unpriced sub-clause of §12.1 — *"no second living
child is close enough to intervene."* **A crowd in a pitch-dark room with no lantern at all is
already Take-proof by that clause alone.** Lane 8's §19 audit: 1 bullet works, 1 works as a deadline
only, 1 partially works, 1 is defeated, 1 is self-defeating, 1 is **inverted** (§12.4's Shed becomes
the turtles' supply line — it delivers socks to the room the group is standing in).

**Darkness does not prevent the grouping protocol.** Lane 6's script refutes the obvious counter
(and my own prior): §9 hides identity for *re-identification*, not under *continuity* — §9's own
action list includes "follow another child" and "footsteps remain perceptible." The roster is agreed
each morning, awake, in the lit Shared Bedroom, and committable to the claim board. **Darkness hides
who is standing next to you; it does not hide who was supposed to be.** The villain has an upper
bound of **2 continuity breaks per match** (Slip + White Rabbit), and both announce themselves.

**And the Shed convicts through channels the villain cannot touch.** Lane 6: the Shed room reaches
the children by three independent channels — the in-night audible disturbance (§12.4), the morning
"Rooms disturbed" line (§13.1), and the sock itself (§11.2). **Displace moves only channel 3.**
Whispers can't muddy 1 or 2 because a protocol that prevents every Take produces no ghosts. So a
quiet night's "rooms disturbed" line names exactly one room, and that room is the villain's.

**Lane 8's extension of build-spec §8.0 is the sharpest strategic result in the review.** §8.0
concluded §12.4's two timing readings "both fail" — but it only considered a villain *free to pick
their room*. A villain camped inside a group cannot pick. Under resolve-before-return, §12.4's
one-quiet-night floor report plus the Shed become a **free binary search**: split six bodies across
two lanterns, one per floor, and the house narrows the villain every night while nobody moves. So the
unpinned timing is not "both bad" — **it is the switch between a match that resolves to one blind
Call and one the children solve deterministically by standing still.** §12.4 can only price
*isolation*; crowd-hiding is invisible to it by construction.

**Two more that make grouping worse:** securing a sock is an act only an innocent can perform (§11.3
+ §11.4), so rotating securing duty **reintroduces the clearing mechanic §15.4 exists to forbid** and
bypasses deduction entirely (Lane 8). And escorting is free — the rules charge nothing for standing
next to someone, and a child's "special action" is never defined anywhere, making v12 change #4
one-sided (Lane 8).

---

## 5. Information: the channels carry almost nothing about *who*

Lane 4's script (recovered and re-run; no author write-up).

- **8 of 10 house-report categories carry zero identity bits by construction.** Only two are
  person-indexed: "did not return" and the failed-Call result.
- **§18's Midnight transmits exactly 0.000000 bits about the villain's identity at equilibrium**,
  at every attend rate from 0.00 to 1.00 — the villain simply matches the children's rate. The
  largest scheduled public reveal in the game is informationally empty against a thinking opponent.
- Under the corroboration-requiring reading, **public entropy never drops below 2.0 bits** against a
  2.585-bit target — the children cannot publicly identify the villain at all, and the corroboration
  requirement is *unmeetable for Takes*.
- **The public-vs-group gap is 0.8408 bits.** That is precisely the load the claim board must carry.
  Against it: one marker per living player per morning, four link types, **no negation and no rebuttal
  type anywhere in either channel** (Lane 7 F7.5, Lane 9 F9.7).

**Consequence.** §30's "Calls rest on evidence rather than vibes" and "the reveal regularly
surprises" are in tension from opposite directions at once: the *public* channels underdetermine the
villain, while the *grouping protocol* of §4 overdetermines them.

---

## 6. Where the fleet corrected me, and where I corrected the fleet

Both directions fired, which is the point of keeping a written prior.

**Fleet → me.** My pre-registered calibration set had 15 items. Corrections:
- I claimed the corridor topology "collides with §6.2's readability goals." **Wrong** — Lane 3 showed
  §6.2's literal checklist is satisfiable by a corridor. Its reframing is better: **§6.1 is written as
  a local rule about rooms while actually being a global rule about the building.**
- I claimed §15.1's "one or two Calls" is **false** on the hiding branch. **Refuted** — Lane 1: Calls
  affordable ∈ {1,2} on every line. It is true as a count and misleading as a promise (84.9% of lines
  give exactly one).
- I guessed the failed-Call cliff leaves "nights still on the clock." **Refuted for the hiding
  branch** — the single Call falls in *morning six*, so there are **zero** nights left; the harm is
  zero margin, not dead play. The dead-play harm lives on *higher*-supply lines (worst case 3 dead
  nights on `AAQQQ`/`AAQAQ`/`AAAQQ`).
- I guessed BLOCKER for the sock economy. **MAJOR** — the win path is available on every line.
- Net-new, not on my list: Lane 1's finding that **`QAQAQ` dominates `QQQQQ`** — a villain who Takes
  on nights 3 and 5 leaks *no more evidence* than one who hides completely, while burning 2 flames and
  taking 2 children, both of which are progress toward §7's instant wins rather than costs.
- Also net-new: the secret passage fits **exactly one legal house** (zero legal passages on a ring;
  exactly one on a corridor, joining the dead ends) — Lane 3. And "may run" is **kinematically empty**:
  villain and victim run at identical speed on nights 1–6, so fleeing holds distance and never breaks
  contact, with no head start specified anywhere. **240 of 648 attack geometries (37.0%) have no
  reachable lantern on the escapable side.** Two of §12.1's four listed escapes are decorative.

**Me → fleet.** Lane 10's F10.1 argued §14.1's prohibitions are unimplementable because a lit room
forces the engine to suppress exactly one nametag, and the suppression *is* the identity. **That does
not hold** — the Odd Sock *is* one of the six children (§4.2), so "seeing the Odd Sock's identity"
means learning which child holds the role, not resolving a nametag; five resolved names reveal
nothing. **But the conclusion survives by a worse route the lane missed.** §12.1 requires darkness, so
the victim genuinely cannot see their killer at that instant. However the ghost is created **in
place, beside the killer**, and §14 lets ghosts move freely, invisibly, at no cost, with no limit — so
the ghost follows that person until they enter lantern light. §9's load-bearing claim (*"the one fact
that would end the match cannot be transmitted, because nobody has it"*) fails, because after one
follow somebody does. The leak channel is §14.3's single ghost vote: ghosts are barred from the claim
board ("living player") and from Calls, but they vote — **so a ghost votes with certainty while every
living player guesses.** The lane's proposed fix (ghosts perceive occupancy *counts*, never figures)
closes the tracking route too, so its delta stands on corrected reasoning.

**Coverage verdict.** The fleet hit 13 of my 15 calibration items, corrected 4 of them, and produced
substantial net-new material in areas my prior never reached (§14 entirely, §15's missing nomination
procedure, the Midnight zero-bits result, the report-computability blocker). **Coverage was strong.**

---

## 7. Recommended v12.1 delta order

Every item below is single-rule, per §30's cheapest kill filter. **Sequencing matters — several
interact.**

1. **Fix B1** — the cheapest form is to make lanterns un-Snuffable *or* self-relighting into the Last
   Night, so §16.3's guarantee is delivered by a rule rather than asserted. Lane 2 warns its own §7
   "four flames" delta must be sequenced **behind** this one, since it would otherwise make the
   double-Snuff strictly stronger.
2. **Specify the Call's trigger, nomination step and no-majority result** (§15). B3.
3. **Give §13.1's inactivity trace a pre-reduced field** (`oddSockFloorAtNightEnd`) and rewrite the
   voice rule to match what the nine categories actually do. B4 — blocks slice 1, which is next.
4. **Resolve §12.4's timing explicitly as the anti-crowd-hiding choice** (§4), knowing from Lane 8
   that this is the switch between a blind-Call game and a solved one — not a wording tidy.
5. **Ghosts perceive occupancy counts, not figures** (§14.1) — closes both F10.1 and the tracking leak.
6. **Delete the §8 clause that forces 172 lines into a morning-six-only Call** (Lane 1: takes it 172
   → 0) and **amend §15.4** so a second attempt exists (198 → 884 lines).
7. Cut or define **"corrupt the Hearth"** (§16.6) — a fourth win condition appearing once in 902
   lines, with §16.5 explicitly funnelling both sides toward the Hearth, so the default reading is
   "villain sprints there and wins."
8. Pin **whether Take persists into the Last Night** (§16.4 vs §16.6) — decides whether slice 2a
   tests a pure Bind hunt or a two-way race. Do not record it as a dead clause; both readings are
   live. Same for the **§12.5 / §16.4 Slip charge collision**, which blocks specifying slice 2a.
9. **Pin sock persistence wording** (§11) — §1 above. One sentence, no behaviour change.

### ⚠️ Held back deliberately — do not apply blind

**Pricing grouping in §12.1** rather than in §19. This is the fix the strategic picture (§4) most
demands, and it is also the riskiest item here. Lane 8's proposal fills §7's empty "publicly
telegraphed house event" slot (build-spec §8.5) with: *a flame goes out at the end of any night in
which no living child entered an unlit room.* **Lane 8 self-reported that its first attempt at this
delta was itself a BLOCKER** — suppressing the Shed for a never-alone villain zeroes the sock supply
and makes §7's only child win path unavailable; the bad version is recorded in its lane file so
nobody re-proposes it.

A rule that changes where or whether evidence lands, proposed by the lane that already got it wrong
once, against a **supply floor of exactly 2 with no headroom**, should be **measured before applying
— not reasoned about further.** This is precisely the class of change this project has four times
found argument gets wrong. It needs the §4 equilibrium reproduced against a movement model first.

**One structural recommendation beyond the deltas.** §6.1's "no room has more than two exits" is
mathematically a max-degree-2 constraint, so the 10-room house is **provably a corridor or a ring and
nothing else** — zero branch points (Lane 3 and Lane 5 independently brute-forced this to n=7). Lane
3's single-sentence fix restores branch points while preserving the Bind: *"No room has more than
three exits, counting doorways, stairs and the secret passage. A Bind (§16.3) may only be completed
in a room with exactly two exits."*

---

## 8. What this review cannot answer, in principle

Unchanged: **§32 Q1 — is the silence fun — remains unanswerable**, and nothing here changes the
one-tester constraint. This was a paper review; it produced no play data and no §30 number should be
cited from it.

Also flagged for the build spec, not resolved: **spec §8.1 does not determine slice 2a's headcount.**
Lane 5's minimum-children table shows lantern+lantern on a two-exit room needs **1 living child under
both readings** — the Bind toy stages at 2 humans either way. The §8.1 reading bites elsewhere
(sustaining a Bind through the 10-second knock-out window, and the one-working-lantern case). Lane 5's
recommendation: **build slice 2a to run at both 2 and 3 seats and let play pick the reading.**

And Lane 5 confirmed my C6 in a sharper form than I stated it: a **fully collapsed 0-exit room is
UNBINDABLE** under a literal read of §16.3, because there is no exit for a lantern to seal and the
clause fails vacuously. §16.5's collapse therefore first makes the Bind easier, then impossible.

---

## 9. What this run did not finish — a separate claim from §8

A session limit killed 8 of 14 lanes mid-write. Distinguishing what is unanswerable from what simply
was not completed:

| Lane | State | Missing artifact |
|---|---|---|
| 4 — information sufficiency | script recovered and re-run by me; numbers in §5 | author's **verdict, findings and delta layer**. The 0-bit Midnight result and the 0.8408-bit gap have had no author interpretation or self-attack |
| 5 — Bind / Last Night | script recovered and re-run; results in §2, §8 | author's verdict and delta layer. Its tables are self-documenting, so this gap is the smallest of the three |
| 6 — pairing dominance | script recovered and re-run; results in §4 | author's verdict and delta layer, including the `testimony` parameter it names as the one input that moves its conclusion |
| 12 — genre prior art | **unreliable** — hit a fetch rate limit and self-flagged unverified claims | the whole lane. **Do not cite its numbers.** Its three finding headers are suggestive only |
| 1, 11, 13, 14 | complete files written before dying | nothing material |

**Two of these are worth resuming**, in this order: Lane 4's interpretation layer (its Midnight
zero-bits result is the strongest single number in the review and currently has no author attack on
it), and Lane 12 entirely (prior art is the one lane whose absence cannot be substituted by my own
reading, and this project has already measured that its genre's conventional wisdom was wrong).

Lanes 5 and 6 do not need resuming — their scripts are self-documenting and their results are
reproduced above.
