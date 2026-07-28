# ODD SOCKS — the Record, and a lantern leak

**Date:** 2026-07-28
**Status:** **PARKED — not for implementation.** See §10.
**Input:** `src/cli/play.ts` (the single-seat CLI), the 2026-07-26 baseline findings

> **Read §10 before anything else here.** A second adversarial pass found that this
> design's central value claim is an artifact of villain-bot error on night one. The
> corrections in §3.4 and §4 hold and are worth keeping; the case for building the feature
> does not. Nothing below §10 has been withdrawn, but nothing below §10 justifies writing
> code either.

---

## 1. What this is

An on-demand evidence surface inside the play CLI, plus one engine fix that the CLI's
existence has just made live.

The purpose is narrow and worth stating plainly: **no human has played ODD SOCKS.** The
harness has run 24,000 games and cannot answer the one question the project most needs
answered, which is whether a person can hold this game in their head. The CLI exists now.
This design removes the one thing standing between it and a useful first session.

That thing is bookkeeping. To compare what Bell said on night 2 against night 5 you
currently scroll. A session run that way tests the terminal, not the design — "I couldn't
follow it" would be an artifact of the interface rather than a fact about the game.

---

## 2. What a single-seat session can and cannot settle

Recorded first, because the value of everything below depends on it.

**It can settle:** whether the night's decision load is reasonable; whether the
exactly-4-hop walk and the dead-end bedrooms feel deliberate or fiddly; whether the public
log is readable; whether lying as the villain is a real problem to solve or a formality.

**It cannot settle the morning.** Spec §9's board, the six-symbol language, the four
utterances, the arguing — none of it is built, and none of it is testable against bots,
which do not argue. That is arguably half the game and this session does not touch it.

**It cannot settle balance, and the numbers are currently distorted at both seats.** After
the 2026-07-27 Call fix the children win 97.9% against the shipped villain bot and 75.4%
against a perfect route-planning one. Whichever seat is played, the outcome is close to
predetermined. Read the session for texture and load; do not read it for tension.

---

## 3. The Record

### 3.1 Access

Typing `?` at any prompt prints the record and re-asks the question. Dusk, midnight,
morning, and the bare `[enter]` pauses all inherit it.

Dusk matters as much as morning here: deciding where to walk is exactly when you want to
know who claimed what, and a morning-only digest would give you nothing at the moment you
most need it.

### 3.2 Layout

Players down, nights across, each cell the room that player claimed:

```
             n1     n2     n3     n4     n5
  bell      wHl    kit    Bel     —      —
  pike      Pik    Pik    kit    lnd    sew
  clem *    Cle    eHl    Cle    Cle    kit
  ...
```

Bedrooms capitalised, commons lowercase — `Bel Pik Cle Wre Spa Mos` and
`kit wHl eHl lnd sew att`. `—` is a claim the Hush removed. `*` marks your own row.

Below the grid, one compact block per night of what the house announced: thefts, trails,
calls and their outcomes, oddity announcements, items. This is the same material the
morning already prints, gathered so it can be read down a column rather than scrolled.

Each night's block also carries **your own sighting for that night** — the room you were
in, whether it was lit, and who you saw — marked as yours and private. You legitimately
have this, it is what a real player would have written down, and without it the grid
cannot be checked against the one row of ground truth you actually possess. It is the only
private material the record contains.

### 3.3 What gets flagged

Two rules, both lifted from the solver's own constraint table (§6.1 of the harness design)
so this surface and the instrument agree about what counts as evidence:

| Rule | A claim of room `R` for night `n` is contradicted when… |
|---|---|
| **Witness** | someone reported a **lit** room `S ≠ R` for night `n` and named the claimant in it. |
| **Anti-witness** | someone reported the **lit** room `R` for night `n`, **named at least one other person**, and did not name the claimant. A lit room hides nobody. |

Dark-room reports never flag anything. A dark room names nobody, which is the whole reason
it is worth sleeping in.

### 3.4 A flag never fires on a truthful claim

