# THE ODD SOCKS

## The rules, in plain English — v12.2

Six players. One is secretly the Odd Sock. Nobody is allowed to talk.

About 15 minutes a game.

> **v12.2 is v12.1 with three measured corrections applied** — the retrieval-latency pin (§6),
> the Matchbox's cost (§5), and two wrong answers in §16. See §17 for the audit.
>
> **§14 is known broken and is NOT fixed here.** The economy pass measured the crowd rule and
> found it is a *villain* ability. It is parked pending measurement, not repaired by argument.
> Read §14's notice before building anything that depends on the flame economy.
>
> This is the document the build follows.
> Source: `docs/rules-v12.1.md`, `docs/findings/2026-07-30-v121-economy.md`.

---

# 1. The idea

Six children wake up in a haunted house. Five are ordinary. One is the Odd Sock.

Every night the children wander the dark house looking for evidence. The Odd Sock walks among
them, putting out lights and grabbing anyone who ends up alone.

Every morning the house tells everyone what happened — but never who did it.

You cannot speak. You point, you move, you place lights, and you put your accusations on a board
where everyone can see them.

When you think you know who it is, you accuse them. If you're right, the house starts falling
apart and you have ninety seconds to trap them.

---

# 2. How to win

## The five flames

There's a fireplace with five flames in it. The flames are the clock.

**A flame goes out when:**

| What happened |
|---|
| A child gets taken |
| A lantern gets put out |
| Three or more children spend a night in the same room |
| An accusation is wrong |

## The Odd Sock wins if

- All five flames go out, **or**
- Three children get taken, **or**
- The sun comes up after Night Six and they haven't been trapped

## The children win only one way

Accuse the right person, then trap them.

**You cannot win by surviving.** Hiding until morning is an Odd Sock victory. This is the most
important rule in the game.

## The engine underneath

Read the flame list again. Everything the Odd Sock does to win **also gives you a sock** — which
is the evidence you need to accuse them.

They have to act to win. Acting arms you. That trade is the whole game.

---

# 3. The house

Ten rooms across two floors. Plus a bedroom you all start in and the fireplace room.

**No room has more than three doors.** (Counting stairs.) This matters — see the trapping rules
later.

You see the full floor plan before the game starts. You should never be confused about the
building. You should only ever be confused about **where everyone went.**

Each room has its own shape, its own sound, and one recognisable object in it. Dark rooms hide
who you are. They never hide where the doors are.

---

# 4. A night

Ninety seconds. Everyone moves around in real time.

**Anyone can:** walk, run, open and shut doors, point, pick up a sock, pick up a lantern, put a
lantern down, search a room, hide behind furniture, follow someone, go back to bed.

The Odd Sock can do all of it too. There is nothing they can't do that you can.

## In the dark

- Names vanish
- Pyjama colours wash out
- Faces disappear
- Outlines get fuzzy
- **You can still hear footsteps**

## If you get grabbed

You get a warning first. Not much of one, but a real one.

**While the Odd Sock is grabbing you, they move slower than you do.** So running actually works
— if you have somewhere to run to. Reaching lantern light saves you. So does someone else walking
in.

**You never find out who grabbed you.** It's too dark. This is deliberate: it's the reason people
can chat on Discord without ruining the game. Nobody can tell you the answer, because nobody has
it.

---

# 5. Lanterns

There are two. They're the most valuable things in the house.

## Carrying one

You get a bit of light around you. But:

- You can't carry a sock at the same time
- You move slightly slower
- People can see your glow through doorways
- It doesn't record anything

## Putting one down

This is what they're for. A lantern on the floor:

- Lights up the room
- **Stops the Odd Sock grabbing anyone inside the light**
- Watches one doorway of your choosing and reports what crossed it
- Makes searching faster
- Can now be put out by the Odd Sock — but only if nobody's standing in the light

## What a lantern tells you in the morning

> **Music Room lantern**
> Two figures came in. One left in a hurry.
> Nobody moved the lantern.

Numbers, directions, and roughly when. **Never names.**

## Putting one out

The Odd Sock can put out a lantern nobody is standing near. This costs a flame, kills the
lantern, makes a sock appear nearby, leaves soot, and makes a noise you can hear next door.

You can relight it with a Matchbox if you find one — **but know what you are doing before you
do it.**

> A relit lantern is a lantern the Odd Sock can put out again. Without a relight, the villain's
> own actions cap at **four** flames: two grabs (a third wins on the take clock instead) and two
> snuffs, because only two lanterns exist. The children have to donate the fifth themselves.
> Relighting restores a snuff target and lifts the villain's ceiling to exactly **five**.
>
> The only counter to a snuff is also the move that completes the villain's win. Relight when
> you need the light. Do not relight out of tidiness.

