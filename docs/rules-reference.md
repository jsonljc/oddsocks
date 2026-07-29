# ODD SOCKS — complete game reference

A haunted-sleepover social deduction game. Six kids, one secret villain, seven nights.

## How to read this file

The original rules document ("v10.0") **has never existed in the repo**, so this file is
reconstructed from the running engine code. Everything is tagged:

- **[RULE]** — verified in code. This is what actually happens when the game runs.
- **[MEASURED]** — an observed result from simulation or play. Treat with suspicion: this
  project has been burned four separate times by aggregate statistics that turned out to be
  measuring an artifact concentrated in a single night. Always ask for the per-night
  distribution before trusting an average.
- **[UNKNOWN]** — referenced by the design but never written down or implemented. Do not
  design into these believing you are filling a documented gap; there is no document.

---

## 1. Setup

**[RULE]** Six players, fixed roster in this order: `bell, pike, clem, wren, sparrow, moss`.
One is chosen at random to be the villain, "Odd Socks". Everyone else is a child. Nobody is
told who the villain is; the villain knows.

**[RULE]** Every player owns one bedroom (`bed_bell`, `bed_pike`, …). All rooms start lit.
Everyone starts the game in their own bedroom.

**[RULE]** Seven nights on the clock. The villain needs 5 lights out.

### Win conditions

**[RULE]** Three ways the game can end:

| Outcome | Winner | Trigger |
|---|---|---|
| `lightsOut` | Odd Socks | 5 non-villain bedrooms are dark |
| `caught` | Children | A Call resolves with the villain present in the trap room |
| `survived` | Children | Night 7 ends with fewer than 5 lights out |

**[RULE] The villain's own bedroom never counts toward their win.** They must darken 5 of
exactly 5 other bedrooms — there is no slack in *which* rooms, only in *when*.

**[MEASURED]** The shortest possible villain route is 6 nights against a 7-night clock, so
they get exactly one spare night. This was computed, not designed — it appeared in no project
document before someone worked it out.

**[MEASURED]** `caught` has fired **zero times in every configuration ever tested**. The
children have one real win route: survive. The "catch the villain" condition is, in practice,
decorative.

---

## 2. The house

**[RULE]** "Hollow House" — 12 rooms, 6 bedrooms + 6 common rooms, two floors, 14 doors.
Diameter 4 (the two furthest rooms are 4 doors apart). Two staircases, so no single choke
point carries every floor crossing.

**Ground floor (floor 0)**

| Room | Kind | Doors to |
|---|---|---|
| `kitchen` | common | west_hall, east_hall, bed_pike |
| `west_hall` | common | kitchen, bed_bell, bed_pike, **landing** |
| `east_hall` | common | kitchen, bed_clem, **sewing_room** |
| `bed_bell` | bedroom | west_hall |
| `bed_pike` | bedroom | west_hall, kitchen |
| `bed_clem` | bedroom | east_hall |

**Upper floor (floor 1)**

| Room | Kind | Doors to |
|---|---|---|
| `landing` | common | **west_hall**, sewing_room, attic, bed_wren |
| `sewing_room` | common | **east_hall**, landing, bed_sparrow, bed_moss |
| `attic` | common | landing, bed_moss |
| `bed_wren` | bedroom | landing |
| `bed_sparrow` | bedroom | sewing_room |
| `bed_moss` | bedroom | sewing_room, attic |

The two bolded edges (`west_hall↔landing`, `east_hall↔sewing_room`) are the staircases.

**[RULE]** Bedrooms are dead ends except `bed_pike` (2 doors) and `bed_moss` (2 doors).

**[RULE] Common rooms can never go dark.** Only bedrooms have a light to lose.

---

## 3. The structure of a night

**[RULE]** Each night has three phases: **dusk**, **midnight**, **morning**.

**[RULE] Night 1 is safe.** No theft, no marking, and no Call resolves. The engine gates all
of it behind `night > 1`. Night 1 exists to seed positions and items.

### Dusk

**[RULE]** Items spawn (see §5). Then every player moves along a path of **exactly 2 rooms** —
you name two rooms, each adjacent to the last, and you end in the second. You cannot stand
still and you cannot move 1 room. Then anyone who wants to picks up an item in their room.
Then everyone learns what they can see (§4).

