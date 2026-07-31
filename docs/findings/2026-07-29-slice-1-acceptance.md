# Slice 1 acceptance — Task 16

Status: **every perceptual criterion below is unanswered by design.** This document was written by
the implementing agent, not a human playtester. Two of spec §5's three acceptance criteria are
explicitly *timing and legibility* questions that the brief and the design spec both say cannot be
answered by a test, and cannot be answered by the person who built the screen either — see the
stated limit under Criterion 3. **Do not read any unchecked box below as a verdict.** What follows
each is evidence for a human to weigh, not a substitute for the human's own pass.

## Why this document can go further than slice 0's did

Slice 0's acceptance document (`docs/findings/2026-07-29-slice-0-acceptance.md`) could not be driven
live: the sandboxed browser tab reports `document.hidden === true` permanently, which freezes
`requestAnimationFrame`, and the night scene's whole simulation loop runs off Pixi's rAF-driven
ticker. The morning scene has no such loop — it is plain DOM (`innerHTML` templates and `onclick`
handlers), redrawn synchronously on each click, with no `requestAnimationFrame` anywhere in it. So
the agent *could* drive this one live in the sandboxed browser (`npm run dev`, port 5183) and take
real measurements from real interaction, not just from direct pixel/data inspection. That is used
below wherever it is honest to use it — but per Criterion 3's stated limit, driving it *at all* is
not the same thing as driving it *as a first-time human would*.

---

## Criterion 1 — Six nights render six reports; no code reads actor identity outside `didNotReturn`

> Spec §5 / brief: "Six nights render six reports, and no code reads actor identity outside
> `didNotReturn`. (The voice-rule test proves the second half.)"

- [x] **PASS — personally verified.** Unlike Criteria 2 and 3, this is not a perceptual judgment —
  it is a factual claim about what text a fixed function produces, and it is checkable directly.

Navigated to `?scene=morning&night=N` for N = 1..6 and read the rendered `.report` text at each
(the claim-board rows below the report are excluded from this check — see the note at the end of
this criterion for why that distinction matters):

```
Night 1: No flame went out. 5 remain.
         The Hearth Room lantern watched an empty doorway.

Night 2: pike did not return.
         One flame went out. 4 remain.
         Something was disturbed in the Attic.
         A sound came from upstairs.

Night 3: No flame went out. 4 remain.
         The Music Room lantern watched 2 figures cross.
         The Music Room lantern was moved.
         One sock was secured.

Night 4: No flame went out. 4 remain.
         A sound came from downstairs.

Night 5: One flame went out. 3 remain.
         One sock was secured.
         Something was disturbed in the Music Room.
         A sound came from upstairs.
         The children crowded together.

Night 6: One flame went out. 2 remain.
```

Six reports, all textually distinct, all non-empty. Night 6 matches `test/fixture.test.ts`'s own
pinned expectation (`toEqual(['One flame went out. 2 remain.'])`) exactly.

