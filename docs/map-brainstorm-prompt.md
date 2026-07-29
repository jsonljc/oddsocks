# Prompt for Claude mobile — ODD SOCKS map/exploration brainstorm

I'm designing a social deduction game called ODD SOCKS and I want to brainstorm one specific
problem with you. You have no access to my code, so everything you need is below. Ask me one
question at a time; don't write a spec until we've actually converged.

## The game

Six kids at a haunted sleepover. One is secretly the villain ("Odd Socks"). Each kid has their
own bedroom with a light on. The villain wins by snuffing all 5 non-villain bedrooms' lights.
The children win by surviving the clock.

- **6 players, 12 rooms**: 6 bedrooms (one per player) + 6 common rooms, over two floors,
  14 doors between them. Map diameter is 4 — the two furthest rooms are 4 doors apart.
- **7 nights.** Villain needs 5 lights. Their own bedroom doesn't count, so it's 5 of exactly 5.
  Shortest possible route is 6 nights, so they get exactly one spare night.
- **Each night is two phases with a commit point between them**: at **dusk** you move exactly
  2 rooms, then everyone sees who's in their room; at **midnight** you move exactly 2 more
  rooms, and that's where theft resolves. So it's 2 + 2 hops, not one 4-hop move — you commit
  to the first half before you learn anything.
- **Sightings**: you always learn how *many* others are in your room. You learn their *names*
  only if the room is lit. (The villain always reads names in the dark; so does Wren.)
- **Theft**: if the villain ends midnight in another kid's lit bedroom, the light goes out
  automatically. The victim is then "Hushed" — silenced in the next morning's discussion.
- **The Grip**: if the victim was *home in their own bed* when robbed, they snatch an item off
  the villain. Only if home. Never otherwise.
- **The trail**: every theft publicly names one random person who ended midnight within 1 door
  of the robbed bedroom. This is the children's main information channel. It's ~53% accurate
  at pointing to the villain, against 17% for a random guess.
- **Items**: 3 loose items on the map at a time, spawning in common rooms only. Carry capacity
  1 (one character carries 2). Three kinds — Lantern (relight a room), Keyhole (reveal who was
  in a room on a past night), Bell (publicly watch one kid, announce their midnight room).
  Spent items come back after 2 nights.
- **The Call**: children can publicly nominate a room to converge on. Max 1 per night.

## The actual problem

Children turtle. They sit in their own bedroom nearly every night. The map is close to
cosmetic for five of six players. I want a sense of *exploration* — going out into the house to
collect things — and my instinct was "make the map bigger."

**But I've already diagnosed why they turtle, and it isn't map size.** Two separate problems,
and they are *not* the same severity — one is a rules asymmetry, one is a gap in the AI:

1. **(Rules problem.) The Grip only pays out if you're home when robbed.** So being caught away
   from your bed is pure downside. Home is never the worse bet. This one needs a real design
   decision.
2. **(AI problem.) Exploration already has a designed payoff — nothing consumes it.** Every
   night, each child who isn't silenced has their sighting published verbatim and truthfully:
   the room they were in, how many others were there, and their *names* if the room was lit. So
   going out and seeing someone somewhere strange **is** public evidence, by the rules as
   written. But my bots' suspicion model reads exactly three things — trail namings, a broken
   self-nomination promise, and a Call that cleared someone. It ignores published sightings
   entirely. The evidence lands on the table and nobody picks it up. This is probably closer to
   "wire up the thing that already exists and re-measure" than to a redesign — so don't invent
   a new mechanic to solve it.

Net effect: with no Call active, every child reports "slept in my own room, saw nobody" every
single night. Enlarging the map raises the cost of travel without adding any reason to travel —
on its own it makes turtling *more* attractive, not less.

**Two things that make the sighting channel decay, which matters for any map change:**
- Sightings only name people in **lit** rooms. As bedrooms go dark over the game, the
  exploration payoff thins — and it thins fastest exactly when the children most need
  information.
- The Hush deletes a robbed child's sighting from the record entirely, not just their claim.
  So the person most likely to have seen something is the one whose testimony is destroyed.

A bigger map plus a darkening house means this channel thins from both directions at once.

So I don't want to start from "how big should the map be." I want to start from the two coupled
questions underneath it:

- **What is out there that's worth leaving your bed for?**
- **What does leaving actually cost you?**

Map size and shape are downstream of both.

## Hard constraint that any size increase has to survive

The trail names one random person within 1 door of the robbed bedroom — and the villain is
always in that room, so they're always in the pool. Its ~53% accuracy comes entirely from other
kids being nearby to dilute it. **On a bigger, sparser map, fewer bystanders are in range, so
the pool collapses toward just the villain and the trail gets sharper — climbing toward naming
the villain every time.**

That matters because the game is *already* tilted toward the children (the villain wins between
2% and 25% depending on how well they play). So "bigger map" is a hidden buff to the side
that's already winning. Any proposal to grow the map has to say what happens to the trail:
scale the radius, change what the trail reports, or replace it.

## Things already measured as dead — don't build on these

- **The villain is never caught.** In every configuration tested, the "catch the villain"
  win condition fires literally zero times. Children have one real win route: survive.
- **The Call's hands requirement is decoration.** Requiring 2 hands versus requiring an
  impossible number gives identical outcomes. Hands gate the catch, and the catch never
  happens — so the Call's real function is free, unrationed zone denial.
- **Items are close to a dead end already.** 3 on the map, capacity 1, commons-only, and a
  Hushed player can be mechanically denied the chance to spend one at all. So "more items,
  further away" is building on a mechanic that doesn't currently pay. If items are going to
  carry the exploration motive, they need a reason to be worth the trip first.
- **The villain's best line is to tell the truth on every night they did nothing.** Lying buys
  nothing when no theft happened.

## How I want you to work with me

- One question at a time. Prefer multiple choice where it fits.
- Push back on me. If I reach for a mechanic that the notes above already show is dead,
  say so.
- Be ruthless about scope — cut anything that isn't load-bearing.
- **If you propose a number ("this would happen ~30% of the time"), flag it as a guess.**
  This project has been burned four separate times by aggregate statistics that turned out to
  be measuring nothing — usually an artifact concentrated in one night that the average hid.
  I can only trust numbers I go back and measure, so mark clearly which claims need testing.

Start by asking me what I actually want the *feeling* of exploration to do for the game —
whether it's about tension, information, or something else — before we touch the map.
