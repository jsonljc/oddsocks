# Slice 0 acceptance — Task 11

Status: **every criterion below is unanswered by design.** This document was written by the
implementing agent, not a human playtester. The agent verified what it could measure
programmatically or by direct pixel inspection of the rendered scene (noted under each
criterion), but the actual pass/fail calls in v12.2 §4 are judgments about whether a dark house
is *frightening and readable to a person* — that is the human's call to make, not the agent's,
and the brief this document answers to says so explicitly. **Do not read any checkbox below as
a verdict.** They are all empty. What follows each is evidence for the human to weigh, not a
substitute for the human's own pass.

## Why the agent could not run its own live playthrough

The browser available to the agent (Chrome via automation tooling) reports `document.hidden ===
true` for the tab at all times, which freezes `requestAnimationFrame` completely — measured
directly: `0` callbacks fired in a 500ms window, confirmed by injecting a counting `rAF` loop.
`Stage`'s game loop (`render/stage.ts` -> `app.ticker`, which is rAF-driven) therefore never
advances past its first frame or two in this environment, no matter what keys are dispatched —
this is an environment constraint of the sandboxed automation tool, not a defect in the shipped
code. A real user's foreground browser tab does not have this problem.

To still extract real evidence from the running scene rather than giving up on it, the agent
built a small diagnostic harness (not shipped — lives only in the browser console during this
session) that dynamically imports the actual `render/*.ts` and `core/*.ts` modules Vite already
serves, constructs a real `Sim` and a real Pixi `Stage`, calls `drawLighting`/`drawActors`
directly, forces one synchronous `app.render()` (bypassing the frozen ticker), and reads back
**actual rendered pixel values** via Pixi's `renderer.extract.pixels()` API. Every pixel number
quoted below is measured this way, from the real compositing pipeline, not estimated by hand.

---

## Criterion 1 — Navigation survives

> Traverse all ten rooms and both stairs at `?night=6` without a minimap.

- [ ] **UNANSWERED — awaiting human.** This requires sustained real-time movement, which the
  frozen ticker (above) made impossible to drive live in this session.

What the agent did verify:
- All twelve rooms (the ten plus Shared Bedroom and Hearth) render with correct geometry, labels,
  and door placement — confirmed by direct pixel sampling in `nursery`, `attic`, `kitchen`,
  `conservatory`, `shared_bedroom`, and `hearth`, and by screenshot at both `?night=1` and
  `?night=6`.
- `core/movement.ts`'s door-crossing logic (the mechanism navigation depends on) has its own
  dedicated tests (`test/movement.test.ts`, `test/doors.test.ts`, `test/sim.test.ts`'s
  `move.enter` tests) including a regression test for a prior soft-lock at walk speed.
