# ODD SOCKS — Simulation Harness (Build One)

**Date:** 2026-07-26
**Status:** Approved design
**Input:** ODD SOCKS v10.0 rules document (the character build)

---

## 1. What this is

A headless, deterministic rules engine for ODD SOCKS at **six players**, driven by bots, with a
measurement suite attached. No UI. No network. No art. No humans.

Its job is to answer, before anyone plays: **does the information economy of v10.0 actually work?**

Specifically it must produce a number for each of these:

1. Can Odd Socks always find a safe lie, or are they eventually forced into a contradiction?
2. Does the trail name the thief often enough to matter, or is it noise?
3. Can a Call ever physically assemble two hands, or is the item-holder pool too thin?
4. Does dodging a Call actually cost Odd Socks the game?
5. Does marking dominate once the Call needs only two hands?
6. What are the side win rates, and by which of the two children's win conditions?

It cannot answer "is it too much?" That question needs humans and waits for the hotseat build.

### Non-goals for build one

Out: any UI, networking, lobbies, accounts, persistence, art, sound, the Replay renderer,
the morning discussion board, the six-symbol language, player counts other than six, the
9–10 player duo, and the four oddities that only appear above six players
(Ash, Juno, Fen, Tam).

---

## 2. Why this shape

The rules are written as **pure functions with no I/O**. Today bots call them ten thousand times;
later the real game's server calls them once per night. The resolution core is written exactly once.

Two boundaries carry the design:

- **`truth` vs. `projectView(truth, playerId)`.** The entire game is who-knows-what. Keeping the
  projection in one function makes it testable in isolation, and later means the server can only
  ever transmit a projection — so information leaks become structurally impossible rather than
  something a developer has to remember.
- **Seeded deterministic RNG.** Every game is reproducible from `(seed, config)`. Any anomaly a
  sweep finds can be replayed exactly. The Replay feature (§11 of the rules doc) later falls out
  of this for free: a replay is a seed plus an action log.

### Honest limits

The sim validates **the night**. It is blind to **the morning** — the board, the four utterances,
the arguing. That is §9 of the rules document, it is arguably half the actual game, and none of it
is built here. The sim passing does not mean the game works.

Trust the sim on what is **possible**: tempo, reachability, whether a Call can assemble, whether a
safe lie exists. Distrust it on what is **likely**: bots move heuristically while humans cluster,
follow and camp, so encounter-rate figures are the least reliable output it produces.

---

## 3. Defects found in v10.0 before writing code

These are design problems visible from the rules document. Each becomes a config switch so the
sweep decides rather than the author.

### 3.1 The Hush contradicts mandatory claims, and it inverts

§4 says a Hushed player loses "saying where you slept." §9 says "Everyone must say where they slept,
every morning. No skipping." These cannot both hold.

The resolution matters more than the tidiness. §9 justifies mandatory claims as the pressure on the
villain: *"That's what forces Odd Socks to lie... Every theft leaves a hostage in the record."*

Count the trajectory at six players: five lights required over six active nights. **By night five,
four or five of six players are Hushed** — exempt from the mandatory claim. The claim record thins
out exactly as the endgame squeeze is meant to bite.

Worse, §4 makes the villain's own light free. Self-snuffing therefore buys **permanent immunity
from mandatory claims** — no claim, no lie, no hostage in the record. This is potentially the
villain's strongest opening move, and it costs them a light they never needed.

§4 already carries an escape hatch — *"Fallback: you lose claims only on the night your light
died."* This design treats that as a live hypothesis, not a fallback.

**Ruling:** `hushMode` is config with three values —
`'silent'` (§4 as written, no self-claims ever again), `'oneNight'` (the fallback), `'none'`
(disabled, control condition). Plus `selfSnuffCostsNight: boolean`, default `true`.

### 3.2 Sparrow's oddity is null

§8: *"Sparrow, who listens at doors — when a light is stolen, learns which floor the thief ended
the night on."*

The thief ends midnight **in the robbed bedroom**. The robbed bedroom is public. Sparrow therefore
learns the floor of a room everyone already knows. The oddity conveys zero information.

**Ruling:** implement `sparrowMode` config —
`'asWritten'` (null, kept so the defect is measurable) and `'dusk'` (Sparrow learns which floor the
thief was on **at dusk**, which is real information). Default `'dusk'`.