**Both lanterns always come back on for the final hunt**, no matter what happened to them
earlier. This is a hard promise, because otherwise the Odd Sock could destroy your ability to win
before you'd even worked out who they were.

---

# 6. Socks

Socks are your evidence. They're the only thing that buys an accusation.

## Where they come from

Three ways. All of them real — **there are no fake socks in this game.**

| What happened | Does a flame go out? |
|---|---|
| The Odd Sock grabs someone | Yes |
| The Odd Sock puts out a lantern | Yes |
| The Odd Sock does nothing for two nights in a row | No |

## They stay put

A sock on the floor **stays there**, night after night, until somebody picks it up. It doesn't
disappear at dawn.

## Getting one home

Finding a sock isn't enough. You have to carry it back to the bedroom and put it on the board.
Then it's yours permanently.

**Same night.** A sock that appears during Night *n* can be found, carried and boarded before
that same morning. There is no waiting until tomorrow.

> This one sentence decides the game. Measured over every legal villain line: at same-night
> securing, **0 of 282** lines can deny the children an accusation. Make it wait a night and
> **227 of 282** can. `QU GR GR GR` — do nothing, then grab on Nights 2, 3 and 4 — wins on the
> take clock with the board stuck at one sock of the two an accusation costs.
>
> **Build cost, stated plainly:** the client must let a sock created mid-night be discovered
> *and* delivered inside the same ninety seconds. That is a real constraint on the night loop,
> not a note.

**While carrying a sock:**

- You can't hold a lantern, so you're in the dark
- You're louder
- The Odd Sock gets a rough sense of which direction you're in
- If you get grabbed you drop it, and anyone can pick it up

**Anyone can carry a sock home. Including the Odd Sock.**

That sounds strange, so here's why: if only innocent people could do it, then doing it would
prove you're innocent, and the game would collapse into taking turns proving yourself. Instead,
the Odd Sock sometimes has to hand you real evidence just to avoid looking suspicious.

## A sock lying on the floor is bait

This is worth understanding properly.

Anyone who picks up a sock becomes slow, loud, blind, and heading somewhere predictable. So an
unclaimed sock on the floor is the best ambush spot in the house.

The Odd Sock's job on a quiet night is usually to **sit and watch one.**

---

# 7. What the Odd Sock can do

**One hostile thing per night. Never two.**

## Grab someone

Needs: a dark room, the target outside lantern light, no second child close enough to interrupt,
and about three seconds of contact.

It's not instant, and the target can get away.

When it works: they become a ghost, a flame goes out, a sock appears in that room, something gets
knocked over, and **a muffled noise is heard on that floor.**

## Put out a lantern

Costs a flame, makes a sock, leaves soot, kills the lantern.

## Use the secret passage

Once per game. Moves between two rooms instantly. Makes a loud noise in the pipes. Can't be done
while carrying anything.

## Do nothing — but it costs

The Odd Sock can't just behave like a normal child for six nights.

**After two quiet nights in a row, a sock falls in the exact room the Odd Sock is standing in**,
with a noise everyone can hear. Then the counter resets.

That's the pressure. Hiding leaks your location. Acting burns a flame and hands over evidence.
There is no free move.

---

# 8. The morning

Everyone wakes up in the bedroom. Ghosts hover around invisibly. The house reads out what
happened.

## What the house says

Facts only, never opinions. Every morning, in order:

- Who didn't come back
- How many flames are left
- What the lanterns saw
- Which socks got secured
- Which rooms were disturbed
- Which floor a noise came from
- Whether the children crowded together

> The Nursery stayed dark. The house saw nothing.
> The Music Room lantern watched two figures come in. One left in a hurry.
> A child didn't come back. A noise came from upstairs.
> One flame went out. Four left.

**The house never says anything that depends on who someone is.** Only on rooms, numbers, and
nights. This isn't a style choice — it's what keeps the referee honest and what stops the house
accidentally identifying the villain.

## The board

This is where the real game happens, and it's the part that still works even if everyone's
talking on Discord.

**Each living player may place one mark per morning.** A mark connects two things:

- A person to a room
- A person to a person
- A person to a sock
- A room to something that happened
- **Or it denies someone else's mark**

**Marks are permanent and public for the rest of the game.**

Talking is deniable. A mark isn't. When someone's Night Two mark contradicts their Night Four
mark, the board shows it, whether or not anybody remembers who said what.

