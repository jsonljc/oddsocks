# ODD SOCKS v12 — BUILD DESIGN

How to get the v12.0 game specification to a full playable prototype.

**Status:** approved 2026-07-29. Supersedes nothing in `src/` — both `src/rules/` (v10, 206 green)
and `src/v6/` (the Trail) are now **frozen references**.

**Scope of this document.** It is not a rules document. v12.0 is the rules document, and it is
assumed here in full. This says what to build, in what order, what each step can and cannot
learn, and where it stops.

**Scope of the implementation plan that follows it:** slices 0 and 1, plus the tester track, up
to the gate in §6. Everything past the gate is sketched in §7 and is deliberately not planned,
because planning it would mean planning against an unvalidated premise — the failure this whole
document is arranged to avoid.

---

## 1. The decision, and what it cost

v12 is a **third game**, not an evolution of v6. Its rules conflict with v6's at the root:
Shed-every-night vs Shed-after-two-quiet; 20 rooms vs 8; the Corner vs the Bind; wax vs flames.
There is no reconciliation that isn't a fourth game.

The price was stated before the decision and is recorded here so it is not rediscovered:

**v12 forfeits this project's one earned advantage — measurement.** Every load-bearing v12
mechanic is spatial and continuous: lantern *radius* prevents Takes (§10.2); "no second living
child *close enough* to intervene" (§12.1); contact maintained for a *duration* (§12.1); sound
audible *on that floor* (§12.1); hold a room *four seconds* with both exits sealed (§16.3). None
of it is expressible in the v6/v10 abstraction of one room per night and discrete occupancy. The
measurement discipline that overturned argument four separate times in this project cannot be
pointed at v12's core loop until continuous space, movement speed, line-of-sight and light
volumes already exist — that is, until the game is built.

And v12.0 §30 says it plainly: *"Nothing in this document has been derived from play of this
ruleset."* v10 has 206 tests and two human sessions. v6 has a measured engine and a tuned wax
curve. **v12 has zero.** The evidence base restarts from nothing in a medium where each
measurement costs 10–50× more.

This is the accepted cost of the direction, not an argument against it.

---

## 2. The constraint that shapes the whole plan

**There is one tester.**

v12.0 §32 Q1: *"Is the silence fun? The premise of the entire project, and the one thing no
specification can answer. Everything else here is re-tunable. This is not."*

It needs six humans. There is one. That is not a hard problem — it is an **unanswerable** one
until the tester situation changes. This document does not assume validation arrives later. It
splits the work at exactly the point where one person stops being enough, and puts a gate there.

Prior measurement in this project already named six-simultaneous-humans as the cap on the whole
enterprise (`docs/findings/2026-07-29-retention-synthesis.md`, Constraint A). v12 makes it
harder: exactly six, real-time, 12–18 minutes, no player-count flex (§4.1).

---

## 3. Architecture

### 3.1 Stack

| Layer | Choice | When |
|---|---|---|
| Client | Vite + TypeScript + **PixiJS** | Slice 0 |
| Audio | Web Audio via Howler or bare `AudioContext` | Slice 0 |
| Server | **Colyseus** (authoritative rooms, TS) | Slice 2b — **not before** |
| Transport | WebSocket, room codes, no accounts | Slice 2b |

**Why PixiJS.** Rooms are discrete boxes, so §10.2's "illuminates a defined area" reduces to a
room-scoped light mask — a black overlay with radial gradient punch-outs, clipped per room. That
is dramatically cheaper than general 2D shadow casting, and it leaves direct control over §21's
storybook look, which is the product's actual differentiator.

**Why the server is deferred to slice 2b.** Authoritative real-time netcode is the single largest
technical risk in this project. Slices 0 and 1 do not touch it and are not wasted if it never
gets built.

**Alternative considered and rejected: Godot 4.** It gives Light2D, LightOccluder2D and a native
Steam export for free. Rejected because its web export is a multi-megabyte WASM bundle, and
instant-link liquidity is the *measured* cap on this project. A click-to-play link is the
difference between measuring and not measuring at 12–18 minutes per session.

**Consequence to accept:** web-first **defers** v12.0 §26's business model rather than deciding
it. Premium + Friend Pass is unbuildable on a free web link. Steam via Tauri or Electron stays
open; it is a later call, not a foreclosed one.

### 3.2 Repository layout

