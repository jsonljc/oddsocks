# ODD SOCKS v6 — THE TRAIL

Supersedes the v5 paper design. Supersedes nothing in `src/` — the shipped game (rules doc
"v10.0", reconstructed in `docs/rules-reference.md`) is a different game and stays frozen as a
reference implementation.

Evidence base: `docs/findings/2026-07-29-v5-structural.md`. Read it before arguing with anything
here; two of its three findings are proofs and they are why this document exists.

---

## 1. Why v5 does not work

Three findings, compressed. The first two are arithmetic and cannot be tuned away.

1. **v5 has no terminal state.** Two blocks of three give a take rate of exactly zero. No takes
   means the anti-stall rule relights every night, so the house never goes fully dark; and no
   socks are ever dropped, so the children never assemble their only route. Neither side can win.
2. **"Crowds burn the house down" is false.** Wax per night is (lit rooms) + (people on lit
   rooms), invariant to how they distribute; and a dead candle stops charging its occupants, so
   huddling *buys* a night of light.
3. **The take responds to information** — about 8 points, cutting the game from ~20 nights to
   ~14. v5's core verb is sound. The frame around it is not.

Underneath all three sits one defect: **the children's only win route is gated on the villain
choosing to act.** Socks come only from takes. Evidence is downstream of the villain's decisions
— that is what evidence is — so an objective made of evidence can always be starved.

**v6 fixes that at the root: Odd Socks sheds a sock every night, wherever they sleep, whether
they hunt or not.** Everything else follows.

---

## 2. The six lines

1. Move one room a night. Everyone moves at once, in secret.
2. Odd Socks can take you when the two of you are the only ones in a room. One is safe. Three is safe.
3. Odd Socks sheds a sock every night, wherever they sleep. They cannot help it.
4. The landings are lit and burn wax while you stand under them. The spokes are dark, and free,
   and hold two.
5. You cannot see what lies on a dark floor. Bring a light, and the room will say your name.
6. Two socks in one pair of hands buys a Naming. Odd Socks wins when the last candle dies.

---

## 3. The house

**[CALL]** Twenty rooms, three floors, hub-and-spoke, diameter 4 — the same house v5 describes,
now stated room by room.

- **Three landings** — `landing_0`, `landing_1`, `landing_2`, one per floor, chained
  `0–1–2`. These are the spine, they carry the only candles, and they hold any number of people.
- **Seventeen spokes** — 6 off landing 0, 5 off landing 1, 6 off landing 2. Each has exactly one
  door, back to its landing. Permanently unlit. **A spoke holds two people. No more.**
- Diameter check: `spoke@0 → landing_0 → landing_1 → landing_2 → spoke@2` = 4.
- Everyone starts together on `landing_0`, the Sitting Room. Night one is a scramble.

Two consequences the design leans on, both from the topology rather than a rule:

- **A player in a spoke has exactly one legal move** — back to their landing.
- **Nobody can hide in the dark two nights running.** Everyone is forced under a candle every
  other night.

**Scaling** — 14 rooms/4 players, 20/6, 26/8, 32/10, holding diameter 4 and spoke capacity 2 in
every size. One villain at every count.

### Spoke capacity is load-bearing

It is the single rule that kills the committee. Three or more players is unconditionally
take-proof, and in v5 a trio could do every job in the game at zero risk. Capacity two means
**a trio cannot enter a spoke at all.** Trios exist only on lit landings, where they burn the
clock and can reach nothing. Every search in this game is therefore a solo act or a two-person
gamble — and two alone in a room is exactly the take condition.

**[CALL]** When more players blind-commit to a spoke than it holds, **none of the arrivals
enter**: they all stay on the landing, and the house says the spoke was crowded without saying by
whom. This leaks that several people wanted the same room, which is information the children can
use and the villain can bait. Preferred over admitting the first two by any tiebreak, which would
make a random number generator decide who dies.

A spoke empties every night — its only exit is its landing and movement is mandatory — so
capacity is a question about arrivals, with one exception: **Wren, staying put, holds her place
first**, and only one other may join her.

---

## 4. The night

One room per player, simultaneous, committed blind, no phases. Movement is mandatory — only Wren
may stay. Players talk freely in the morning; nothing binds what they say except the characters
that bind it.