The Odd Sock uses the same board and can lie all they like.

## Pointing

For the fast stuff, in the moment, you have nine gestures: **Me, You, Saw, Followed, Alone,
Together, Sock, Danger, Unsure.** You can chain them.

> Me → Saw → You → Attic
> Sock → Nursery → Unsure

Gestures are for warning and pointing. The board is for arguing.

---

# 9. Ghosts

Getting taken doesn't end your game.

## What you can do

Float anywhere. See **how many** people are in each room. See which lanterns are lit. See socks
on the floor.

## What you can't do

See **who** anybody is — you get counts, not faces. Pick things up. Use the board. Start an
accusation.

The head-count rule matters: you get grabbed right next to the person who did it, and if you
could see faces you'd just follow them and know. Then one death would solve the whole game.

## Your whisper

Once a night, you can: make a lantern flicker, send a cold draft through a doorway, knock
something over, leave half a gesture, or reveal whether one room had anyone in it.

Whoever's nearby sees it. It's always incomplete. The Odd Sock can tell a ghost did something,
but not always what it meant.

## Your vote

You keep **one** vote for an accusation. Once you spend it, it's gone.

## Your guess

The moment you're taken, you privately name who you think it is. It doesn't affect the game.

At the end you find out if you were right, what you actually knew at that moment, and what was
really happening in your last three rooms.

You're not hoping you'd survived. You're hoping you were right — and you had the best seat in the
house for it.

## You still win

If the children win, your screen says: **The children escaped. You won.**

---

# 10. Accusing — the Call

## What it costs

**Two secured socks.**

## How it works

1. Any living child can start it during the morning, once two socks are on the board
2. They place an accusation marker on one living player
3. Everyone gets fifteen seconds to respond on the board
4. Everyone votes — including the accused, and including the Odd Sock
5. Ghosts may spend their one vote
6. **More than half the votes cast carries it**

## If nobody agrees

Nothing happens. **Your socks are not spent.** The night begins as normal. You can try again
tomorrow.

## If you're wrong

You lose **one** sock and one flame.

You keep the other sock. So you're one sock away from trying again — a wrong guess hurts badly
but doesn't finish you.

**A wrong accusation does not clear anybody.** The person you named walks away with no protection
and no sympathy. This is why there's no execution vote in this game, and it kills the whole
"get accused early so you're trusted" tactic that most games like this suffer from.

## If you're right

The Odd Sock is revealed. The night cycle stops. The Last Night begins immediately.

**Being right doesn't win the game. It starts the ending.**

---

# 11. The Last Night

Ninety seconds. The house comes apart.

## What changes

The Odd Sock's mismatched socks become visible. Their shape distorts. The fireplace roars. Doors
slam. Rooms start sealing shut. **Both lanterns relight.** Everyone spawns where they stand
rather than in bed.

## Finding them

They're known but not permanently visible. Every few seconds the house shows you one trace: the
room they just left, which way they went, a footprint, a shadow, a door still swinging.

The traces come faster as time runs out.

## Trapping them — the Bind

Hold them in one room for **four seconds** with **every door sealed** and at least one living
child watching them.

**A door is sealed by** a lit lantern on the floor, or a living child standing in it.

**At least one door must be sealed by a lantern.**

**You can only do this in a room with exactly two doors.** That's what the three-door limit in
§3 is for — most rooms have two, so most rooms work, but the house isn't a straight corridor.

## Why this is always possible

Three rules guarantee it:

1. Both lanterns come back on when the Last Night starts
2. The Odd Sock can knock a lantern out, but it relights after ten seconds
3. As rooms seal, the remaining ones get simpler — but **no room is ever sealed down to zero
   doors**, and the fireplace room never seals

Trapping them should be hard. It should never be impossible because of something that happened
on Night Three.

## What they can do

Sprint in short bursts. Slam one door. Knock out a lantern with a slow, interruptible action.
Use one enhanced passage jump. Shove past a single door-holder after winding up. Throw one fake
shadow.

## They win if

The ninety seconds run out, all five flames go out, or three children have been taken in total.

---

# 12. Objects

Two turn up per game, drawn from four. Anyone can use them, including the Odd Sock. All
single-use.

- **Keyhole Mirror** — peek at movement in the next room without opening the door
- **Music Box** — briefly lights up every moving shape in the room. Loud
- **White Rabbit** — makes a fake figure appear for a moment
- **Matchbox** — relights a dead lantern

This is how the game varies between plays without anybody having special powers.

---

# 13. How it tightens