New top-level `v12/` in the existing repo, with its own `package.json` and `tsconfig.json`. The
existing root toolchain (`odd-socks-sim`, tsx + vitest) is untouched. Nothing is shared but the
`docs/` tree, which is referenced constantly and should stay in one place.

```
v12/
  src/
    core/      deterministic simulation. Zero imports from render/, audio/, app/.
    house/     house definitions as data. Imported by core/ only.
    render/    PixiJS view. Imports core/ types. Contains no game logic.
    audio/     sound layer. Consumes core/ events.
    log/       match-log schema, replay, house report, claim board.
    app/       wiring, input, scene management.
  test/
```

The `core/` boundary is enforced by a test that fails on a forbidden import, not by review.

### 3.3 The two load-bearing architectural rules

**Rule 1 — the simulation is deterministic, headless and fixed-timestep.**

`core/` runs at a fixed 30 Hz tick. It takes a house definition, a config, a seed, and a stream
of per-player inputs. It produces state and a typed event log. It imports no renderer, no audio,
no network.

This buys three things at once, and it is the direct descendant of what the existing repo already
got right (headless `rules/` + separate CLI + separate bots):

- Slice 2b's server-authoritative model becomes a drop-in — the server runs the same core.
- Replay works, which §22.1, §22.2 and §22.3 all require.
- The core is testable without a browser.

**Rule 2 — the match log is the spine, and the derived views are pure functions over it.**

Every core mutation emits a typed event. That stream is the match log. Two pure functions read
it:

- `houseReport(log, night) → Report` — v12.0 §13.1.
- `playerView(log, playerId) → PlayerKnowledge` — powers §22.1 and §22.2.

**`houseReport`'s type signature must make the voice rule unbreakable.** §13.1 requires that the
house's phrasing depends only on the room and the night, never on who was standing in it. Rather
than enforce that in review, `houseReport` is given a projection of the log with actor identities
already stripped — except for the one field §13.1 grants it, which children did not return. If
the function cannot see identities, it cannot leak them, and the rule holds by construction for
the life of the project.

Design the log in slice 1. It is needed by every slice after, and retrofitting it is expensive.

### 3.4 Match log shape

Indicative, to be pinned in slice 1. Every event carries `tick`, `night`, `kind`.

```ts
type MatchEvent =
  | { kind: 'move.enter';    actor: ActorId; room: RoomId; via: DoorId }
  | { kind: 'door.toggle';   actor: ActorId; door: DoorId; open: boolean }
  | { kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight';
      actor: ActorId; lantern: LanternId; room: RoomId; watching?: DoorId }
  | { kind: 'take.warn' | 'take.complete';  actor: ActorId; victim: ActorId; room: RoomId }
  | { kind: 'sock.spawn';    sock: SockId; room: RoomId; source: 'take'|'snuff'|'shed' }
  | { kind: 'sock.pickup' | 'sock.drop' | 'sock.secure';
      actor: ActorId; sock: SockId; room: RoomId }
  | { kind: 'flame.out';     reason: FlameReason; remaining: number }
  | { kind: 'claim.place';   actor: ActorId; claim: Claim }
  | { kind: 'call.open';     unlockedBy: [SockId, SockId] }
  | { kind: 'call.vote';     actor: ActorId; accused: ActorId; inFavour: boolean }
  | { kind: 'call.resolve';  accused: ActorId; correct: boolean; votesCast: number }
  | { kind: 'glyph.fire';    actor: ActorId; chain: Glyph[]; room: RoomId }
  | { kind: 'whisper';       ghost: ActorId; effect: WhisperEffect; room: RoomId }
  | { kind: 'slip';          actor: ActorId; from: RoomId; to: RoomId }
```

A sock carries `spawnRoom` (never published) and `foundRoom` (what §11.2 records). See §8.2 below
— the semantics of `foundRoom` are currently ambiguous in v12.0 and must be pinned before
`Displace` is implemented.

---

## 4. Slice 0 — The House at Night

**Solo. No networking, no roles, no evidence, no morning.**

### In scope

- Eight-room house across two floors, fixed layout, plus Shared Bedroom and Hearth Room.
  Two stair connections. **No room exceeds two exits** (§6.1 — a hard constraint, because §16.3's
  Bind requires sealing every exit).
- Top-down real-time movement: walk, run, open/close doors, hide briefly behind furniture.
  Circle-vs-AABB collision. No navmesh.