**This is the design's one load-bearing property, and it is measured rather than argued.**

The anti-witness rule's "named at least one other person" clause is the whole of it. An
earlier draft of this spec omitted it and defended the result as the productive ambiguity a
real table lives with. Applying both rules to 2,000 real games says otherwise:

| anti-witness rule | flags/game | share landing on the villain | villain caught out |
|---|---|---|---|
| fires regardless (the earlier draft) | 1.49 | 66.1% | 83.5% of games |
| **requires a named witness** | **0.83** | **100.0%** | 77.5% of games |

Chance is 16.7%. The columns that matter are the last two: the loose rule adds half a flag
per game, every one of which lands on an innocent, and catches the villain in **not one
additional game**. The ambiguity it produces carries no information. It was noise defended
as texture.

> **The "villain caught out" column is itself misleading — see §10.** 70.9 of those 77.5
> points land on night one alone, and they are produced by an unforced villain-bot error
> rather than by the evidence engine. The honest figure for nights two onward is 6.5%. The
> precision result above stands; the detection result does not.

The reason is R19. The villain's public report carries the room they *claimed* and names
nobody, so under the loose rule it contradicts every innocent who truthfully claims that
same room. Excluding the villain's report directly is not available — the record cannot
know who the villain is — but requiring the reporter to have named somebody excludes it
without identifying it, and stands on its own terms: *"I was in a lit room and saw Pike"*
demonstrates observation, while *"I was in a lit room and saw nobody"* is equally
consistent with never having been there.

The resulting property is structural, not statistical. R14 makes every innocent bot claim
its true room; neither narrowed rule can contradict a true claim. The 100% is therefore a
consequence of the rules, and the guarantee to state precisely is **"a flag never fires on
a truthful claim"** — a human child who lies would be flagged, correctly.

The price is six points of detection (83.5% → 77.5%), paid for a surface that never
misleads. In a session whose purpose is deciding whether this game is legible, a tool the
player must learn to distrust is worse than one that occasionally stays quiet.

### 3.4a Rendering: a list, not marks on the grid

At 0.83 flags a game, a contradiction is a rare event, not a field to shade. Flags are
therefore rendered as an explicit list beneath the grid, each naming both statements:

```
  night 3   bell claims kitchen
            pike reports kitchen, lit, names clem and moss
```

A mark on a grid cell cannot say *which* two statements collided, which is the only thing
the player can act on, and it reads as an accusation whatever the legend says. The grid
stays for scanning a player across nights; collisions are their own section.

### 3.5 Deliberately excluded

- **The dark-room census.** The solver's third constraint counts claimants against a
  reported occupant count. It is an inference chain rather than a direct contradiction, and
  it is the rule most likely to mislead a reader who has not internalised its assumptions.
- **The solver's viable-set output.** Showing which rooms remain consistent for the villain
  would end the game as a deduction exercise.
- **Note-taking.** If the session shows a need for it, that is a finding, not a
  prerequisite.

---

## 4. The lantern report leak

The findings document books three leaks as *"inert now and go live with item-spending
bots."* The CLI is an item-spending client, so the first of them went live the moment it
shipped.

`runMorning` calls `clearNightlyItemEffects` before building reports. An innocent's report
carries `lit` from their midnight sighting, taken while the Lantern was burning; the
villain's is recomputed from `isLit` after it went out. A villain claiming a lantern-lit
bedroom therefore reports `lit: false` where every truthful occupant of that room reports
`lit: true`.

That is a one-bit villain detector, and it is exactly the class of leak R19 exists to close.
It would surface through §3.3's rules in the first session that spends a Lantern.

**Fix:** snapshot `state.lanternRooms` at the top of `runMorning`, before
`clearNightlyItemEffects`, and have the villain's branch of `reportOf` compute `lit` against
the snapshot rather than against live state.

**The obvious alternative is wrong and must not be taken.** Moving
`clearNightlyItemEffects` to after the report loop looks like the tidier fix and silently
breaks both item effects: `applyItemUses` runs *inside* that loop (`night.ts:198`) and
pushes the lanterns and bell watches just spent, so a clear placed after it wipes them.
Lanterns and Bells would stop working and no existing test would notice, because neither has
ever fired. The clear must stay where it is.