**Nights One and Two.** Faint light almost everywhere. You learn routes and place lanterns. **The
Odd Sock cannot grab anyone on Night One** — you all start in six separate rooms, and nobody
should lose the game to their first blind guess.

**Night Three.** Light drops. Searching in the dark takes longer. Footsteps start to matter.

**Night Four.** Rooms on the edges of the house begin closing.

**Nights Five and Six.** More routes shut. Relighting matters. The house's morning report gets
shorter and harsher. The pressure to accuse becomes unbearable.

---

# 14. Why grouping doesn't save you

> ## ⚠️ THIS RULE IS BROKEN AND IS NOT FIXED IN v12.2
>
> The rule below was measured by exhaustive enumeration and **it is a villain ability.**
>
> The count has to be over *bodies*, not over genuine children — that is forced, not chosen. §8's
> voice rule is absolute, so if the count excluded the villain, a room holding the villain and two
> children would report **no crowd**, and those two children would have just been told which of
> them was the third. That is the exact identity leak §8 exists to prevent.
>
> And walking into a room is not a hostile action (§7 lists grab / snuff / passage; movement is on
> §4's everyone-can-do-it list). So **the villain burns one flame per night, for free, by stepping
> into any room holding two children — and still takes its hostile action elsewhere the same
> night.** Its fastest win moves Night 4 → Night 3.
>
> Both readings of the trigger fail. Read it as any three-body co-presence and you get the free
> flame above. Read it as end-of-night occupancy — which is what "spend a night" actually says —
> and the children huddle for eighty-five seconds and scatter for the last five, and the rule
> never fires at all.
>
> It is also the villain's answer to *every* child formation: escort a carrier, get crowd-joined;
> huddle for safety, get crowd-joined; turtle under lanterns, get crowd-joined; split up, get
> grabbed. §14 promises "there's no free way to be safe." It delivers no way to be safe at all.
>
> **Do not iterate on the trigger wording.** The body-count requirement is forced by §8, so every
> occupancy-based trigger inherits the defect. The replacement has to price the children's
> behaviour through something **only they control** — evidence rate, search speed, lantern budget
> — and it must be *measured* before it is applied, by extending
> `docs/findings/2026-07-30-v121-economy.py`. The last version of this rule was argued rather than
> measured, and the applied version came out worse than the unpriced clause it replaced.
>
> **Nothing before Gate B depends on this.** The flame economy is slice 2b. Slice 0 has no flames
> and slice 1 reads them from a hand-authored log. Build those; leave this parked.
>
> Full measurement: `docs/findings/2026-07-30-v121-economy.md` §2, §4, §5.

Standing in a crowd makes you untouchable — the Odd Sock can't grab anyone with a witness
present. So without a rule, six people would just walk around in a clump all game.

**So: three or more children in one room for a night costs you a flame.** *(Parked — see above.)*

That's it. That's the whole anti-huddling rule. Crowds are safe and crowds lose.

Which leaves you with genuinely bad options, all night, every night:

- **Alone** — you can be grabbed
- **In a pair** — you can still be grabbed, because there's no third person to interrupt
- **In a group of three or more** — safe, but you're burning the house down
- **In a pair under a lantern** — actually safe, but you're not finding any evidence

There's no free way to be safe. That's the point.

---

# 15. What changed from v12, and why

For your own audit. All of these came out of the design review.

| Change | Because |
|---|---|
| Lanterns relight for the Last Night | Two early snuffs made trapping literally impossible — and produced exactly the two socks needed to accuse. The villain was funding your accusation and destroying your weapon with the same two moves |
| **Displace is cut** | With a person-only accusation, where a sock was found meant nothing mechanically. Worse: a loose sock is the best ambush in the game, so moving it was throwing away the villain's best quiet-night play |
| Rooms may have three doors; Bind needs a two-door room | "No more than two doors" secretly meant the whole house was a straight line or a loop, with no branching anywhere. That deletes the point of hidden movement |
| Anyone can secure a sock, villain included | Barring the villain made securing a proof of innocence, which is exactly the thing a wrong accusation is designed not to give anyone |
| Ghosts see head-counts, not faces | You get grabbed standing next to the culprit. If ghosts saw faces, they'd follow them, and one death would end the game |
| **The crowd rule** (§14) | The old anti-huddling rules all targeted the evidence economy. What actually made crowds safe was one unpriced clause about witnesses |
| **The floor report is cut** | Reporting which floor the villain ended on let a group standing still narrow them down by elimination, one bit per night. It also couldn't be computed without leaking who the villain was |
| Accusations: full procedure | v12 said what it cost and what happened afterwards, but never who starts one, how, or what a tied vote does |
| A wrong accusation costs one sock, not two | Losing both was mathematically fatal in most games. Now you're one sock from a second try |
| Nothing happens on a failed vote | Otherwise a single dissenter could burn the children's evidence for free |
| The board can deny things | It had four ways to make a claim and no way to say "that's not true," so it couldn't actually hold an argument |
| Fleeing actually works | The rules said you may run without ever saying the villain was slower. Running held distance forever and broke nothing |
| Midnight is cut | A public reveal of who's in a named room tells you nothing — the villain just shows up at the same rate you do. It was a beat, not a mechanic |
| "Corrupt the Hearth" is cut | A fourth win condition, mentioned once, in a room the endgame funnels everybody toward |
| Socks explicitly persist | Never actually stated anywhere |

---

# 16. What nobody knows yet

Straight list. These are open, not overlooked.

**1. Is the silence fun?** The whole premise, and no amount of writing can answer it.

**2. Is two socks the right price?** ~~A completely passive villain produces two, which is exactly
one accusation.~~ **Corrected in v12.2:** the shed fires on Nights **2, 4 and 6** — three socks,
not two. An accusation is payable at morning 4, and morning 6 is still a live window, so the third
sock funds a **second** attempt. With §10's wrong-accusation cost of one sock, a passive villain
gives the children two swings. The tension is real but looser than v12.1 claimed.

**3. Does a pair under a lantern break the game?** ~~No flames burn.~~ **Corrected in v12.2:** the
premise was wrong. Under the crowd rule the villain simply walks into a lantern room, makes it
three bodies, and burns a flame. The turtle formation is grab-proof and snuff-proof and **still
bleeds a flame a night, at the villain's discretion.** Whether that is the right answer depends
entirely on what replaces §14 — so this question is downstream of that one, not independent of it.

**4. Can a group coordinate a Bind with no words?** Four seconds, every door sealed, one lantern,
one watcher, under a ninety-second timer, in silence.

**5. Does the board actually carry arguments?** It's now the only channel that can. If it's too
slow to use inside a one-minute morning, the morning has no working discussion at all.

**6. What does the Odd Sock do on their quiet nights?** The answer here is "watch a sock and wait,"
which is at least a real answer. Whether it's a fun one is unknown.

**7. ~~Is the crowd rule too harsh?~~ Reframed in v12.2: the crowd rule is load-bearing for the
villain's second win condition, and the villain decides when it fires.** Without a relight, the
villain's own actions cap at four of five flames — two grabs and two snuffs. Something else has to
supply the fifth. Today that something is §14, which §14's own notice shows the villain triggers
at will. So "too harsh" was the wrong axis: the question is whether the all-flames-out win
condition is reachable *at all* without handing the villain a free lever. Blocked on §14's
replacement.

---

# 17. What changed from v12.1, and why

Three corrections, all from `docs/findings/2026-07-30-v121-economy.md` — an exhaustive enumeration
over every legal villain line, 282–402 depending on the object draw. No number below was argued.

| Change | Because |
|---|---|
| **§6 pins retrieval latency to zero** — a sock found on Night *n* boards at morning *n* | The single unstated word that decides the game. Same-night: **0 of 282** villain lines can deny an accusation. Next-morning: **227 of 282** can. It was flavour; it is now a rule, with a stated build cost |
| **§5 notes what relighting costs** | Relighting restores a snuff target and lifts the villain's flame ceiling from four to five. §5 recommended the Matchbox without noting that the only counter to a snuff completes the villain's win |
| **§16 Q2 and Q3 corrected, Q7 reframed** | Q2 was off by one in the children's favour — the shed fires three times, funding two accusations. Q3's premise ("no flames burn") is false under the crowd rule. Q7 was asking about severity when the real question is who controls the trigger |

## Deliberately NOT changed

- **§14's crowd rule is parked, not fixed.** It is the lead defect and the measurement says do not
  repair it by argument. See its notice.
- **Carrier interdiction is untouched.** The cross-sweep shows it is fully masked while §14 stands
  (28 == 28, 227 == 227 denying lines with it on and off) and denies nothing on its own at latency
  zero. Fixing §14 and pinning latency may leave nothing here to fix — re-measure before spending a
  rule on it.

## One caution the source carries, repeated here

The enumerator models nights at night-granularity and is **generous to the children everywhere it
is uncertain**: every ripe sock comes home, the children always accuse correctly the first time,
and deduction is free. The denying-line counts are therefore **lower bounds on the villain's
advantage.**