- **Darkness model.** Per-room ambient light as a function of night number, following §18's
  escalation. Placed lanterns light a radius. Carried lanterns give a weak personal radius.
  Light level at a position is a core-computed value, not a rendering artefact — §12.1's "dark
  enough" is a threshold on it.
- **Identity in darkness (§9).** Below a light threshold: name tags hidden, pyjama colour
  desaturated, silhouette partially obscured. Footsteps remain perceptible.
  Computed in `core/` as `visibilityOf(observer, target)`, not in `render/` — slice 2b needs the
  server to decide authoritatively what each client is told.
- Two carryable and placeable lanterns, with §11.4's carry costs.
- Sound: footsteps by surface, doors by floor, lantern sputter.
- **One scripted stalker** on a seeded path that can perform a Take on the player, with §12.1's
  warning window.

### Out of scope

Networking, roles, socks, flames, morning, claim board, glyphs, ghosts, the Call, the Last Night,
final art.

### What this answers

- Is the house **readable in darkness** (§6.2)?
- Does §6.2's hard rule hold — darkness conceals identity and detail but **never** obscures
  navigation?
- Does the Take land as a moment?
- Is the light model beautiful? (§21 is a real asset and the recruiting value depends on it.)

### What it cannot answer

Anything about silence, deduction, evidence, or balance.

### Known weakness, and the mitigation

A scripted stalker is frightening once and never again — the tester wrote its path. Mitigate with
a **seeded** start position and path chosen from a fixed set: deterministic and inspectable per
seed, never adaptive. It is set dressing, and §9 below forbids reading any number off it.

### Second job

Slice 0 is the **recruiting artefact**. Thirty seconds of a house that looks alive recruits
testers better than a pitch does, and it is the part of the work that plays to the builder's
strengths.

### Acceptance

§6.2's rule is **two-part**, and acceptance must fail in both directions. A house where
everything stays legible fails §9 as surely as one where you get lost.

1. **Navigation survives.** A player can traverse all eight rooms plus both stair connections
   without getting lost, on night six's ambient level, without a minimap.
2. **Identity does not.** At night six's ambient level, an observer cannot tell which child is
   which at a stated distance — while still being able to tell that *someone* is there.
   Without this criterion, every other one is satisfiable by a house that is simply too bright.
3. Placing a lantern visibly changes what is knowable about a doorway.
4. The Take fires, warns, and can be escaped by reaching lantern light.
5. `core/` runs headless in a test with no Pixi import, and the same seed plus the same inputs
   produce a byte-identical event stream. Slice 0 emits a **provisional** stream; slice 1 pins
   the schema. Determinism is required from the first tick, because retrofitting it is expensive
   and slice 2b's server depends on it.

---

## 5. Slice 1 — The Morning, replay-driven

**Solo. Still no networking. Still no engine coupling.**

### In scope

- **Pin the match-log schema** (§3.4). This is the deliverable; the rest of the slice exercises
  it.
- Hand-author a complete six-night match log by hand, including a Displace, a failed Call, and a
  claim-board contradiction.
- `houseReport(log, night)` rendering §13.1's report in its stated order, with the voice rule
  enforced by the type signature (§3.3).
- The claim board (§13.2): place one claim per morning, all four link types, permanent public
  stack, visible contradiction.

**Review the report renderer for inferential leakage, not only literal leakage.** The type
signature in §3.3 stops the *code* emitting a name. It does not stop the *report* identifying
someone. §10.3 has a lantern report direction, count, timing and whether movement was calm or
hurried — with six players and one doorway, that combination frequently names the person to
anyone who was in the adjacent room. That may well be intended (§3.3: the house never lies, it
only hides), but slice 1 against a hand-authored log is where it would otherwise be discovered
by accident.

### What this answers

- Does the house report **read well**? §13.1's design rule is that every mechanic must be
  learnable from the reports alone — that is checkable against a hand-authored log without an
  engine.
- Can a claim be placed inside sixty seconds?
- Is a contradiction **visible** on a populated board, or does it need hunting for?

### What it cannot answer — stated plainly

Whether claims **carry arguments**. That is §32 Q5's real question and it needs six humans.

And the solo limit on the timing test: the tester is the fastest possible user of a board they
built. A solo pass can show sixty seconds is **definitely too slow**. It cannot show it is fast
enough.

### Why this is durable work

§22.2's full timeline and §22.3's haunting reel both consume this log. It is required regardless
of what happens at the gate.