### Midnight

**[RULE]** Everyone moves **another exactly-2-room path**. So a night is **2 + 2 hops with a
commit point in the middle** — you commit to the first half before you learn anything from it.
Getting home from anywhere is always possible within 4 hops, because the map's diameter is 4.

**[RULE]** Midnight then resolves in this exact order, and the order matters:

1. **Movement** resolves.
2. **The Call resolves** (§7) — *before* the theft, so a trap that lands saves the light.
3. **The villain's action** (§6) — theft, if they're in a lit bedroom that isn't theirs.
4. **Marking** (§6) — *only if no theft happened*, and only in a dark room.
5. **Bell watches** announce their targets' rooms.
6. **Sightings** resolve, against post-theft lighting.
7. **Oddities** fire (§8).

### Morning

**[RULE]** Every child who isn't silenced says where they slept, and their sighting is
published (§4). Items are spent (§5). Calls are proposed for the *following* night (§7).

---

## 4. What you can see — the information layer

**[RULE]** At the end of each phase, each player learns about the room they are in:
- **How many others** are in the room — **always accurate**, lit or dark.
- **Their names** — only if the room is lit.

**[RULE]** Two exceptions read names in the dark: **the villain always**, and **Wren always**
(when the oddities layer is on). This is described in the code as "the game's only asymmetry."

### The morning report — the most under-appreciated rule in the game

**[RULE]** Every innocent child who isn't Hushed has their **full sighting published verbatim
and truthfully** as a public event: the room they were in, how many others were there, and
their names if it was lit. This is automatic and not a choice — children cannot lie and have no
budget for what they report.

**[RULE]** The villain is exempt. Their published report carries **the room they claimed**,
never the room they were in, and names nobody.

**[MEASURED]** This means the rules already publish a payoff for exploring — but the bots'
suspicion model **ignores published sightings entirely** (see §11). The channel is built and
unconsumed.

---

## 5. Items

**[RULE]** Three kinds, 5 in the pool total: 2 Lantern, 2 Keyhole, 1 Bell.

**[RULE]** 3 loose on the map at a time. They spawn **in common rooms only** — the code's stated
intent is "fetching one means crossing the house." Carry capacity is **1**, except Moss who
carries **2**. Picking one up is announced publicly. If several people want the same item, one
gets it at random. Spent items return to the pool after 2 nights.

**[RULE]** Items are spent in the **morning** and shape the night that follows:

| Item | Effect |
|---|---|
| **Lantern** | Relights one bedroom **for one night only**. Does not permanently restore it, and does not undo it for win-condition purposes. |
| **Keyhole** | Publicly reveals everyone who was in a chosen room on a chosen **past** night. |
| **Bell** | Publicly watches one child; their midnight room is announced. **The target is told they're being watched** the same morning. |

**[RULE]** An item is also a "hand" — holding one is what lets you join a Call (§7).

**[MEASURED]** Items are close to a dead end in practice. Only 3 on the map, capacity 1, and a
Hushed player can be **mechanically denied the chance to spend one at all** — a human player hit
exactly this, picking up a Lantern and then being robbed and silenced before the spend prompt
ever appeared.

---

## 6. The villain's two verbs

### Theft

**[RULE]** If the villain **ends midnight** in another child's **lit** bedroom, the light goes
out. It is **automatic** — not a choice, and not announced as a decision. They commit by
walking in.

**[RULE]** The victim is **Hushed** (§9).

**[RULE] The Grip:** if the victim was **home in their own bed** when robbed, they snatch an
item off the villain — or, if the villain carries nothing, one from the pool. **Only if home.
Never otherwise.** This is deliberately invisible: a theft where the victim was out produces no
Grip, so the absence tells nobody anything.

**[RULE] Self-snuff:** the villain may snuff their **own** light. This is the one case that's a
declared choice rather than automatic. Publicly it is **identical to a theft** — same event,
same trail, their own name as victim. It produces no Grip. Under the default config it costs
them a night; a config flag can make it free, which buys them a spare night on the clock.

### The trail — the children's main information channel

**[RULE]** Every theft publicly names **one random person who ended midnight within 1 door of
the robbed bedroom.** The villain is in that room, at distance 0, so **the villain is always in
the pool.** The pool is never empty.