**No sweep number can move.** Across all 24,000 games the Lantern fired zero times (Limit 6),
so no swept game has ever had a lantern-lit room for this to disagree about. The fix is
verified by construction and by re-running the sweep to a cell-for-cell match.

---

## 5. Architecture

```
src/cli/
  record.ts        renderRecord(state, me): string — pure, no I/O
  record.test.ts
  play.ts          `?` interception; imports renderRecord
src/rules/
  night.ts         the §4 ordering fix
```

`renderRecord` takes the `GameState` and the viewing player and returns a string. It is
pure and does no I/O, which is what makes it testable — the same reason `src/rules/` is
written the way it is.

**Prompt plumbing.** `?` is handled by the callers, not inside `ask`, because `choose`
prints its menu before prompting: after the record scrolls past, the options have to be
re-rendered. So `choose` moves its menu print inside its existing retry loop, and `yes` and
the bare pauses gain the same loop. `ask` itself stays dumb and returns `?` like any other
answer.

**The information boundary holds.** `renderRecord` reads `state.history` — claims,
reporters, public events, and `sightings[me]` and no one else's — which is exactly the
material `knowledgeFor` projects for this player. It must not read `midnightPositions`,
`held`, `marked`, `villain`, or any other player's sightings. A test asserts this by
constructing a state whose ground truth contradicts the public record and checking the
render is unchanged.

---

## 6. Testing

`record.test.ts`, TDD, one behaviour per test:

- the grid renders a claim per player per night, with `—` for a Hushed claim
- **witness**: a lit report naming someone elsewhere flags their claim
- **anti-witness**: a lit report from the claimed room that names someone else and omits
  them flags their claim
- **the §3.4 property**: a report from the claimed room that names *nobody* flags nothing —
  asserted with a villain's R19 report colliding with an innocent's true claim, which is the
  exact shape that produced 0.5 false flags a game in the earlier draft
- a **dark**-room report flags nothing, under either rule
- a collision renders both statements, not a mark (§3.4a)
- the render ignores ground truth (the §5 boundary check)

For §4, a test that a villain claiming a lantern-lit bedroom reports `lit: true`, matching
the occupants — and which fails against the current ordering. Plus a regression test that a
Lantern spent this morning is still lighting its room tonight, which is what the wrong fix
would break.

---

## 7. What this does not change

No rules change. No change to any bot. No change to the win conditions, the map, or the
config. The §4 fix is an ordering correction inside an existing function and is required to
leave the sweep table identical cell-for-cell.

---

## 8. What this is still not

A verdict from one person playing one seat against bots is a data point about load and
texture. It is not evidence that the game works, because the morning — the half where six
people argue — remains unbuilt and untestable at this fidelity. The honest next question
after the session is whether the morning is worth building at all, and that is a decision
this session informs rather than settles.

---

## 9. Blocking gate: reconcile against v10 §9

**This spec is not cleared for implementation.**

The v10.0 rules document is not in this repository and has not been read by the author of
this design. Its §9 describes a **morning discussion board**, and this spec's central
justification — that the Record approximates a component the real game already has — is an
assertion about a document nobody here has opened.

Three things have to be checked before a line is written:

1. **Does §9's board already specify what players may see?** If so, the Record implements it
   rather than inventing it, and its contents follow from the rules instead of from §3.2.
2. **Does the board show contradictions?** If the rules already say how a disagreement is
   surfaced at the table, §3.3 and §3.4 must match that and not a rule invented here.
3. **Does §9 bound what a player may write down?** The four-utterance budget suggests the
   design cares about limiting what gets said. If it also limits what gets *recorded*, an
   unlimited perfect record contradicts the design's intent, and the whole surface needs
   rescoping.

If the board turns out to specify something incompatible, the correct response is to change
this spec, not the rules. The measured results in §3.4 survive either way — they are facts
about the engine's evidence, not about the interface.

