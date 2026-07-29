# v5 — three structural findings, before any engine work

Date: 2026-07-29. Subject: the "ODD SOCKS — Final Design (v5)" paper design, which came back
from a separate brainstorm with no access to this repo or its measurements. v5 is a different
game that shares a name with the shipped one: 20 rooms over three floors, no bedrooms, one
room of movement per night, candles, socks, lanterns, ten characters.

Tagging follows `docs/rules-reference.md`:

- **[PROOF]** — follows from the design text by arithmetic. No simulation involved, nothing to
  re-measure, cannot be tuned away.
- **[MEASURED]** — simulated. Every one of these is conditional on a **constructed map** (below)
  and on stated policies. v5 specifies no room list, so these are estimates about a model of
  v5, not facts about v5. Treat accordingly.

## The constructed map

v5 says only "20 rooms, three floors, hub-and-spoke, diameter 4". The most literal house
matching that: three landings `L0–L1–L2` chained one per floor, carrying the only three
candles; 17 dead-end spokes hung off them (6/5/6), permanently unlit. Diameter check:
`spoke@L0 → L0 → L1 → L2 → spoke@L2` = 4 hops exactly.

Two consequences of that topology that the design never states and that drive everything below:

- **A player in a spoke has exactly one legal move** — back to their landing. Movement is
  mandatory, so spoke-dwellers have no decision at all on alternate nights.
- **Everyone is forced onto a lit landing every other night.** Nobody can hide in the dark
  continuously.

Probes: `docs/findings/probes/v5_probe.py`, `v5_blocks.py`, `v5_wax.py` (Python 3, stdlib only).

---

## 1. [PROOF] The game has no terminal state

Six players is exactly two blocks of three. "Three or more is safe" is explicit, and nothing in
v5 forbids agreeing on a destination out loud in the morning. Two blocks of three moving
together give **take-legal nights of 0.00%** — not a low rate, a structural zero, permanently.

Everything follows from that:

- No takes means the anti-stall rule ("every night with no take, one dark room comes back")
  fires **every** night, so a three-candle house never reaches "fully dark". The villain cannot
  win.
- No takes means no socks are ever dropped. Socks are the children's only route. The children
  cannot win either.

**Neither side can reach a win condition, ever.** This is the same defect v5 retires under
*Fixed: the herd* and *Fixed: the villain who does nothing* — both fixes miss it, because
burning wax is not a loss condition for the children while recovery outpaces it.

The root cause is worth stating separately, because it survives any patch to the numbers: **the
children's only win route is gated on the villain choosing to act.** Socks come only from takes.
Evidence is downstream of the villain's decisions — that is what evidence is — so an objective
made of evidence can always be starved by a villain who does nothing.

## 2. [MEASURED] The take responds to information, and the game is long

Take-legal nights, and the night the fourth take lands, over a 40-night horizon (v5 sets no
clock at all, so 40 is arbitrary):

| Players / children's policy | Villain | Take-legal | 4th take | Villain wins |
|---|---|---|---|---|
| 20r/6p random | random | 17.1% | ~night 20 | 91% |
| 20r/6p random | given every exact position | 18.2% | ~night 20 | 96% |
| 20r/6p exploring (prefers spokes) | random | 18.0% | ~night 19 | 94% |
| 20r/6p exploring | given every exact position | **25.8%** | **~night 14** | 100% |
| 32r/10p exploring | given every exact position | 16.6% | ~night 21 | 93% |

Two readings:

- **Information is worth about 8 points** against children who actually explore, and cuts the
  game from ~20 nights to ~14. The take does respond to skill. This is the good news and it is
  the main argument for v5's core verb being sound.
- **The game is long.** 14–20 nights against a 7-night predecessor. Whatever clock v5 acquires
  has to be set against this.

A villain permitted to break the movement rule and stand still chose to camp on **0.0%** of
nights. Mandatory movement costs the villain nothing: they can always step to a neighbouring
landing and harvest the same forced returns from its spokes. The rule is free to keep or drop.

## 3. [PROOF] "Crowds burn the house down" is false

Wax burned in a night = (number of lit rooms) + (people standing on lit rooms). That total is
**invariant to how those people distribute themselves** among the lit rooms: six in one landing
and two in each of three landings burn identically. The mechanic cannot discriminate crowds from
dispersal, because it does not depend on the distribution at all.

Worse, a dead candle stops charging its occupants, so a crowd that burns its own room out gets a
free dark room to stand in. [MEASURED] at 12 wax per candle:

| Children play | House fully dark | Lit-room-nights |
|---|---|---|
| Spread across landings | night 6 | 18 |
| All six in one landing | night 7 | 16 |

**Huddling buys a night of light.** The occupancy burn is not a decision — it is a fixed tax on
existing, and the dead-end topology means nobody can dodge it anyway.

The design calls this fix the answer to the herd. It is the opposite: it mildly rewards the herd.

---

## What this means for the design

Three constraints fall out, and any spine for v5 has to satisfy all of them:

1. **The game must terminate**, which today it does not.
2. **Passivity must not win, for either side** — and today passivity is stable for both.
3. **The children's progress must not be gated on the villain choosing to act.**

And one trap to avoid, inherited from the shipped game: **no survival win of the v10 kind.**
There the children's winning line and their safest line were identical (stay in your own
bedroom), which produced total turtling and made the map cosmetic for five of six players. Any
"children win by surviving" has to require active, risky work, or it reproduces that failure
exactly under a new name.

## Standing caution

Every [MEASURED] row above is an aggregate over a constructed map. This project has been burned
four separate times by aggregates that turned out to be an artefact concentrated in a single
night. Before any of these numbers is used to justify a rules change, check the per-night
distribution behind it. The [PROOF] rows need no such check — they are arithmetic, and they are
the two findings that actually decide the design.