### 3.3 The Grip is probably toothless

§4 reasons the villain "can never steal and hold a Call-bluff item on the same night." A rational
villain therefore simply carries nothing on theft nights, so the *"you take their item"* clause
almost never fires and the Grip reduces to a consolation prize.

This turns entirely on an unwritten rule: **can items be dropped?**

**Ruling:** `itemsCanBeDropped: boolean`, default `false`. With no drop action, a villain who picked
up an item earlier is stuck holding it and the Grip has teeth.

### 3.4 Theft nights are self-concealing (this is correct, and it is load-bearing)

Not a defect — a consequence worth stating because it drives the whole measurement. §3 resolves
sightings *after* the theft, using post-theft lighting. So a victim who stays home to Grip the thief
is standing in a room that has just gone dark, and sees only a shadow.

Therefore **the villain's only exposure on a theft night is the trail.** That makes trail accuracy
the single most important number in the game, and it is the primary metric of this harness.

### 3.5 The duo looks strictly worse than the solo

At 9–10 players two villains share one action per night, need the same lights, and catching either
one ends the game — same offence, double the exposure. Sold as bluffing ambiguity, reads as a
penalty. Out of scope here; recorded as a reason build one stays at six players.

---

## 4. Rulings the engine forces

v10.0 does not answer these. Each is decided here explicitly.

| # | Question | Ruling |
|---|---|---|
| R1 | "Exactly two rooms" (§2) vs. "up to two" (§3) | A path of **exactly two edges**, revisits allowed. Staying home is `A→B→A`. |
| R2 | Trail radius | The robbed bedroom **and** rooms adjacent to it. The villain is always in the pool. |
| R3 | Who Grips | **Only the bedroom's owner**, only if they ended midnight in their own bedroom on the night it was robbed. |
| R4 | Call whiffs on a room being robbed | Hands present who are not the owner **do not** Grip. |
| R5 | Two players on one item at dusk | Random one takes it. (Contested items were cut.) |
| R6 | Item pool | Fixed reserve of 5: 2 Lantern, 2 Keyhole, 1 Bell. Config. |
| R7 | Items on the map | Spawn at each dusk until **3** are loose in common rooms, or the reserve empties. |
| R8 | Dropping items | Not permitted (`itemsCanBeDropped: false`). |
| R9 | Carrying capacity | 1 item. Moss: 2. |
| R10 | Is theft automatic? | Yes. Ending midnight in another child's lit bedroom steals that light. No declaration. |
| R11 | Self-snuff | Ending midnight in your own lit bedroom as the villain **optionally** snuffs it, declared. Consumes the night's action when `selfSnuffCostsNight` is true. |
| R12 | Calls per night | **At most one** (`maxCallsPerNight: 1`). Build-one simplification; multiple independent Calls deferred. |
| R13 | Night-one items | Pickup is permitted on night one. Only theft, marking and Calls are suppressed. |
| R14 | Bot claim honesty | All innocents claim their true midnight room. Only the villain lies. |
| R15 | Sighting reports | All innocents report all their sightings truthfully. The four-utterance budget of §9 is **not** modelled — build one assumes unlimited reporting, which makes results an upper bound on available signal. |
| R16 | Trail on a self-snuff | **No trail.** §4 describes the trail as what a *theft* leaves behind, and snuffing your own light is a theft against nobody. Emitting one would hand the children a free people-fact for an action that costs the villain nothing. |
| R17 | Who may report | The Hush removes both halves of §4 — a snuffed child can neither claim where they slept nor report what they saw. Testimony from a Hushed child is therefore not public and may not be used as evidence. |

R15 is the most consequential simplification and must be repeated wherever results are quoted.

### A consequence of R1 that shapes the whole game

Because a path is *exactly* two edges with no self-loop, **you can never end a phase in a dead-end
room you are standing next to.** From `west_hall` the only two-edge walk through `bed_bell` comes
straight back out. To sleep in a dead-end bedroom you must begin the phase exactly two rooms away.

Four of Hollow House's six bedrooms are dead ends. So loitering in the hallway outside someone's
door does not let you step in next phase, and the villain must commit to an approach a full phase
ahead of the theft. This was not designed in — it falls out of R1 and the map — but it strengthens
the blind-commitment rule §4 rests on, and it is worth knowing before anyone calls it a bug.

