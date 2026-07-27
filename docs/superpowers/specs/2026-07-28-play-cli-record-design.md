# ODD SOCKS — the Record, and a lantern leak

**Date:** 2026-07-28
**Status:** Approved design
**Input:** `src/cli/play.ts` (the single-seat CLI), the 2026-07-26 baseline findings

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
| **Anti-witness** | someone reported the **lit** room `R` for night `n` and did *not* name the claimant. A lit room hides nobody. |

Dark-room reports never flag anything. A dark room names nobody, which is the whole reason
it is worth sleeping in.

### 3.4 Flags are mutual, and sometimes point at the innocent

**This is the design's one load-bearing judgement call.**

A flag means *these two public statements cannot both be true*. It never means *this person
lied*, and the rendering must not imply otherwise.

This matters because of R19. The villain's public report carries the room they **claimed**,
naming nobody. So a villain who lies about the kitchen produces a report that contradicts
every innocent who truthfully claims the kitchen — and is contradicted right back by
theirs. Both cells light up. Neither the surface nor the player can tell which end is
rotten.

That is correct, not a defect. It is precisely the standoff a real table reaches when two
people contradict each other, and untangling it is the game. The alternative — suppressing
any flag whose conflicting report could itself be fabricated — suppresses nearly all of
them, because any report can be the villain's.

The consequence to accept: **the record will sometimes point at innocents.** A player who
reads a flag as an accusation will be misled by it. The rendering carries the burden of
saying "these disagree," never "this one is lying."

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

**Fix:** the villain's report must read `lit` from the same moment everyone else's does.

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
- **anti-witness**: a lit report from the claimed room that omits them flags their claim
- a **dark**-room report flags nothing, under either rule
- **mutual flagging**: a villain's R19 report colliding with an innocent's true claim flags
  both cells — the §3.4 case, asserted directly rather than left as prose
- the render ignores ground truth (the §5 boundary check)

For §4, a test that a villain claiming a lantern-lit bedroom reports `lit: true`, matching
the occupants — and which fails against the current ordering.

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
