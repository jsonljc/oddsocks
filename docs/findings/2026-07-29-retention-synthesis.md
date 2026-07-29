# What would make ODD SOCKS worth coming back to

Ten parallel research agents, ~250 ideas, sourced against the social-deduction lineage and
measured against this repo. This is the surfaced set, ranked. Full ideas ledger in the session
scratchpad; supporting measurements in `2026-07-29-dead-player.md` and
`2026-07-29-player-count-scaling.md`.

**Which game this targets.** Everything below is about **v6 "The Trail"** (`src/v6/`). The shipped
v10 game (`src/rules/`, 206 green) stays frozen as a reference implementation and is not the
subject of any recommendation here — its retention profile is different in kind, because it has a
*survival win*, which is precisely the trap v6 was built to escape. The one thing v10 has that v6
does not is a CLI a human has actually played, which is why step 1 of §4 is a **port** rather than
a build. A handful of Tier 2 items — room codes, Discord, scheduling, launching into an existing
community (#22, #23, #24, #27) — are distribution strategy and would apply to either game.

---

## 0. The reframe

The question was "what makes a game like this addictive." The honest answer from the evidence is
that **the conventional addiction toolkit is the wrong tool here, and the genre has hard numbers
saying so.**

- **Goose Goose Duck** shipped more content than Among Us — dozens of roles, many maps,
  progression, cosmetics, a battle pass, and claw-machine collections costing $1,475+ to
  complete. It went **701,898 → 10,887 concurrent, −98.4%**.
- **Among Us's** largest-ever content update (Roles + Cosmicubes, Nov 2021) recovered **under 6%**
  of its peak.
- **Among Us has no official ranked mode** at 500M+ downloads. **Town of Salem does**, and its
  community writeups describe players reporting each other "for stupidity."
- **Blood on the Clocktower** has no progression system of any kind, costs ~$130, sells out
  repeatedly, and funded at $570k against a $65k goal.

What retains in this genre is **the table** — the group, the argument, the story afterward. Two
things cap that here, and both are measured, not speculated.

**Constraint A — liquidity.** Six simultaneous humans, no audience.
**Constraint B — the dead player.** Measured at 37–39% of children eliminated, spending 48–57% of
the session silent, with no survival win to play toward.

Every idea below is ranked on those two. An idea that helps neither is a lower tier than one that
does, however clever.

---

## 1. Five structural findings that change what should be built

These came out of reading the engine, not the web. Each invalidates a plan someone would
otherwise have made.

**1. Rescue does not exist.** `s.taken.push(victim)` at `night.ts:134` is the *only* mutation of
`s.taken` anywhere in `src/v6` — no splice, no filter, no removal. So the spec's entire answer to
Constraint B is unbuilt, and **41.5% is already the no-rescue number.** There is no headroom held
in reserve. Same shape as v10's `caught = 0`.

**2. Nobody has ever played v6.** `npm run play` runs `src/cli/play.ts` — the **v10** CLI.
`src/v6/cli/` contains only `sweep`, `waxtune`, `phase`. Every human-facing idea in this document
sits behind a v6 play loop that does not exist.

**3. The ten characters are pure spec.** `rosterFor()` returns bare string IDs. No NEL, no SASHA,
no wedge, no relight, anywhere in the codebase. This cuts both ways: every character idea is
design-stage and cheap right now — and every idea that leans on "nobody knows which six of ten are
in play" is costed against something unbuilt. **That bluff layer is also the only thing standing
between v6 and being solvable** — 20 rooms, 6 seats, 8 nights, no hidden randomness after the
villain draw, and the code is public. Right now it is a pure geometry-and-evidence game, which is
exactly the kind that solves.

**4. The game only works at exactly 6 players.** `startingWax` is hardcoded `[25,19,13]` at every
count while candles burn 1/night **plus 1 per occupant**. Measured: 4p → villain takes 57–62% in
3.6 nights; **10p → villain wins by taking 0.0%**, twice, in 1,000 games each. "Play with whoever
turns up" is not currently an available lever.

**5. The single best dead-player fix is free.** `night.ts:134` pushes the victim into `s.taken`
*before* line 150 computes `stillAlive`, and sightings are recorded only for `stillAlive`. **A
taken child records no sighting of the night they were taken.** They genuinely cannot name their
taker — so Blood on the Clocktower's "the dead keep talking" model is safe here **with zero rules
changes.** This is load-bearing and fragile; it needs a regression test naming that line ordering.

And the finding that reframes Constraint B entirely: villain-by-takes fires only 15.5–40.5% of the
time, so **in most games only one to three children ever die.** The dead-player cost is not spread
across the table — it lands almost entirely on **the first victim**, who in 53% of games eats six
or seven nights of silence alone. Fixes aimed at the first victim beat a general spectator system.

---

## 2. The thirty-six

### Tier 0 — prerequisites. Nothing else works until these do.

**1. Port `play.ts` to v6.** (Small) The gate on every solo, daily, async and onboarding idea in
this document. Known hazard, documented in the v10 file: `playGame` pushes the night into
`state.history` *after* asking for the morning, so a human deciding what to say cannot see the
trail they are discussing. v10's CLI owns its own night loop for exactly this reason; the v6 port
must too.

**2. Instrument the human clock.** (Trivial) Log wall-clock per night, per phase, per session. Play
four games. Nobody knows whether 7.9 nights is 15 minutes or 60, and *every* pacing, session-length
and liquidity estimate below is unfounded until that number exists. Night length is bounded below
by the slowest of six players, eight times over.

**3. "Again? [Y/n]" at the end of a CLI game.** (Trivial) Right now `npm run play` ends at a shell
prompt — maximum possible friction, a full command re-entry. Balatro and Slay the Spire both
shipped this exact gap and both had it patched by their players.

**4. Build Rescue, then instrument it with a kill rule.** (Small) If it fires under ~10% of games
it is not a mitigation and must be redesigned or cut. Note the rules text won't implement as
written: §8 says "carry a burning lantern into the room," §6 says a carried lantern lights nothing.
The workable reading is *set it down*.

---

### Tier 1 — the dead player. Ranked by evidence, cheapest first.

**5. The taken child still speaks.** (Small, no rules change) The genre's best-proven fix — BOTC's
own framing is that games are "usually decided by the votes and opinions of the dead players."
Verified safe by finding 5 above. This is the highest value-per-hour item in the entire document.

**6. Taken children still win.** (Trivial, copy) Make the win screen say "the children won — you
won." v6 needs this more than any game in the genre because there is no survival win, so without
it, being taken is total immediate defeat with six nights left to sit through.

**7. The scream — the house names the *floor* of a dark take, not the room.** (Trivial) This breaks
the closed loop that makes Rescue impossible: *the one person who knows where the take happened is
the one person who may never speak.* Turns rescue from 1-in-17 into 1-in-6, and arrives as a
**claim** the hearers can lie about, so it feeds the morning contest instead of short-circuiting
it. Measure first — a spoke is a dead end, so a floor bit plus one published roster is close to a
conviction.

**8. Scatter the starting positions.** (Trivial) Attacks the *cause* of the night-1 cliff rather
than the symptom: everyone starts on `landing_0`, so six bodies into six capacity-2 spokes is a
birthday-problem collision machine. **Mutually exclusive with a night-1 grace — and strictly
better than it**, because the metronome (600 takes on odd nights vs 27 on even) means a grace night
just *relocates* the cliff to night 3.

**9. The called shot.** (Trivial) On the night you are taken, lock a private guess at who Odd Socks
is; revealed at the end. Restores a personal outcome without restoring a survival win — you are not
rooting to have lived, you are rooting to have been right, and you are uniquely placed to judge.

**10. The postmortem screen.** (Small) On being taken, a full reconstruction of your last three
nights — the rooms, the rosters, what you missed. "The sock you walked past on night 2 was three
feet from you in the dark." `NightRecord.sightings` already holds all of it.

**11. The last word.** (Trivial) One sentence, ever, spent at a morning of your choosing. Keeps the
dead *watching*, because they are waiting for the right moment. Constrain it to be about a **room,
never a person** — a dead player has no motive left, so the table will treat their sentence as
ground truth, and that is a new unbluffable channel in a game built on bluff space.

**12. The body holds the sock.** (Trivial) A take-night sock lands in the victim's hands and is
findable. Makes the take room and the rescue room the same room, so **rescue becomes greed rather
than altruism** — the cheapest way to raise a rescue rate that will otherwise be zero.

**13. Cupped hands.** (Trivial) A taken child still commits a move, publishes nothing, and their
room burns 1 *less* wax. Pure agency, zero information leak, directly playing for the win condition
they lost. Self-critique worth keeping: the donation peaks when wax matters least.

**14. Two-stage take — "held," then gone.** (Small) A take leaves you held for one night; a lantern
carried in frees you. Project Winter runs exactly this two-tier system and the *cheap* tier is what
actually fires in play.

**15. The dead read the dark — identity-blind.** (Small) Give ghosts the trail view — every sock,
every position — but **never the villain's identity**. v6's central image, the monotone sock trail,
is a thing no living player ever sees. Full omniscience voids idea 9 and must not ship with it.

**16. Marking, not taking.** (Small) Being alone with the villain marks you; a second night takes
you. Converts the take from a silencing into a **speech generator** — a marked child wakes with the
most actionable claim in the game. Big balance risk; the mark-claim likely becomes the meta.

**17. On being taken, your character fires.** (Small) WREN's last breath names everyone who was in
the room with her. **Watch the §10 trap:** a trait that fires on being taken *never fires for the
villain*, so the villain can claim it all game with zero behavioural footprint. Every on-death
trait needs a villain-side tell or it becomes the villain's free claim.

---

### Tier 2 — liquidity. The gate everything else sits behind.

The arithmetic, derived rather than recalled: **required peak CCU = 5T/W** (T = match length,
W = tolerable wait for the first player in). At a 30-minute match and a 5-minute tolerance, that
is **~30 peak-hour concurrent players in a single undifferentiated pool.** Every split — region,
skill, ranked, player-count menu — multiplies it.

Two numbers that should govern the strategy. A browser multiplayer dev measured that **70% of
users who joined an empty lobby waited an average of 15 seconds and left.** And **Among Us sat at
30–50 concurrent players for two years** before streamers rescued it — a finished, free,
cross-platform, genre-defining game, below liquidity, for two years.

**18. Bots are the default product; humans are the upgrade.** (Trivial — it exists) The
single-seat-vs-five-bots game is *finished* and the multiplayer one does not exist. Ship the one
that exists. Constraint: never let a bot be Odd Socks in a public game — it cannot defend itself in
the morning.

**19. Async: one night per real day.** (Medium) **The strongest structural fit found.** v6's night
is already a blind simultaneous commit — there is no live discussion phase to lose and no turn
order to enforce. Werewolf cannot do this because its core loop is a conversation; v6's core loop
is a *submission*. Measured game length (7.3–7.9 nights) lands on Subterfuge's 7–10 day target with
no retuning. Cheap test first: Discord + the CLI + a human moderator, one weekend.

**20. The bot must play absent seats — and this is not optional.** (Trivial) v6 has **no legal
hold order**: everyone must move one room, only WREN may stay. So async cannot default a no-show to
"hold" the way Diplomacy does. Sharpest caveat in the fan-out: a bot playing the *villain's* seat
is a different villain, and the bots are deterministic and fingerprintable from public code — so
**bot substitution is an information leak, not just a fairness issue.**

**21. Fix the 4-player table, then make it the default.** (Small) Dropping six → four cuts the
atomic network by **40%**. It is also currently broken (finding 4), and the fix is *not* the wax
alone — with three children and `takeTarget = 2`, two unlucky blind commits end it. Measure the
**Naming rate**, not the win rate.

**22. Room code, no account, no install.** (Small) Jackbox economics: one person owns it, five join
free from a phone. Six players means five separate humans must each clear the entry barrier —
friction doesn't add across a lobby, it multiplies. v6's public/private split (lit rooms publish
names; you know only your own character) maps exactly onto shared-screen/phone.

**23. Ship it as a Discord Activity.** (Medium) A voice channel is a pre-assembled six humans. v6's
morning is a *voice* mechanic already — NEL must speak first and state where she came from.
Death by AI: 7M users in weeks, **70%+ of sessions with 3+ friends**. Honest ceiling: Activities
top out far below a Steam hit, monetization is immature, and you are a tenant.

**24. The house opens at nine.** (Trivial) Stop trying to be available 24/7. Scheduling drives W
toward infinity, because a scheduled player has *already decided to wait* — they are keeping an
appointment, not evaluating an empty room. It is the only lever that removes the denominator, and
it costs nothing to build. BOTC's Discord communities run entirely on a calendar, not matchmaking.

**25. Concentrate — one timezone, one language, one queue, on purpose.** (Trivial) Two pools of 20
never fill a house; one pool of 40 fills one every ten minutes. Never ship a "4 / 6 / 8 player"
menu — each size is a genuinely different board and cannot be merged mid-queue.

**26. Requeue the moment you die.** (Small) The dead are your most available players. This is what
actually retained Among Us — not ghost tasks, but that the next round is thirty seconds away.
Honest cost: it optimises for people leaving the game they are in, hollowing out the endgame where
word-of-mouth comes from.

**27. Launch into an existing deduction community, not a store.** (Trivial) The unofficial BOTC
Discord is 27,000+ members of people who *already schedule six-player deduction games* — the rarest
behaviour you need. Your pitch is one sentence: *evidence is not gated on the villain choosing to
act.* They understand that in three seconds; nobody outside the genre does. You get one shot, and a
first table will turtle by instinct.

**28. The daily house.** (Trivial, given #1) `seed = daysSinceEpoch`. mulberry32 is deterministic
and `playGame` already takes the seed — this is not a feature, it is an argument to pass. Liquidity
requirement: zero.

---

### Tier 3 — the cheap compounding wins

**29. Name the collapse that already exists.** (Trivial, copy) Candles burn 1/night **+1 per
occupant**, so as candles die the children are funnelled into fewer lit rooms and crowding kills
them faster. **That is a genuine death spiral, structurally identical to a shrinking battle-royale
circle, and no player has ever been told it exists.** The endgame isn't a slow darkening; it's a
curve with no voice. Cheapest item in the fan-out.

**30. The morning report teaches the game.** (Trivial) Print what the house *cannot* see ("the
nursery: no word") to teach light/dark on morning one. Print the candle's subtraction. Render the
already-existing `{t:'crowded'}` event to teach spoke-capacity-2 permanently. The design filter
that falls out: **every rule should be learnable from morning reports** — and it has teeth, because
MAB fails it by construction.

**31. The Morning Grid.** (Trivial) The shareable artifact, and it must be the emoji rectangle, not
the map. A 20-room 3-floor map fails "legible to a non-player" the way Strava routes do — it is a
superb *reveal* and a bad *share*. Two caveats the fleet raised and I'd keep: unlike Wordle, these
grids aren't comparable across players, and a route shared on a shared seed is a solution leak.

**32. The Ledger — a written epilogue.** (Small) The only place the six dealt characters can be
revealed without breaking bluff space, and therefore the only place a player can ever learn the
quiet one was MAB. **Write one by hand for a real game before writing any code; if the handwritten
one isn't good, the generated one won't be.**

**33. The daily deduction puzzle, mined from real simulated games.** (Small, gated) Lichess mines
650k+ puzzles from real games this way. The prerequisite is a **consistency enumerator** that keeps
only positions where exactly one villain survives the public evidence — and the *rejection* half is
the expensive half. Run the yield test first; it is a day, and it tells you whether the product
exists. Note socks are undated bare counts visible only in lit rooms, so "one spoke sock buys two
manifests" is looser than the spec claims.

**34. The belief graph.** (Small) One line: how many villain-consistent worlds remained after each
morning. It is the same enumerator run once per night. Build it early **precisely because it can
deliver bad news cheaply** — it may reveal the trail doesn't converge at all, which would be a
finding about the design, not the tool.

**35. Seasonal *house*, not seasonal rewards.** (Trivial) Change the wax, seal a spoke, move where
night one starts. It is config plus a sweep — the cheapest real content available by an order of
magnitude, and it resets the meta for everyone at once.

**36. The style bible, written first.** (Trivial) The house speaks every night of every game — the
highest-repetition text in the product. The rule that writes itself: **the house names, counts and
reports; it never interprets, never adjectivises a person, and never says anyone is frightened.**
Corollary, and it is a hard integrity rule: **the house's vocabulary must be a function of the room
and the night, never of who is standing in it** — a WREN-flavoured line on a stay-put confirms WREN
is in play, which is the most valuable information in the game given away by the flavour layer.

---

## 3. Refuse these, on the evidence

- **Battle pass / cosmetics / progression as a retention answer.** See §0. Apex's 2024 paid-pass
  change drew 30,000+ negative reviews in a week and was fully reverted.
- **Ranked.** Rating is incoherent for an asymmetric 1v5 where your result is dominated by five
  other people and by which side you drew; and a second queue halves an already-impossible pool.
- **An individual daily streak.** Duolingo's data is excellent and Duolingo is *solo*. Here a streak
  punishes a player for their friends' absence — the one variable they cannot control. It is not a
  retention mechanic, it is a liquidity trap.
- **Unlockable or pickable characters.** Fails the secrecy test at every level. Secret self-picks
  collapse the effective roster from ten to four.
- **Public random lobbies as the default entry point.** One griefer in six breaks the Naming
  outright by simply declining to walk into the room.
- **A report queue / reputation system.** Town of Salem runs ~2,000 queued reports on volunteers
  and players still say they're ignored. A report button with nobody behind it is worse than none.
  Ship client-side block/mute and friends-only-by-default instead.
- **Throwing detection.** A child walking alone into a dark spoke is either the correct play the
  whole design exists to force, or throwing. There is no distinguishing signal.
- **Undisclosed bots.** The subject of this game is whether the person you are talking to is lying
  about who they are. Undisclosed bots make the product itself run an undisclosed deception on the
  player. Disqualifying on its own terms — and the bots are fingerprintable from public code.
- **A move-quality evaluator.** There is no ODD SOCKS engine; `policies.ts` is hand-written
  heuristics. Grading a human against `searcher` would grade them against an arbitrary heuristic
  and call it truth. The honest substitute is #34: report what was *knowable*, never what was
  *optimal*.
- **A vote to execute.** v6 has none, and this is a structural gift most designers in the genre
  would trade for — a wrongly-Named player is *cleared* and gains status. Protect it in writing.
- **Authored lore.** Destiny killed Grimoire cards for D2 to "put the lore in the game."
  Boatmurdered's lore was generated by play. Lore will not fill lobbies. Ceiling: one page, once.
- **A wiki or strategy guide, yet.** Three rules changed by measurement during construction, Rescue
  is unbuilt, characters are unbuilt, and the spec's own 4p take target contradicts its code.
  Anyone who wrote a guide this week would be wrong next week — and early theorycrafters are the
  least replaceable users you will ever have.

---

## 4. What I would actually build

In order. The first four are days, not weeks.

1. **Port `play.ts` to v6** and add "again? [Y/n]". Log wall-clock time. Play four games.
   *Nothing else in this document can be evaluated until someone has played this game.*
2. **Scatter the starting positions.** The single highest-leverage rules change available: it
   attacks the measured *cause* of the night-1 cliff, which is the largest generator of
   dead-player time in the game.
3. **Let the taken child speak** (free, verified safe) + **taken children still win** (copy) +
   **the called shot** (trivial). Three items, one named state, and the dead-player problem stops
   being the worst thing about the game. Ship it with a regression test — *"a taken player has no
   sighting for the night they were taken"* — naming the `night.ts:134`-before-line-150 ordering.
   Without it, a future refactor silently breaks the thing everything here is built on.
4. **Build Rescue with the floor-scream and the body-sock**, then measure the fire rate against a
   pre-committed 10% kill rule. If it fires below that, cut it from the spec and stop citing it.

> **Sweep steps 2–4 together, not in sequence.** Every one of them moves the children's win rate
> up — a scattered start, a published floor on dark takes, and a findable body-sock are three
> children-side buffs landing on a number that measured **41.5% against the strongest villain line
> with no headroom** (finding 1: Rescue is unbuilt, so 41.5% is already the no-rescue number).
> The wax retune is sizing for all three at once. Re-tuning after step 2 and then implementing
> steps 3–4 will produce a tuning that is wrong by the time it ships, and this project's standing
> lesson is that such failures here are always silent.
5. **Then, and only then, pick a liquidity strategy.** The honest recommendation is
   **async-first** — it is the only option that removes the six-simultaneous-humans requirement
   rather than working around it, and v6's blind simultaneous commit is unusually suited to it. Test
   it as Discord + CLI + a human moderator before building any server.

**What I would not do:** build a matchmaker, build a lobby, or build multiplayer at all until the
solo loop exists and someone has actually played it. The strongest single line in the fan-out came
from a developer with the analytics to back it: *"If you don't already have a big user/fan base, do
not release a multiplayer game without having a single player mode against AI."*

---

## 5. Caveats on this research

- The fleet's shared **WebSearch budget hit its 200-call cap** partway through. The last four
  agents worked partly from recall; a few citations rest on search snippets rather than fetched
  pages, and those agents flagged their own weak items. Discount sourcing accordingly, not the
  reasoning.
- The safety classifier was unavailable during three agents' runs — their file-touching claims were
  spot-checked, and none modified the repo.
- **Every engine claim in §1 I verified myself.** The agent claims I did not verify are marked as
  theirs throughout.