---

## 5. The house

The rules document gives room counts but no graph, and the graph decides everything — encounter
rates, alibi strength, trail adjacency, whether a dodge is available. The canonical six-player map
is therefore a deliverable of this build, not an assumption.

**Hollow House** — 12 rooms, 6 bedrooms, 6 commons, two floors, 14 edges.

Ground floor (`floor: 0`)

| Room | Kind | Doors |
|---|---|---|
| `kitchen` | common | `west_hall`, `east_hall`, `bed_pike` |
| `west_hall` | common | `kitchen`, `bed_bell`, `bed_pike`, `landing` ⬆ |
| `east_hall` | common | `kitchen`, `bed_clem`, `sewing_room` ⬆ |
| `bed_bell` | bedroom (Bell) | `west_hall` |
| `bed_pike` | bedroom (Pike) | `west_hall`, `kitchen` |
| `bed_clem` | bedroom (Clem) | `east_hall` |

Upper floor (`floor: 1`)

| Room | Kind | Doors |
|---|---|---|
| `landing` | common | `west_hall` ⬇, `sewing_room`, `attic`, `bed_wren` |
| `sewing_room` | common | `east_hall` ⬇, `landing`, `bed_sparrow`, `bed_moss` |
| `attic` | common | `landing`, `bed_moss` |
| `bed_wren` | bedroom (Wren) | `landing` |
| `bed_sparrow` | bedroom (Sparrow) | `sewing_room` |
| `bed_moss` | bedroom (Moss) | `sewing_room`, `attic` |

Properties this map is built to have, and which are asserted as tests:

- **Diameter 4.** Crossing the house takes exactly two nights, satisfying §2's alibi promise.
- **Two staircases** (`west_hall↔landing`, `east_hall↔sewing_room`), so there is no single choke
  point through which every floor crossing must pass.
- **Four dead-end bedrooms** (Bell, Clem, Wren, Sparrow) and two with second doors (Pike, Moss),
  so bedroom exposure varies — deliberate, and a reason to sweep alternate maps later.
- **The attic is a near-dead-end**, which gives Wren's public attic tell something to bite on.

The map is data (`GameConfig.house`), not constants, so alternate topologies can be swept without
touching engine code.

---

## 6. The measurement instrument

### 6.1 Safe-lie counting, by dynamic programming

The naive version of this — code an Odd Socks bot that lies, see if it gets caught — measures the
bot, not the design. A weak liar produces false confidence; a strong one produces false despair.

Instead: **compute whether a safe lie existed at all.**

Every innocent claims truthfully (R14), so only the villain's claim history is in question. The
claim space per night is just "which room" — twelve options. So run a forward-backward DP over
nights where the state is *the room the villain claimed that night* and the transition is
*reachable within four edges* (two phases, two steps each).

A room `C` is **viable** for the villain at night `n` if it survives every constraint:

| Constraint | Rule |
|---|---|
| **Reachability** | `C` is within 4 edges of the claim at night `n−1`. |
| **Witness** | If any innocent ended midnight `n` in a lit room with the villain present, they name the villain — so `C` must be that room. |
| **Anti-witness** | If `C` is lit and any innocent ended midnight `n` there without naming the villain, `C` is refuted. |
| **Dark-room census** | If an occupant of dark room `C` reported *k* others, then exactly *k+1* players were in `C`. If the villain claiming `C` pushes the count of claimants past *k+1*, `C` is refuted. Dark rooms are safer, not free. |
| **Trail** | If the trail named the villain on night `n`, `C` must lie in the robbed bedroom or adjacent to it. |
| **Keyhole** | A Keyhole on `(room, night m)` reveals true occupants — it retroactively pins or forbids the night-`m` claim. |
| **Bell** | A Bell naming the villain for night `n` announces their true room, so `C` must equal it. |
| **Pike** | If Pike announced no floor crossing, a claim chain that changes floor is refuted. |
| **Bell's count** | Rooms adjacent to Bell's midnight room held *x* people. Given innocents' true positions, the villain's claim must make the arithmetic work. |
| **Clem's count** | Item-holding is public (pickups are announced), so a claim placing an item-holding villain in Clem's room must match Clem's announced tally. |

Two outputs:

- **`forcedNight`** — the first night on which no consistent claim history survives. `null` if the
  villain was never forced. The distribution of this over ten thousand games is the headline result.
- **`hidingSpace(n)`** — how many rooms remain viable each night. A curve that never narrows means
  the evidence engine is dead regardless of how good the players are.

Because this is policy-independent, it is also the villain's optimal lying policy for free: **the
villain bot claims uniformly at random from the viable set.** If that set is ever empty the villain
is caught by construction, and no separate liar AI needs to be written.

### 6.2 The rest of the metrics

Per configuration, over N games:

1. Villain win rate; children-catch rate; children-survive rate.
2. `forcedNight` distribution, including the share never forced.
3. Mean `hidingSpace` per night.
4. **Trail accuracy** — P(the trail names the actual thief). Per §3.4 this is the most important
   single number in the harness.
5. Calls posted / Calls that went live (≥2 hands) / Calls that caught.
6. Mean item-holders per night — the size of the pool that can physically join a Call.
7. Dodge frequency, and villain nights wasted.
8. Encounter rate (share of rooms holding ≥2 people) — reported, but flagged bot-dependent.

---

## 7. Architecture

```
src/
  rules/                 pure, no I/O — the part the real game reuses verbatim
    rng.ts               seeded mulberry32
    types.ts             domain types
    config.ts            every tunable + the roster
    map.ts               graph queries, legal 2-edge paths
    houses/hollow.ts     the canonical 12-room map (data)
    state.ts             GameState, createGame
    movement.ts          path validation and resolution
    visibility.ts        projectView — the information boundary
    theft.ts             theft, Grip, trail, Hush
    marking.ts           marking
    items.ts             pool, spawn, pickup, respawn
    itemEffects.ts       Lantern, Keyhole, Bell
    call.ts              Call resolution
    oddities.ts          Bell, Pike, Clem, Wren, Sparrow, Moss
    night.ts             resolveNight — orchestration and ordering
    game.ts              playGame, win conditions
  bots/
    types.ts             the Bot interface
    random.ts            uniform legal play
    heuristic.ts         goal-directed play
  analysis/
    safeLies.ts          the DP solver
    metrics.ts           per-game metric extraction
    sweep.ts             config matrix runner
    report.ts            console tables
  cli/
    sweep.ts             entrypoint
```

**Stack:** TypeScript on Node 24, Vitest, `tsx`. Zero runtime dependencies. Every tunable lives in
`GameConfig`, so a sweep is a parameter matrix rather than a series of code edits.

---

## 8. Build order

The engine is large — three item types with three unrelated mechanisms, six oddities each its own
information system, plus theft, marking, Grip, trail, Hush and the Call. Building all of it before
measuring anything is how it stalls.

It is therefore built as **rungs, with a measurement between each**:

1. **Core night loop** — movement, visibility, theft, trail, Grip, Hush, the Call. No items on the
   map, no oddities. Measure.
2. **Items** — pool, pickup, Lantern, Keyhole, Bell. Measure the delta.
3. **Oddities** — the six-child roster. Measure the delta.

Each rung's delta tells you whether that layer earned its place, which is the input needed for the
complexity cut that §12 Q1 of the rules document actually cares about. If the trail turns out to be
the only mechanism that ever contradicts anybody, three oddities get cut before a human sees them.

---

## 9. Testing

Pure functions with no I/O, so this is a near-perfect fit for test-driven development.

- **Golden tests** pin the midnight resolution order: movement → Calls → theft → sightings, with a
  hand-built scenario asserting that a landed trap prevents the light from ever being taken.
- **Property tests** on `projectView`: no player who is neither the villain nor Wren ever receives a
  name from a dark room, across randomised states.
- **Determinism tests**: the same `(seed, config)` produces a byte-identical `GameRecord`.
- **Map invariants**: every edge bidirectional, diameter ≤ 4, staying home legal from every room.

---

## 10. What comes after

Not part of this spec, recorded so the sequencing is visible:

1. **Hotseat build.** Once the engine exists, one screen where the author plays all six seats is
   nearly free — no netcode, no accounts. Tedious, but it surfaces rule holes and complexity load
   in an afternoon without needing six friends. This is the cheapest available attack on "is it
   too much?"
2. **Real multiplayer** at whatever fidelity the rules have earned.
3. **The Don't Starve art direction**, only once the rules have survived humans.