**[MEASURED, v5]** Permitting the villain to stand still is free: an oracle villain offered the
option took it on 0.0% of nights, because a neighbouring landing harvests the same forced returns
from its spokes. The mandatory-movement rule is kept for texture, not balance.

---

## 5. Light, the dark, and the record

- **A landing is lit while its candle has wax.** A lit room publishes, every morning, the name of
  everyone who ended the night in it.
- **A candle loses one night of wax, plus one more for every person who ended the night under
  it.** Monotone. Nothing relights a candle except Sasha, once.
- **A spoke is dark and always free.** A dark room publishes nothing about who ended the night in
  it — not even how many. The one exception is a spoke that turned people away for being over
  capacity, which the house names (§3): that is a report about a failed entry, not about its
  occupants.
- **In the dark you can count the others breathing. You cannot name them.** This gives
  "three is safe" a mechanism a player can actually perceive, makes a dark take unattributable,
  and turns every dark room into a morning claim contest.
- **A lantern set down burns and lights its room; carried, it lights nothing.** A lit spoke
  publishes its roster exactly as a landing does.

### Why this makes the huddle lose, without a rule that says so

The children are five of six bodies, so they carry most of the burn. Hiding in the dark spokes
costs the house nothing and the candles last; huddling under them burns them down and hands Odd
Socks the win. The safe formation is the losing formation, derived from the wax arithmetic rather
than bolted on. **[MEASURED]** It holds: a table that never splits loses 100% of games in every
cell, and is never once taken while doing it.

**[MEASURED — one claim here is weaker than it was written.]** "The children set the clock" is
only half true. Spokes are dead ends, so everyone is forced under a candle every other night
whatever they intend, and the burn floor is roughly fixed. Sheltering versus scattering moves the
house from ~10.6 nights to ~7.9, which is real but is a dial, not a lever. The huddle loses
because it produces nothing, not because it burns notably faster.

The villain's mirror of the same trade: the dark hides where their sock falls, but the light is
where their name is written down beside it.

---

## 6. Socks and the trail

- **Odd Socks sheds a sock every night, in whatever room they sleep in.** Not on takes — on
  nights. The house never says whose it is.

**[MEASURED — this rule was changed by the engine.]** It first read *"in every dark room they end
a night in,"* which let the villain opt out of producing evidence altogether: a villain who never
left the lit landings shed **zero** socks and won **100%** of games, with the children at 0% in
every cell, because their only route needs socks. Shedding everywhere closes it, and the light
carries the load instead — **a sock on a lit floor arrives beside that room's published roster,
so it names a suspect set rather than just a room.** Staying in the light is now the villain's
*best* line rather than a free one: children win 41.5% against it, against 61–67% for the others.
- **You cannot see what lies on a dark floor.** You take up what is on the floor of the room you
  end the night in only if that room is **lit at night's end** and you have a hand free. Searching
  is therefore advertising: the lantern lights the room, and the room says your name.
- **Socks come in pairs.** One sock, or one pair, fills your hands. Anyone may lift a sock, Odd
  Socks included, whoever else is standing there.
- **A taken child drops everything where they were taken.**

The trade this produces is the whole image the design was reaching for. To read a spoke's floor
you must set your lantern down — which lights the room, which frees your hand, which is what lets
you lift the sock. Then you walk home in the dark, alone, carrying the only proof anyone has, and
the lantern stays behind burning in an empty room where the villain can come and collect it.

**[CALL]** Lighting is settled for the night *before* the shed resolves (§11 steps 7 and 10).
Otherwise a child who set a lantern down in the villain's room would light it after the shed,
finding a fresh sock and a manifest naming everyone present — a guaranteed catch, on one guess.
Settling light first means the villain simply doesn't shed in a room someone has lit; the child
gets the manifest, not the confession.

### The trail is monotone

The villain can move their trail. They can never shorten it. Retrieving a sock costs a night in
that dark room — which sheds a fresh sock in the same room. Carrying it out means sleeping in
another dark room, which sheds there. And a sock cannot be set down in the light unseen.

Geometry sharpens it: a spoke has one door, so a sock in a spoke off landing L pins the villain
to L on the night before and the night after. **One spoke sock buys two published manifests.**

---

## 7. The Corner

The predecessor's equivalent win condition fired **zero times in every configuration ever
tested**, because it asked the accusers to chase a villain across a map under blind simultaneous
movement — a lottery the villain never had to enter. v6 inverts it: the villain surrenders
movement secrecy for exactly one night.