**[MEASURED]** ~53% accurate at pointing to the villain, against 17% for a random guess.

**[RULE — derived, not yet measured] The trail's accuracy is coupled to map density, in a
dangerous direction.** Its accuracy comes entirely from *bystanders diluting the villain* in
the pool. On a bigger or sparser map, fewer bystanders are within 1 door, so the pool collapses
toward just the villain and accuracy climbs toward 100%. Rough sizing: 12 rooms / 6 players /
radius 1 gives a pool of about 2 (≈50%, which matches the measured 53%); 24 rooms would give
about 1.5 (≈67%). **Any change to map size must say what happens to the trail.** These two
numbers are analytic estimates and have never been measured.

### Marking

**[RULE]** The villain's second verb. If they end midnight in a **dark** room with other people
in it, **and did not steal that night**, they secretly mark one of them.

**[RULE] Nobody is ever told.** A marked child discovers it only when they try to join a Call
and cannot. Marking is permanent and a child can only be marked once.

---

## 7. The Call

**[RULE]** The children's only offensive verb. It is a trap: name a child and a room, and
everyone converges there next midnight.

**[RULE]** Proposed in the **morning**, resolves the **following midnight**. Max **1 Call per
night** across the whole table.

**[RULE]** A Call may only target a room that is **a bedroom and still lit**. The set of legal
trap rooms therefore shrinks every night. The *target* is unrestricted — you can call on anyone.

**[RULE] Joining requires a hand:** you must be **in the call room**, **holding an item**, and
**not marked**. Marking is precisely what takes this away.

**[RULE]** Resolution needs 2 hands (default). Outcomes:

| Outcome | Condition | Effect |
|---|---|---|
| `fizzled` | Fewer than 2 hands present | **Nothing is spent.** Miscoordination is free. |
| `caught` | Enough hands, target came, **target is the villain** | Children win immediately |
| `cleared` | Enough hands, target came, target is innocent | Target is publicly cleared |
| `noShow` | Enough hands, target did not come | Suspicion, but nothing mechanical |

**[RULE]** Everyone who raised a hand **spends a random item from their hand**, on any outcome
except `fizzled`.

**[RULE] Self-nomination:** you can call on yourself — "set the trap on me, I'll come, I'll
clear myself." If you self-nominate and then **don't show up**, you're publicly flagged
(`eyesOpen`), which is a heavy suspicion penalty.

**[MEASURED]** The hands requirement is **decoration**. Requiring 2 hands and requiring an
impossible number produce identical outcomes — because hands gate the *catch*, and the catch
never happens. The Call's real function is free, unrationed **zone denial**: it forces the
villain to avoid a room.

**[MEASURED]** The `cleared` outcome has fired in real play at least once (a self-nomination
with no suspicion in play, honoured, cleared). So that pathway is not purely theoretical.

**[MEASURED — fixed 2026-07-28]** A bug made the Call non-functional for human players for
half a game: with only 1 Call slot and shared public suspicion, *every* bot proposed the same
Call, and the slot was awarded in fixed roster order, so the player at index 0 won every single
morning by construction. A human's Call vanished with **zero feedback**. Now drawn fairly at
random. **The underlying structural point remains unaddressed:** shared public suspicion means
every bot still converges on the same target, so 5 of 6 proposals are discarded every morning
by design. That's a property of `maxCallsPerNight: 1`, not a bug — whether it's a *problem* is
an open design question.

---

## 8. Oddities — the per-character powers

**[RULE]** Each child has one. Three are **public** (announced every night, and are the child
*speaking*, so the Hush silences them) and three are **private**.

| Who | Oddity | Public? |
|---|---|---|
| **Bell** | "Never sleeps first" — announces **how many** people are in rooms *adjacent* to theirs. Counts, never names. | Public |
| **Pike** | "Counts stairs" — announces whether **anyone at all** crossed between floors tonight. One bit for the whole house. | Public |
| **Clem** | "Watches hands" — announces **how many** people in Clem's own room are holding items. | Public |
| **Wren** | Reads names in the dark. **But**: if Wren enters the attic, the house announces it — a tell others notice *about* Wren, which fires whether or not Wren is silenced. | Private power, public tell |
| **Sparrow** | "Listens at doors" — on any theft night, announces the **floor** the thief was on at dusk. | Public event, private origin |
| **Moss** | Carries **2** items instead of 1. | Private |