---

## 10. Second adversarial pass: why this is parked

### 10.1 The value claim was night-one bot error

§3.4 justified the feature with "villain caught out in 77.5% of games" and never asked
*when*. Flags by night, narrowed rule, 2,000 games, default config:

| night | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| flags per game | **0.76** | 0.00 | 0.01 | 0.01 | 0.02 | 0.01 | 0.02 |
| flag rate per claim | **12.7%** | 0.0% | 0.1% | 0.4% | 0.5% | 0.5% | 0.6% |

Villain flagged **only on night one: 70.9%**. On **night two or later: 6.5%**. Never: 22.6%.

This is the same error the build ledger is a monument to. `collapse` read 85–98% until
someone checked the distribution and found 85% of it on night one; `lateCollapseRate` was
the honest metric. This spec's first draft reproduced that mistake exactly, in a document
that cites it.

### 10.2 The right reading is worse than "a night-one novelty"

The obvious analogy to `collapse` is wrong and should not be repeated. A night-one
*collapse* was worthless because it pinned the villain's **room** on a night with no theft.
A night-one *flag* pins their **identity**, and identity does not decay.

So the finding is not that the flags are a harmless early novelty. It is that **in 76% of
games this surface names the villain on the first morning** — the deduction game resolved
before a light has been stolen.

The cause is not structural. A truthful claim provably cannot be flagged under either
narrowed rule (§3.4), and night one has no theft, so **lying on night one buys the villain
nothing**. A competent villain claims their true room and is never flagged.
`heuristicBot`'s `villainClaim` instead draws near-uniformly from reachable rooms and walks
into a contradiction three games in four.

### 10.3 Consequence for the session this was built to serve

Both seats fail, in opposite directions:

- **Playing a child** — the bot villain lies badly on night one, the Record names them on
  morning one, and the remaining six nights are Calls at a known target.
- **Playing the villain** — a human stops lying on quiet nights almost immediately, and the
  flags then fire in 6.5% of games.

The surface therefore either ends the game at once or does nothing, and neither outcome
teaches anything about whether the game is legible.

### 10.4 Two findings about the game that outlive this spec

Recorded here because they are about ODD SOCKS, not about the Record, and should migrate to
the findings document when it is next rewritten.

1. **The villain's dominant line is to tell the truth on every night they did nothing.**
   §9's claim pressure — *"every theft leaves a hostage in the record"* — only bites on
   theft nights. The villain currently spends about 2.6 of 6 nights taking no action at all,
   and on each of those a truthful claim is free and unfalsifiable. Any future villain bot
   should do this, and its absence is why `villainClaim` looks so much weaker than the
   design is.
2. **The Hush empties the record exactly as the endgame arrives.** Mean claims on the record,
   out of six:

   | night | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
   |---|---|---|---|---|---|---|---|
   | `silent` (default) | 6.00 | 5.03 | 4.25 | 3.70 | 3.33 | 3.07 | **2.88** |
   | `oneNight` | 6.00 | 5.03 | 5.22 | 5.45 | 5.63 | 5.74 | **5.79** |

   Under the default, half the grid is dashes by night seven. This is an argument for
   `hushMode: 'oneNight'` that does not route through `lateColl` at all, and it is the first
   independent one the project has.

### 10.5 What survives, and what happens next

**Keep:** the §3.4 narrowing (precision genuinely went 66.1% → 100.0%, and the property is
structural), the §3.4a rendering argument, and the §4 mechanism correction — the wrong
lantern fix would break Lanterns and Bells whether or not this feature is ever built.

**Withdraw:** the case for building it. Two adversarial passes established what the feature
does not do and nothing about what it should be. The missing input is not another
measurement; it is one human playing one game, which is what the CLI was built for and what
has still not happened.

**Unparking condition:** a raw session against `npm run play`, with notes on every moment the
player reached for something the terminal would not give them. Design the surface from that
friction. The §9 gate on the v10 rules document stands independently and is unaffected.