> **A pair of socks in one pair of hands buys one Naming. Say the name in the morning; the socks
> are spent.**
> **The Named walks in the open that night: they write their move and show it before anyone else
> writes theirs.**
> **Two or more in their room at dawn and they are cornered — the children win. One is not
> enough. One is supper.**
> **Name the wrong child and they turn out their pockets: the Corner fails, and that child is
> cleared for good.**
> **A failed Corner puts out every burning lantern where it stands.**

**[CALL]** The socks are **spent, not scattered.** Scattering them back through the rooms they
were carried through is bookkeeping, and it softens a decision that should be a commitment.

**[CALL]** One night of open movement, not three. Three is a slow execution. One keeps a real
escape: the children must still commit blind *against each other* after seeing the destination,
so a hunter promised backup who doesn't get it is alone with Odd Socks. "One is supper" is the
villain's out and it is the tension of the night.

**[CALL]** The penalty is lanterns, not wax. Burning wax faster is not a punishment when the
villain wants the clock to run out; extinguishing the children's light cannot backfire.

---

## 8. Winning

| Outcome | Winner | Trigger |
|---|---|---|
| `cornered` | Children | A Naming resolves with two or more children in the Named's room, and the Named is the villain |
| `taken` | Odd Socks | The take target is reached |
| `dark` | Odd Socks | The last candle dies |

Checked in that order at the end of each night.

**Take target = children − 1.** Five children, so **four** at six players. This is not arbitrary:
a Corner needs two children in a room, so at one surviving child capture is already impossible —
"Odd Socks wins at four taken" and "capture has become impossible" are the same fact. Scales to
3 at four players, 4 at eight, 5 at ten.

**Rescue** — carry a burning lantern into the room where a child was taken and they walk out with
you. They speak again from the next morning, stop counting toward the target, and **know nothing
they did not already know**: they never saw who took them. The rescuer must first work out which
room, since a dark take publishes no room, and cannot also carry the sock lying there.

**There is no survival win.** Children who merely last the night lose when the candles do. This
is deliberate and it is the trap v6 exists to avoid: in the shipped game the children's winning
line and their safest line were identical — stay in your own bedroom — and the result was total
turtling with the map cosmetic for five of six players.

---

## 9. The morning

The criterion is **the house publishes only what must be trusted.** Everything else is table
state or a claim.

> **The house speaks first, and the house does not lie. It says:** every lit room and who stood
> in it; the wax left on each candle; who was taken; any lantern newly burning, and where; any
> spoke that was crowded; and the binding words — Nel's two rooms, Cleo's floor, Bram's wedged
> door.
> **Of a dark room the house says nothing at all, except that a spoke turned people away.**
> **Nothing the house says names Odd Socks.**
> **Then the children talk.** No one has to speak, everyone may lie, and what a character learned
> in the night is theirs alone to tell or keep.
> **A taken child never speaks again.** The house says their name and nothing more.

**[CALL]** The house names the victim but never the room. Wholly silent takes let a player fake
being taken by going quiet, while the table still watches them submit moves. Naming the victim
and withholding the room keeps the only ambiguity that matters — *where* — which hides both the
sock and the villain's position.

---

## 10. The ten

Six of ten are dealt. **Each player is told their own character and nothing else** — nobody knows
which six are in play, which is what gives every claim its bluff space. Every trait must leak
identically in the villain's hands, or an unused trait convicts its owner.