### Acceptance

1. The six-night log renders six reports with no code reading actor identity outside the
   did-not-return field.
2. A contradiction planted on night two against night four is findable on the board by someone
   who did not plant it.
3. Timed: placing one claim, from morning start to committed, measured in seconds.

---

## 6. ⛔ The Gate — two tiers, not one

The gate is tiered because the slices behind it have different headcounts, and collapsing them
into a single six-human bar would delay the cheapest available signal for no reason.

**Gate A — two to three humans, twice.** Unlocks slice 2a, the Bind toy. This is the earliest
point at which §32 Q1 can be answered at all, and the bar is three friends on a call.

**Gate B — six humans, twice.** Unlocks slice 2b and everything after it. Authoritative netcode
and the full evidence loop are built only once a full table is reachable.

Both are checked when slices 0 and 1 land.

**If neither is met:** record the findings and **park v12.** Do not build authoritative netcode
on an unvalidated premise. This is written now, while it costs nothing, rather than discovered
three slices in.

The downside of reaching the gate and failing it is bounded by design: slice 0 is a playable
house and a recruiting artefact, slice 1 is a log format and two renderers the real game needs
regardless. Neither is discarded by parking.

### The tester track — parallel, non-code, has a date

Runs alongside slice 0 and does not block it. Playtest-swap Discords, r/playmygame, indie
playtest channels, a scheduled game night. Free. This is the deliverable the gate reads from,
and it is the only work in this document that can move the constraint in §2.

---

## 7. Slices beyond the gate

Deliberately less detailed. Specifying them now would be specifying against an unvalidated
premise, which is the failure mode this whole document is arranged to avoid. They are listed so
the shape of the whole is visible.

**Slice 2a — The Bind toy.** *Needs 2–3 humans, not 6.*
One room, two exits, lanterns, ninety seconds, the Odd Sock already visible.
The Last Night is **the only phase of v12 with no hidden information at all** (§16.1 reveals the
villain) — no roles, no evidence, no reports, no glyph vocabulary. It therefore tests §32 Q1
(is the silence fun) and Q6 (can a group coordinate a Bind without speech) for the price of one
page, at the lowest headcount anywhere in the game. It is deliberately contrary to §29, which
buries the Last Night behind twelve other systems.

**Slice 2b — The Night, networked.** Colyseus authoritative server, room codes, six seats, roles,
Take / Snuff / Displace, socks, flames, the Hearth.

**Slice 3 — The Loop.** Full morning, the Call and voting, ghosts and Whisper, the Last Night
wired to a correct Call, the called shot.

**Slice 4 — The Product.** Final art, sound language, house objects, tutorial, personal
postmortem, full timeline, haunting reel, lobby, reconnection, accessibility.

---

## 8. Problems in v12.0 found while reading it against this build order

### 8.0 — A defect, not an ambiguity: §12.4's anti-hiding rule is weakest against hiding

**This is a design defect and should be fixed in the rules, not pinned in the implementation.**

§12.4 Sheds a sock "into the exact room the Odd Sock ended the night in," and states its purpose:
hiding must carry "a price sharp enough that sitting still for six nights loses." Now follow the
villain who actually commits to hiding. §13 requires every living player to return to bed, so the
villain must end each night in or beside the Shared Bedroom anyway. That is the one room where a
Shed sock is either meaningless or is surrounded by five other children with equal claim to it.

Both resolutions of the timing are bad:

- **Resolve after the return to bed** → every Shed lands in the Shared Bedroom and is worthless.
- **Resolve before the return** → the villain idles in a room adjacent to the bedroom and pays
  almost nothing.

So the anti-hiding rule is at its weakest against precisely the strategy it exists to punish.
§32 Q4 asks whether dawn-after-six is too kind to hiding; this answers it on paper, before any
play. §30's own kill conditions would flag it.

**This blocks nothing in slices 0 or 1** — no build decision waits on it. It needs a rules
answer before slice 2b, and it is recorded here so it is not discovered by a playtest that cost
six people an evening.

### 8.1–8.8 — Ambiguities that must be resolved before they are implemented

Each one blocks a specific slice.

**8.1 — §16.3: can the doorway-holder also be the watcher?** The Bind needs both exits sealed and
"at least one living child keeping sight." If the child holding exit B also counts as the
watcher, the Bind toy tests at **two** humans; if not, **three**. Blocks slice 2a and determines
its headcount, which given §2 is the most consequential ambiguity in the document.