**Identity check, done directly against this real output, not only by citing the test:** grepped
all six reports above for all six actor names (`bell`, `pike`, `clem`, `wren`, `sparrow`, `moss`).
`pike` appears exactly once, in Night 2, in exactly the sentence §8 grants ("pike did not
return."). No other name appears anywhere in any of the six reports — not `wren` (the culprit),
not any bystander. This is independent, direct confirmation of the same property
`test/report.test.ts`'s `'produces identical text when only the identities differ'` test proves by
construction (cyclically rotating which actor plays every role except the taken child between two
runs and demanding byte-identical output). Between the two: the existing test proves the property
holds for *any* assignment of identities to roles; this direct read confirms it holds for *this*
fixture's actual assignment, on the actual screen a human will look at.

**Why the claim-board rows are excluded from this check, deliberately:** the voice rule (v12.2 §8:
"the house never says anything that depends on who someone is") binds `renderReport`'s output — the
house's own narration. The claim board is a different channel by design: §8 explicitly lets any
living player name any person in a mark ("A person to a room... a person to a person..."), and the
board rows on this same screen do contain names, including `wren`'s, freely (e.g. `n3 · bell → wren
in the Attic`). That is players making claims — possibly false ones — not the house talking. Folding
these two together would have manufactured a false failure; keeping them apart is what makes this
criterion meaningfully different from Criterion 2, which is specifically about those claim rows.

---

## Criterion 2 — The contradiction is findable by someone who did not plant it

> Brief: "The contradiction planted on night 3 against night 5 is findable **by someone who did not
> plant it**. Ask this of yourself honestly, or better, of anyone at all."
> (Spec §5's own text says "night two against night four" — citation drift from an earlier draft;
> the brief's numbers match the actual fixture, and are used here.)

- [ ] **UNANSWERED — awaiting human.** This is a perceptual judgment about visual search on a screen,
  by someone who did not build it and does not already know the answer is there. The agent cannot
  honestly self-certify this — the task instructions restate it as one of "the two things this slice
  exists to find out," explicitly not answerable by a test, and this document treats it that way.

**A finding, not a fix: the brief's instruction to open exactly `?night=5` does not surface the
specific pair its own criterion text names.** Traced empirically, not assumed:

- `runMorningScene` preloads the board from `SIX_NIGHT_CLAIMS.filter(c => c.night < night)` — the
  claims already public *before* this morning's own claim gets placed live.
- At `night=5`, that loads claims from mornings 2–4 only (`c1`..`c6`). Bell's cellar claim (`c7`,
  night 5) is **not yet on the board** — it is what would be placed *this* morning, and in this
  slice only the human playing `bell` can place it. The one contradiction visible at `night=5` is
  real (`c1` hearth vs `c4` attic — "bell put wren in two rooms — night 2 and night 3"), confirmed
  by screenshot, but it is not the specific night-3-vs-night-5 pair the criterion text names.
- At `night=6`, `c7` (night 5) is loaded alongside everything else, and the board shows the full
  three-way tangle `test/board.test.ts`'s own `'surfaces all three pairwise contradictions...'` test
  pins: exactly three contradiction lines, covering all three room pairs. Confirmed live —
  screenshot below shows all three, including the specific pair: **"bell put wren in two rooms —
  night 3 and night 5."**
- **Considered and rejected changing the filter to `c.night <= night`** so `night=5` alone would show
  everything: at `night=5` that would also preload bell's own `c7` (night 5), and the human's live
  commit attempt this morning (`{night: 5, by: 'bell', ...}`) would then collide with it on
  `placeClaim`'s one-mark-per-morning check and be refused outright — making Criterion 3 (placing a
  claim at all) impossible to perform at `night=5`. `<` is the semantics that keeps both criteria
  performable at the same URL; the fix belongs in the citation, not the code.

Both nights, run for real, screenshots and full board text below.

**At `?scene=morning&night=5`** (one contradiction, the pair actually reachable at this URL):

```
n2 · bell → wren in the Hearth Room
n2 · clem → moss in the Kitchen
n3 · sparrow → Attic: a noise upstairs
n3 · bell → wren in the Attic
n4 · clem → denies c4
n4 · sparrow → wren and sock_1

bell put wren in two rooms — night 2 and night 3
```

**At `?scene=morning&night=6`** (the full three-way tangle, including the specific pair named in the
criterion):

```
n2 · bell → wren in the Hearth Room
n2 · clem → moss in the Kitchen
n3 · sparrow → Attic: a noise upstairs
n3 · bell → wren in the Attic
n4 · clem → denies c4
n4 · sparrow → wren and sock_1
n5 · bell → wren in the Cellar
n5 · clem → Music Room: the lantern went out

bell put wren in two rooms — night 2 and night 3
bell put wren in two rooms — night 2 and night 5
bell put wren in two rooms — night 3 and night 5
```

The agent's own honest attempt at "finding" this: reading the eight `n_ · actor → ...` rows at
night=6 top to bottom, the three `bell → wren in the ...` rows (Hearth Room / Attic / Cellar) are
visually adjacent in the list (same author prefix, same subject, three different rooms) and the
contradiction text directly beneath restates all three pairings in plain English. **This is not
evidence the criterion passes** — the agent already knew `bell`'s claims were the planted tangle
before looking (it read `fixture.ts`'s own docstring), which is exactly the disqualifying condition
in the criterion's own wording ("someone who did not plant it"). It is offered only as a description
of what is literally on the screen, for the human's own look to weigh independently.

## Criterion 3 — Timed: seconds from morning start to a committed claim

- [ ] **UNANSWERED — awaiting human, and structurally unanswerable by this agent alone.**

**The stated limit, up front:** the agent that built this board is the fastest possible user of it.
A solo timing pass can show that sixty seconds is *definitely too slow* (if even the builder cannot
do it in sixty). It cannot show that sixty seconds *is* enough for a person seeing this board for
the first time, with no idea yet which button does what, no memory of where "Nursery" sits in a
12-button grid, and no prior reason to trust that three clicks is all it takes.

**Three different numbers were measured, and they measure three different things. None of them
answers the question.**

1. **The console line, read three separate times, driving real clicks through the actual browser
   automation tooling** (fresh page load each time, then subject click → room click → commit click):
   `49.1s`, then `7.5s`, then `8.2s`. These numbers are dominated by **this agent's own tool-call
   round-trip latency** between issuing the page-navigation and issuing the click sequence — not by
   anything about the UI. The nearly 6× spread between three identical 3-click sequences is itself
   the evidence for that: a human doing the same fixed motion three times would not vary 6×. **Do
   not read any of these three numbers as a UI or human timing.**
2. **A synthetic UI-floor measurement**, bracketing only the three DOM operations with a fresh
   `performance.now()` taken immediately before and after, inside one synchronous script (no
   tool-round-trip in between): **0.9 ms.** This shows the mechanism itself — button click → handler
   → `placeClaim` → re-render → console line — adds no meaningful latency of its own. It is not a
   human number either: it has no reading, no deciding, and no pointing in it.
3. **The click count, timing-independent and the most honest datum here:** placing a claim is
   exactly **three clicks** — one subject button (of 5), one room button (of 12, wrapping across two
   rows), one "Commit claim" button. No modal, no confirmation step, no drag gesture. Verified by
   doing it, repeatedly, through the real DOM.

**Also verified live, as a side effect of testing the timing path:** a second commit attempt in the
same morning is correctly refused, not silently accepted or crashed — `[claim] refused: bell has
already placed a mark this morning (night 5)`, and the board shows only the one claim that actually
landed. `placeClaim`'s one-mark-per-morning rule surfaces correctly all the way through the UI, not
just in `test/board.test.ts`.

What none of this shows: how long a first-time human actually takes to *read* the board, *decide*
what to claim, and *find* the right two buttons among seventeen unfamiliar ones, under real time
pressure with the other five nights' reports and rows also on screen. That is exactly what Criterion
3 is asking, and it is a human question.

---

## Suite status

- [x] **PASS — personally verified.** `cd v12 && npm test` (`tsc --noEmit && vitest run`):

```
Test Files  20 passed (20)
     Tests  207 passed (207)
```

Same count as Task 15 left. No new test file was added for `morning.ts` — see the report
(`task-16-report.md`) for why: it is DOM-wiring glue over already-tested pure functions, the same
shape as `app/scenes/night.ts`, and `vitest.config.ts` pins `environment: 'node'` with no `jsdom`
dependency installed, so a DOM-touching unit test would fail on that basis alone. This is the one
criterion on this page that is purely mechanical, which is why it alone gets a checked box — the
same reasoning slice 0's acceptance document used for its own criterion 6.

---

## Inferential leakage

Required by the brief's Step 5 and by design spec §3.3: a review of the rendered reports for
**inferential** leakage, not literal leakage. The type system already makes literal leakage
impossible (`HouseProjection` carries no `ActorId` field but `didNotReturn`, and `renderReport` is
never given anything else to leak) — confirmed directly above under Criterion 1. This section is
about a different, subtler failure mode: whether a bare, identity-free report line, read by someone
who already has *some* private information of their own (their own location that night, a glimpse of
a silhouette, the claim board), lets them re-identify a specific person the house itself never named.
**This is a design finding to record, not a bug — the code is doing exactly what it was told to
do.** It directly answers an open question `task-12-report.md` raised and left for this task:
*"`outward`/`hurried` left unpopulated ON PURPOSE... OPEN QUESTION FOR TASK 13."* Tasks 13–15 left it
open in turn; this is where it gets an answer.

### The concrete case: Night 3's lantern record

```
The Music Room lantern watched 2 figures cross.
The Music Room lantern was moved.
```

Ground truth, visible in `fixture.ts` (never shown to a player): `bell` and `clem` both cross
`music_room → playroom` through the watched doorway (the "2 figures"); `moss` picks the lantern up
and sets it back down in the same spot (the sole cause of "was moved" — `project.ts`'s `moved` flag
flips only on a `lantern.carry` event, and there is exactly one such event, by exactly one actor,
this night).

**The "moved" line is the sharper leak of the two, and it needs no direction or timing to work.**
It is a true, single-bit fact — "someone touched this lantern tonight" — attached to a specific room
and a specific night. On a night where **exactly one person** did that (as here), the line is not
protecting anyone: it is confirming, with the full authority of an unbiased narrator, whatever a
bystander who was themselves near the Music Room that night already half-saw (v12.2 §4: silhouettes
stay visible, footsteps stay audible, even in the dark — sight and hearing do not stop working, only
naming does). The report doesn't say `moss` — but for that one witness, "the house says the lantern
was moved" plus "I saw a shape at the lantern around then" stops being two separate soft signals and
becomes one confirmed fact. **This is structural, not deductive: the report is doing the identifying
work, not the player.**

This also means the field's leak-severity is inversely tied to how busy the room was, which nobody
building toward this fixture had to design in — it falls out of the shape of the data. A room with
one visitor that night is maximally identifying if it reports `moved: true`; a room with five
visitors carrying the same lantern back and forth all night reports the identical single line and
protects everyone equally, by accident. Quiet nights leak the most.

**The crossing count compounds this, and would even without "moved."** "2 figures crossed" is a bare
number, structurally identity-free — but the game has six players, and by the time any given
morning arrives, an observer typically already has independent information (their own location, the
claim board, a direct glimpse) accounting for several of the other five. A count that would leave
real ambiguity in a twenty-player game can collapse to one or two names by elimination in a six-player
one. The report's *form* (numbers, never names) is privacy-preserving in isolation; the *population*
it is reporting on is small enough that the same form does not guarantee anonymity in substance. This
is the general version of what spec §3.3 flags, and it is visible in this fixture's real numbers, not
only in the abstract.

### What is already mitigated, and should stay that way

`LanternRecord.outward` (which side of the doorway) and `.hurried` (calm vs rushed) are **not**
populated by `project.ts` today — hardcoded to `0`/`false`, with comments at their construction site
explaining why. This review confirms that restraint was well-placed: either field, turned on, adds a
second axis on top of the count that would narrow things further (direction tells you which room the
crossers ended up in; manner is a behavioural tell a bystander could match against someone they saw
moving briskly). **Concrete residual risk:** the fields exist on the `LanternRecord` type, unpopulated
rather than removed, so nothing at the type level stops a future task from wiring them up without
re-deriving this reasoning — only the comments at their construction site do. Worth a code comment
cross-reference to this finding, not a code change now.

### What is not a leak, and why

- **`didNotReturn` naming a room via `roomsDisturbed`, for a take:** e.g. Night 2, "pike did not
  return" + "Something was disturbed in the Attic." This tells everyone the *victim's* location —
  explicitly sanctioned (§8 grants naming who didn't come back, and separately grants which rooms
  were disturbed). It says nothing about the culprit. Not a leak of the kind §8's voice rule exists
  to prevent.
- **`floorSounds`:** floor-level only ("A sound came from upstairs"), never a room. Weaker than
  `roomsDisturbed` by construction — a floor of this house has up to six rooms.
- **`crowded`:** a single boolean, no room, no names, no count beyond "three or more." The weakest
  signal on the page — on its own it rules out nothing beyond "somewhere, some room reached three
  bodies."
- **The claim board itself:** carries real names throughout (`wren` appears eight times across the
  six boards above). This is not a leak — see Criterion 1's note above. §8 explicitly designs the
  board to carry identity; the voice rule binds the house's own narration, not the players' marks.

---

## For the human running the actual pass

- Start the dev server (`cd v12 && npm run dev`) and open it in a normal, focused, foreground
  browser tab. Unlike slice 0's night scene, this screen has no known environment-specific
  driving problem — it is plain DOM, no canvas, no `requestAnimationFrame`.
- **Criterion 2:** open `?scene=morning&night=6` to see the full three-way tangle (the specific
  night-3-vs-night-5 pair lives there, not at `night=5` — see the finding above). Read the board
  once, cold, and time how long it takes your eye to catch that `bell`'s three room-claims disagree
  with themselves, without reading this document's own walkthrough first.
- **Criterion 3:** open `?scene=morning&night=5` (or any night), place one claim (pick any subject,
  any room, click "Commit claim"), and read the number the console prints — `[claim] placed after
  Xs`. That number, for you, is the real one this criterion asks for. The agent's own numbers above
  cannot substitute for it.
- Controls: five subject buttons, twelve room buttons (wrapping onto a second row), one "Commit
  claim" button. `aria-pressed="true"` marks your current selection on each row.
- If the window is short enough that content runs past the bottom, the page scrolls now (see the
  report's note on the `overflow` fix) — this was verified to actually block scrolling before the
  fix and actually allow it after, not merely reasoned about.