| | | |
|---|---|---|
| **NEL** | *rewrite* | Speaks first every morning and must speak, naming the room she is in and the room she came from. She may lie, but the house will not let her say something impossible — her walk must be legal and her "came from" must match yesterday's "in". |
| **ROOK** | *keep* | Moves two rooms and never fewer, and may not end where she began. Only player whose exit from a dead end isn't forced, so the fastest searcher and the only anti-Corner tech. The house names only where you end, so her midpoint is unseen. |
| **OTTO** | *keep* | Carries two things, visibly, updated each morning. The only player who can hold a lantern **and** a pair of socks — the only one who can gather evidence without setting the light down. |
| **WREN** | *rewrite* | May stay put. If she does, the house says she stayed and where; **Wren alone** is told the names of everyone else who ended the night there. The only way names ever come out of the dark. |
| **MAB** | *rewrite* | In a lit room she is not named, not counted, and burns no wax — nobody there knows she is present. In a dark room, those with her know her by name. |
| **PIM** | *rewrite* | Feels the pull of the nearest lantern that is **not** burning — up, down, or this floor. If none pulls, every lantern is down and lit. Ties resolve to his own floor, then upward. |
| **CLEO** | *keep* | Declares each morning which floor she will **end** the night on, and is bound to it. Must be a floor she can legally reach. |
| **BRAM** | *rewrite* | **Twice a game**, wedges a door of the room he stands in, declared in the morning and named. That night nobody passes it in either direction, and anyone whose move would have used it stays put. |
| **SASHA** | *keep* | Once a game, relights a dead candle with **three** nights of wax. The house says the candle is lit again and does not say whose hand did it. |
| **FEN** | *rewrite* | Each morning, told how many people spent the night in the room she **left**. The trap-setter: leave a lantern, learn if anyone came for it. |

Notes on the four that moved most. **Pim** is a cut in all but name — his original trait dowsed
for a currency that is no longer scarce, and sat dead for the first several nights; repointed, he
is the direct counter to a villain hoarding lanterns. **Bram's** original could seal a dead end's
only door, which both trapped its occupants against mandatory movement and converted a
probabilistic take into a certain one; as a public, twice-a-game map edit he becomes the best
strategic tool in the game for either side. **Fen** was made redundant by the faceless dark and
is repointed at the room behind her. **Mab's** public leak is deleted outright: with 17 of 20
rooms dark she published her room nearly every night, which made her the free first victim of
every game; witnesses replace the house, and "not counted" matters as much as "not named" because
occupancy is the safety test.

---

## 11. Resolution order

Implementable, and the order is load-bearing.

1. Morning talk. Declarations bind: Bram's wedge, Cleo's floor, Nel's report, any Naming.
2. If a Naming stands, the Named writes and reveals their move.
3. Everyone else commits in secret. Reveal.
4. Apply wedges. Anyone with no legal move stays put.
5. Apply spoke capacity: any spoke over capacity admits nobody; those movers stay on their landing.
6. Set-downs.
7. **Lighting settles.** Lanterns on the floor burn; Sasha's relight applies here. Every room is
   now lit or dark for the rest of the night, and nothing later changes it.
8. The take, if exactly two are in a room and one is Odd Socks. Taking is optional.
9. The victim's carried goods fall where they were taken.
10. Odd Socks sheds, if the room they ended in is dark.
11. Take-ups: each player with a free hand lifts what is on the floor of their room, if that room
    is lit. **A contested take-up moves nothing.**
12. Wax burns.
13. Win check, in order: **Corner → take target → darkness.**

Steps 7 and 10 must stay in that order (§6). Step 7 must precede step 13 or Sasha's relight
cannot save a house that darkens the same night, and her trait is dead.

---

## 12. Numbers, and what is not yet known

Every number here is **provisional and a config knob.** None has been measured — v6 has never
been played or simulated.

| Knob | Provisional | Note |
|---|---|---|
| Candle wax | 25 / 19 / 13, ground to attic | **Tuned.** Staggered so the house darkens top-down. This is the knob that sets both length and balance |
| Lanterns | 3, one on each landing, shut | Public and symmetric at setup |
| Take target | children − 1 (4 at six players) | Derived, not tuned |
| Spoke capacity | 2 | Structural. Changing it re-opens the committee |

### The assumption the design rested on — falsified, then fixed

**That the villain's light-side line does not dominate.** As first specified it dominated
completely: **100% wins, zero socks shed, children 0% in every cell.** The argument in its favour
— that such a villain gives up half their win conditions — was simply wrong, because children
scattering into the spokes leaves landings holding exactly two, so a villain who never enters a
spoke still takes people. The fix is §6's unconditional shed. Recorded because the argument
sounded good and this project has now been wrong in exactly this shape five times.

### Measured, 400 games a cell, six players, wax 25/19/13

| children | villain | children win | villain by takes | by dark | nights | naming accuracy |
|---|---|---|---|---|---|---|
| huddle | light | **0%** | 0% | 100% | 10.6 | — |
| huddle | hunter | **0%** | 0% | 100% | 13.0 | — |
| huddle | random | **0%** | 0% | 100% | 12.6 | — |
| searcher | light | 41.5% | 40.5% | 18.0% | 6.6 | 53.5% |
| searcher | hunter | 67.3% | 15.5% | 17.3% | 7.9 | 52.5% |
| searcher | random | 60.8% | 17.5% | 21.8% | 7.8 | 55.4% |