**8.2 — §11.2 / §12.3: what does a sock actually record?** §11.2 says "room where it was
**found**." §12.3 says "where it was found, not where it fell," which reads backwards — if it
fell in B and is found in B, those are the same room. The reading consistent with the design
intent is: **a sock records the room a child picked it up from, and never its origin.** Displace
works because it changes the pickup room. Pin this wording before implementing Displace. Blocks
slice 2b.

**8.3 — §12.4: when does "the night ended"?** Promoted to §8.0 above — pinning the timing does
not repair it, because both answers fail. Left here as a pointer so the numbering matches
anything already referencing it.

**8.4 — §11.4: what enforces "the Odd Sock may not carry a sock into the Shared Bedroom"?** If it
is a hard block, the villain is visibly unable to enter and it is a tell that ends the game. If
the sock is auto-dropped, where? Blocks slice 2b.

**8.5 — §7: "a publicly telegraphed house event resolves against the children" burns a flame.**
No such event is specified anywhere in v12.0. Either define it or remove the clause. Blocks
slice 2b.

**8.6 — §10.2 vs §16.4: does a knocked-out lantern still prevent Takes during its ten seconds?**
§16.3's second Bind guarantee depends on lanterns being unkillable during the Last Night. Pin whether
"knocked out" suspends the Take-prevention radius, the seal, both, or neither. Blocks slice 2a.

**8.7 — §15.1 vs §15.4.** Two secured socks are "consumed" to unlock a Call; a failed Call
"destroys both socks." They are already gone. Harmless, but pin the wording so the implementation
does not double-charge.

**8.8 — §15.3: majority of what?** Ghosts spend one-time votes (§14.3), so the denominator moves
between Calls. Pin: a strict majority of votes **actually cast in that round**.

### Checked and sound

§5's timing table is arithmetically correct: 30 + 6×90 + 6×60 + 90 + 60 = 1080s = **18.0
minutes**, matching its stated figure. The early-end case computes to 10.5–13 minutes against a
stated ~12. No correction needed.

---

## 9. What this plan deliberately does not build

**9.1 — No policy bot. A scripted actor instead.**

v12.0 §29 calls the bot "a way to evaluate the prototype without assembling six networked
humans." That framing is how this project's headline v10 metric turned out to be 70.9 points of
night-one bot error, how the v6 searcher silently collapsed into the huddle it was built to
oppose, and how nobody ever answered a Naming. Bot defects mimic rules defects, and in real time
there is no clean per-night state to diff them against — the failure mode gets *harder* to catch,
not easier.

A scripted path is deterministic and inspectable; it cannot silently collapse into a degenerate
strategy. **The scripted actor never produces a number.** Policy bots wait until humans exist and
there is a reason to measure.

**9.2 — No economy simulator for §32 Q2, Q3 or Q4.**

Modelling "can a child physically reach and secure a sock in ninety seconds" as a parameter is
precisely the abstraction that has measured nothing here four times over (`neverForcedRate` was a
tautology, raw `collapseRate` was a night-one artefact, `holders` was a flow where the question
needed a stock). Build no economy sim until a real movement model exists to calibrate it against.

**9.3 — Not §29's Prototype 1 as written.**

Fifteen subsystems, evaluable only by six networked humans. That is the build-everything,
measure-late failure this project has already recorded.

---

## 10. Housekeeping

`v5-engine` carries the entire v6 engine and its findings and is **unpushed**. Push it before any
further branching, or it exists on one disk.

---

## 11. Inherited open questions

v12.0 §32 stands unchanged. This document's contribution is to say which of the seven can be
answered by whom, and when:

| # | Question | Answerable by |
|---|---|---|
| 1 | Is the silence fun? | Slice 2a, behind Gate A — earliest possible signal, 2–3 humans |
| 2 | Is two socks the right price for a Call? | Not before slice 2b. No sim (§9.2) |
| 3 | Does Displace get used? | Not before slice 2b |
| 4 | Is dawn-after-six too kind to hiding? | Not before slice 2b, and depends on §8.3 |
| 5 | Does the claim board carry arguments? | Six humans. Slice 1 tests only usability |
| 6 | Can a group coordinate a Bind without speech? | Slice 2a, behind Gate A |
| 7 | What does the Odd Sock do on quiet nights? | Slice 2b. Still the least examined seat |