**[RULE]** Sparrow's oddity as literally written in v10.0 reported the *robbed room's own*
floor — which is zero information, since everyone already knows which room was robbed. The code
carries a patched version (reporting the thief's **dusk** floor) and a config flag to switch
between them. The patched one is the default.

---

## 9. The Hush

**[RULE]** A robbed child is silenced. Under the default (`silent`) mode, **permanently** — for
the rest of the game.

**[RULE] The Hush takes away more than their claim.** A Hushed child:
- cannot say where they slept,
- **has their entire sighting deleted from the public record** — the report never happens,
- and cannot use a public oddity (Bell, Pike, Clem stop speaking).

**[RULE]** Alternate modes exist in config: `oneNight` (silenced only the night of the theft)
and `none`.

**[MEASURED]** The Hush **empties the claim record exactly as the endgame bites** — mean claims
on record fall from 6.00 to 2.88 by night 7 under `silent`, versus 5.79 under `oneNight`.

**Design note:** the person most likely to have witnessed something — the one who was just
robbed — is precisely the one whose testimony is destroyed.

---

## 10. Current balance

**[MEASURED]** Against a villain that plans an optimal route, the shipped game was once **100%
villain wins, 2,000 of 2,000**. The cause turned out to be **bot policy, not rules** — the rules
already permitted correct play, but the children's bots (a) aimed the Call at the suspect's own
bedroom, the one room a guilty villain never needs to visit, so being *right* made the
accusation worthless, and (b) refused to post a Call without holding an item, which was never
required.

**[MEASURED]** After fixing both: villain 100% → **24.6%** against a route-planner, and 9.4% →
**2.1%** against the standard bot. **The game is now tilted toward the children at every skill
level.** That's a tuning question for lights-required and nights-on-the-clock, not a rules one.

**[MEASURED]** Two human playthroughs, both survived as children: 2/5 lights in one, and a much
closer 4/5 in the other — one theft short of a villain win.

**[MEASURED]** The villain's dominant line is **to tell the truth on every night they did
nothing.** Lying buys nothing when no theft happened, and a truthful claim cannot be
contradicted.

---

## 11. Known open problems

1. **Children turtle.** They sit in their own bedroom nearly every night, so the map is close
   to cosmetic for five of six players. Two causes of different severity:
   - **[RULE — a real asymmetry]** The Grip only pays if you're home, so leaving has pure
     downside.
   - **[MEASURED — a policy gap, not a rules gap]** The suspicion model reads exactly three
     event types: trail namings, `eyesOpen`, and a Call that cleared someone. It **ignores
     published sightings entirely**, even though the rules publish them truthfully every
     morning. Exploration's payoff exists and nothing consumes it.

2. **The sighting channel decays from both ends.** Names appear only in **lit** rooms, so payoff
   thins as the house darkens — fastest exactly when children most need information. And the
   Hush deletes the likeliest witness's testimony outright.

3. **One Call slot against shared suspicion** means 5 of 6 proposals are discarded every
   morning by design (§7).

4. **`caught` never fires** (§1), so one of the two advertised child win routes doesn't exist.

5. **Items don't pay** (§5).

---

## 12. [UNKNOWN] — referenced but never written down

These are named in the design's summary but have **never existed** in the repo or in any
document available to the project. There is nothing to recover and no spec to conform to.

- **The morning discussion board (§9 of the original rules).** The structured format children
  were supposed to use to discuss. The current game has only "say where you slept" plus the
  automatic sighting report.
- **The six-symbol language.** A constrained vocabulary children were meant to communicate in.
  Completely unimplemented.

Anything designed in these two areas is a new invention, not a restoration.

---

## 13. Config values (defaults)

| Setting | Value |
|---|---|
| Lights required | 5 |
| Total nights | 7 (deliberately lights + 2) |
| Hush mode | `silent` (permanent) |
| Self-snuff costs a night | yes |
| Trail radius | 1 door |
| Item counts | 2 Lantern, 2 Keyhole, 1 Bell |
| Items on map | 3 |
| Item respawn delay | 2 nights |
| Carry capacity | 1 (Moss: 2) |
| Call hands required | 2 |
| Max Calls per night | 1 |
