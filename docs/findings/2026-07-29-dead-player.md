# The dead player — measured

Probe: `docs/findings/probes/deadtime.ts`. 2,000 games per cell, `searcher` children, default
wax (25/19/13). Run it before quoting any number here.

## 1. Rescue does not exist

The v6 spec §8 gives Rescue as the answer to early elimination — *carry a burning lantern into
the room where a child was taken and they walk out with you.* It is **not implemented**:

```
grep -ri "rescue" src/v6/     ->  no matches
```

So the mitigation the design leans on is unbuilt, and every number below is what a player
actually experiences today. This is the same shape as the predecessor's `caught = 0`: a
designed escape hatch that never fires because nothing fires it.

## 2. The size of the problem

| | light villain | hunter | random |
|---|---|---|---|
| mean game length | 6.55 nights | 8.12 | 7.95 |
| children taken per game (of 5) | 1.93 | 1.86 | 1.87 |
| **share of children eliminated** | **38.6%** | 37.2% | 37.4% |
| **games with a take by night 2** | **33.1%** | **55.9%** | **54.9%** |
| mean nights spent dead | 3.17 | 4.28 | 4.50 |
| **dead nights as share of the game** | **48%** | **53%** | **57%** |
| worst seen | 7 | 16 | 16 |
| **share of all child-nights spent dead** | **18.6%** | 19.6% | **21.1%** |

Read the last row as: **about one in five of all the nights a child spends at this table, they
are silent, powerless, and cannot win.** There is no survival win in v6, so a taken player is not
even playing for a personal outcome — they are watching.

And roughly **two of every five players** get eliminated in a given game, losing on average
**about half the session** when they do.

## 3. Night one is the worst night, and the metronome makes it worse

Takes concentrate hard on odd nights — the dead-end spokes phase-lock the cast, which is a known
and deliberate property (it is the evidence channel; see `2026-07-29-v5-structural.md` finding 3).
But it interacts badly with elimination. Against the `light` villain, takes land on nights
1, 3, 4, 5, 7, 8, 9 — and **never once on night 2 or night 6** across 2,000 games.

Night 1 alone is 17–30% of all takes depending on the villain, because everyone starts together on
landing 0 and scatters blind. A player can therefore be eliminated by their **first decision in
the game**, before any information exists to make that decision with.

## 4. What this means

The dead player is not a UX polish item, it is a structural retention problem, and it is the
biggest one v6 has:

- A third to a half of sessions produce a player who is out within two nights.
- That player then spends ~half the session unable to act.
- They have no survival win to root for, and the dark is faceless, so they do not even know who
  took them.

Two directions, and they are not equivalent:

1. **Wrap it** — give the dead something to do (the Blood on the Clocktower model: dead players
   keep their information and retain one final vote). Cheap, well-precedented, does not touch the
   take rules.
2. **Reduce it** — build Rescue so it actually fires, or make night 1 safe. Note night 1 being the
   biggest take night is a *starting-position* artefact (everyone begins on landing 0), so it is
   fixable by changing the setup rather than the take rule.

Doing (1) is not a reason to skip (2). A spectator mode makes elimination survivable; it does not
make being eliminated by your first blind guess feel fair.