- The scene now moves five actors it did not move before this task (see the report's finding
  #1) — untested live, but the code path (`nextInput` without `tickBehaviour`) is the same one
  `test/stalker.test.ts` already exercises for the villain.

## Criterion 2 — Identity does not (survive the dark)

> Stand at the far corner of a room from another child at `?night=6`, unlit. You must **not** be
> able to tell which child it is — while the silhouette stays visible.

- [ ] **UNANSWERED — awaiting human.** Whether two greys are "distinguishable" is a perceptual
  judgment. Run this at a room that is dark tonight, per the brief's own instruction — not every
  room is dark on every seed.

What the agent measured directly (night six, all six actors together in a dark Attic, no
lanterns lit, `bell` as observer):

| actor | rendered RGB | role |
|---|---|---|
| bell | (217, 138, 138) | observer's own body — always full colour, by design |
| pike | (91, 93, 99) | silhouette |
| clem | (107, 105, 105) | silhouette |
| wren | (99, 102, 100) | silhouette |
| sparrow | (90, 85, 95) | silhouette |
| moss | (98, 103, 106) | silhouette |

The five silhouettes cluster tightly — every pairwise channel difference among them is ≤20/255,
most ≤10/255 — while every one of them sits ~100+/255 away from the observer's own saturated
colour on every channel. That is real supporting evidence that hue alone will not identify a
child in the dark, but it is not the same thing as a human looking at the screen and being unable
to tell; the agent did not perform that look itself and is not claiming to.

Also measured: the silhouette is genuinely visible, not swallowed to nothing. Bare dark-room
background (night six, no actor) reads luminance 9.5; pike's silhouette at the same darkness
reads luminance 93.1 — clearly present. (For contrast: painting actor bodies *underneath* the
lighting overlay instead — the rejected alternative — was also measured directly by temporarily
reordering the same scene: the identical pixel drops to luminance 19.1, barely above the 9.5
background. This is the concrete, on-screen version of the arithmetic in `render/actors.ts`'s
Z-ORDER docstring, not a re-derivation of it.)

## Criterion 3 — The house sounds occupied through a wall

> Stand still in one room while another child moves in an adjacent one. You must be able to hear
> that someone is moving, without being able to tell who.

- [ ] **UNANSWERED — awaiting human.** Requires real-time movement and actual listening; the
  frozen ticker (above) and, separately, a frozen `<audio>` metadata load in the same hidden tab
  (fetch() of the same files succeeded with 200 — see below — but `loadedmetadata` never fired
  within 2s, consistent with the same hidden-tab throttling, not a code defect) meant the agent
  could not drive or hear this live.

What the agent did verify:
- All eight placeholder cues (`v12/public/sfx/*.wav`) exist, are valid WAV audio (confirmed via
  `afinfo`), and are served correctly (`fetch()` returned HTTP 200 with the correct `audio/wav`
  content type and byte count for every file). Before this task, **no sound assets existed at
  all** — this criterion would have been silently unverifiable with no error anywhere to explain
  why (see the report's finding #2).
- `audibleVolume`'s room/adjacency/floor model is fully unit tested, including a new test that
  specifically pins that sound crosses a stair the same as any other adjacent room (a case the
  brief's own original test suite did not sample, and would have silently passed even if every
  stair in the house leaked sound — see the report).
- The scene now feeds real input to all six actors, not two (see the report's finding #1) — a
  prerequisite for this criterion to be checkable at all, since a house with one moving body has
  almost nothing to hear.

**If this criterion fails, check the volume arithmetic before suspecting `audibleVolume`.** A
careful (non-hurried) footstep heard from an adjacent room multiplies out to: the generated WAV's
own gain (0.5, baked into `step.wav`) × `soundFor`'s volume for a careful step (0.3) ×
`audibleVolume`'s adjacent-room attenuation (0.45) ≈ **0.0675 of full scale** (about −23 dBFS).
That is likely audible on headphones in a quiet room and marginal on laptop speakers. If a
neighbour can't be heard, the fix is almost certainly **raising the gain in
`gen-sfx.mjs`-equivalent WAV regeneration** (or the volumes in `soundFor`), not `audibleVolume`
itself — the cross-room model is unit tested and structurally doing what it says. A hurried
footstep is louder (0.5 × 0.5 × 0.45 ≈ 0.1125, about −19 dBFS) but still quiet by the same margin.

## Criterion 4 — A placed lantern visibly changes what is knowable about a doorway

- [ ] **UNANSWERED — awaiting human.**

What the agent measured directly (night six, real rendered pixels):

- **Lantern brightness vs. an ordinary lit room** (Task 9's by-eye finding, "~50/50"): a placed,
  lit lantern's own centre in an otherwise-dark room reads RGB (131, 111, 87), luminance 114.2.
  An ordinary lit room with no lantern, same night, reads RGB (24, 20, 31), luminance 22.4. That
  is roughly **5x**, not "~50/50". **This finding does not reproduce as measured; no tuning was
  applied, because none was needed to make the lantern read as brighter — it already does,
  clearly, by a wide margin.** (Numbers match a hand compositing calculation done before looking,
  to within rounding — see the report.)
- **Glow bleed past a wall** (Task 9's other by-eye finding, up to 66px into the next room): fixed
  via `render/lighting.ts`'s new `glowPolygon`, which clamps every glow-ring vertex into the
  source's own room rect. Measured directly: a lantern placed at the closest wall distance the
  movement code allows (`ACTOR_RADIUS` = 14px from the wall, the same worst case the Task 9 report
  used) lights its own room's wall-side point to luminance 56.4, while the exact point 66px into
  the neighbouring (dark, unlit) room — where the old, unclipped circle would have peaked —
  reads luminance 9.5, **identical to a point with no nearby lantern at all.** Zero measurable
  bleed.
- **Doors above the overlay, actual pixel change**: measured old order (doors painted before the
  lighting overlay) vs. the adopted new order (doors painted after) at the same door's 10px stub
  inside a dark room, isolated from any nearby lantern glow. Old: luminance 11.9 (barely above
  the 9.5 background — a ~1.25x contrast, likely imperceptible). New: luminance 56.4 (a ~5.9x
  contrast against the same background — an unmistakably door-coloured patch). The reorder is a
  real, if narrow (10px-per-side), legibility change, not merely a theoretical one.

These are strong, directly-measured supporting numbers for "a lantern changes what's knowable",
but the criterion as written is about a human being able to *use* that information while playing,
which the agent did not verify live.

## Criterion 5 — The Take fires, warns, and can be escaped by reaching lantern light

- [ ] **UNANSWERED — awaiting human.** Requires live play (a real grab attempt, a real escape) to
  actually watch happen on screen; not driveable with the ticker frozen.

What the agent did verify: this is the most heavily unit-tested mechanic in the codebase.
`test/take.test.ts` (16 tests) covers every `canTake` block condition individually, including
lantern protection and the broken-attempt latch (§4's "reaching lantern light saves you", proven
by a dedicated regression test against a prior bug where an escape only paused the grab instead
of resetting it). `test/stalker.test.ts` drives the *scripted villain's own tick loop* — not a
direct call — through a full grab completion, a broken-and-restarted attempt, and a fleeing
victim outrunning the chase at the correct relative speed (§4's "the Odd Sock moves slower"). One
side note the human should expect and not read as a bug: `INTERVENE_RADIUS` is 200px in a
260×200 room, so once this task's fix makes all five other children wander instead of standing
still, a wandering witness sharing the stalker's room can legitimately block a Take from
completing — that is correct §7 "witness" behaviour, not a regression.

## Criterion 6 — `npm test` green, including determinism

- [x] **PASS — personally verified.** `cd v12 && npm test` (`tsc --noEmit && vitest run`):

```
Test Files  16 passed (16)
     Tests  141 passed (141)
```

(141, not the 142 this agent first reported: a second advisor pass found two byte-identical tests
in `test/sounds.test.ts` — same inputs, same expectation, different names — left over from
restructuring a test case without checking the original still earned its place. Removed the
duplicate in a follow-up commit; nothing else changed.)

Includes `test/sim.test.ts`'s `describe('determinism')` block (byte-identical event stream for
the same seed/inputs; diverges for a different seed; actually exercises room crossings, not just
footsteps) and `test/boundaries.test.ts` (no `core`/`log`/`house` file imports
`render`/`audio`/`app`/`scripted`; no `Math.random`/`Date.now`/`performance.now` in `core`/`log`).
This is the one criterion the agent ran itself, start to finish, and is confident stating plainly.

---

## For the human running the actual pass

- Start the dev server (`cd v12 && npm run dev`) in a normal, focused, foreground browser tab —
  the frozen-ticker problem above is specific to the sandboxed automation tool and should not
  occur for you.
- Try `?night=1` (mostly lit, to learn the house) and `?night=6` (nearly the whole house dark
  except the Hearth — only the Hearth is exempt from darkness on night six with the current
  `DARK_ROOM_COUNT_BY_NIGHT` table, so criterion 2 needs a room other than the Hearth).
- **For criterion 2's "a dark room and a faintly lit one must look different from a doorway"**
  (the property `overlayAlphaFor`'s own docstring calls "the whole point of slice 0"): neither
  `?night=1` nor `?night=6` actually presents a usable mix to judge that contrast against — night
  one has only 3 of 11 non-Hearth rooms dark, and night six has all 11. Use **`?night=3` or
  `?night=4`** instead (7 and 9 of 11 dark, respectively) to stand in a doorway and compare a dark
  room against a lit one side by side.
- Controls: **WASD/arrows** move, **Shift** runs, **E** picks up a lantern, **Q** places one
  (watching the nearest door), **F** toggles the nearest door, **C** hides.
- If criterion 2 fails in a room that is genuinely dark tonight, the brief says to tune
  `DARK_AMBIENT_BY_NIGHT`/`MAX_OVERLAY`, never the criterion itself.
- If criterion 3 fails, treat it as serious — per the brief, it means the game has no cross-room
  perception at all, not a tuning problem. But check the volume arithmetic under criterion 3
  above first: a careful footstep next door is quiet by design (~−23 dBFS), and the likely knob is
  cue gain, not `audibleVolume`.