Every children's win is by Corner; there is no other route. Wax was tuned against game length:
17/13/9 gave 6.1 nights and 30/45/46, and more wax monotonically favours the children because
every extra night is another night to work the trail.

All three routes are live, the Corner fires 30–45% (against the predecessor's **zero**, in every
configuration ever tested), naming beats the ~20% chance rate, and **the huddle loses 100% of the
time in every cell while never once being taken** — which is the whole point of moving the
objective off the socks. These are assertions in `src/v6/bots/policies.test.ts`, not notes.

### The metronome, and why it stays

Spokes are dead ends, so anyone who steps into one is forced back out the next night. That
phase-locks the whole cast: **600 takes on odd nights against 27 on even ones**, with spoke
occupancy oscillating 71.7% → 22.8% → 71.7%. Half the nights cannot produce a take and everybody
knows which half.

The obvious repair — join the spokes along each floor, so nobody is ever forced anywhere —
**destroys the game**: children 0%, zero socks lifted, zero Namings, because Odd Socks can then
stay in the dark all game and never appear on a lit roster to be counted beside their own sock.
**The forced return is the evidence channel.** The metronome is the price, it is paid knowingly,
and there is a regression test so nobody repairs it later.

### Still unmeasured

1. **The characters.** None of the ten is implemented. Every number above is the bare game.
2. **How much of the villain's 41.5% is the bot's crudeness.** `hunterBot` picks spokes at
   random; a villain who used the rosters would do better, and the children's 67.3% against it is
   the softest number in the table.
3. **Does spoke capacity 2 produce solo searching**, or do children pair up and accept the 1-in-5
   that their partner is Odd Socks? The bots search solo by construction, so this is untested.
4. **The faceless dark contributes exactly nothing to the numbers above.** `suspicion()` reads
   lit rosters and socks on lit floors; it never touches the count-in-the-dark channel, so the
   mechanic §5 calls load-bearing — and that Mab, Wren and Fen are built around — is untested,
   not merely unproven at a table.
5. **Night one is the biggest single night for takes** (53.3% of games), because everyone starts
   together and scatters blind. Whether it should be safe, as the predecessor's was, is open.

---

## 13. How this lands in the repo

The shipped engine is hard-coded to the other game: `src/rules/types.ts` fixes
`kind: 'bedroom' | 'common'` and `floor: 0 | 1`, `Path` is exactly two rooms, and `config.ts` is
v10 vocabulary end to end. There is no seam, and building a two-ruleset abstraction for two games
where neither is settled is speculative generality.

**New tree under `src/v6/`, shipped game untouched and still green at 206 tests.**

```
src/v6/rules/     types, house (generator + map utils), config, state,
                  night (resolution order §11), game (loop + win checks)
src/v6/bots/      child and villain policies, including the degenerate ones
                  that must LOSE: all-trio, all-landing, touch-nothing
src/v6/analysis/  sweep + metrics aimed at §12's five questions
src/v6/cli/       one human seat, bots on the rest
```

Reused as-is: `src/rules/rng.ts` (mulberry32, seeded, already tested). Nothing else.

**The degenerate policies are tests, not bots.** v5's fatal defects were found by playing the
safe line, not the interesting one. `all-trio` and `light-side-villain` must be in the suite from
the first commit, each with an assertion that it loses.

---

## 14. Provenance

The spine is "The Trail". The Corner, the faceless dark, the morning criterion and the character
audit came from a parallel design pass; spoke capacity 2 came from an adversarial pass that
killed an earlier proposal of mine outright (making the *light* the children's objective — it
fails because a dropped lantern lights its room forever, so with carry capacity 1 the villain can
never assemble full darkness and the children win by touching nothing).

One rule was proposed and is **deliberately not adopted**: "a night with no take adds wax back."
It inverts the incentive — children would benefit from no takes, so they would huddle, and the
stalemate returns one level up. **Wax runs down monotonically.** The anti-passivity pressure it
was invented for is supplied by the win condition itself: a villain who does nothing still has to
beat a clock the children are shortening every time they take shelter.
