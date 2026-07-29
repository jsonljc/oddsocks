# The game only works at six players

Probe: `docs/findings/probes/smalltable.ts`. 1,000 games per cell, `searcher` children.

## Why this was measured

Lobby liquidity is the gate on a 6-player game: an unknown title needs six humans in a room at
once. The obvious relief valves are "play at four when only four turn up" and "play at eight when
more do". `SCALES` supports 4/6/8/10 and `rosterFor` deals up to ten, so the scaling looks
shipped. It is not.

`startingWax` is hardcoded `[25, 19, 13]` at **every** player count (`src/v6/rules/config.ts:41`),
while a candle burns one per night **plus one per occupant**. Burn scales with population; the
wax does not. Nothing retunes the only real balance knob.

## What it does

| | children win | villain by take | villain by dark | nights | namings/game |
|---|---|---|---|---|---|
| **4p** light | 39.8% | **57.6%** | 2.6% | **3.6** | 0.51 |
| 4p hunter | 39.5% | **60.2%** | 0.3% | 5.2 | 0.68 |
| 4p random | 33.2% | **62.0%** | 4.8% | 5.0 | 0.52 |
| **6p** light | 41.6% | 39.8% | 18.6% | 6.5 | 0.77 |
| 6p hunter | 66.0% | 15.9% | 18.1% | 8.0 | 1.25 |
| 6p random | 57.2% | 19.6% | 23.2% | 8.0 | 1.05 |
| **8p** light | 75.9% | 24.1% | 0.0% | 5.3 | 0.76 |
| 8p hunter | 27.1% | 5.2% | **67.7%** | 10.7 | 1.14 |
| 8p random | 32.6% | 5.9% | **61.5%** | 10.0 | 1.03 |
| **10p** light | 70.4% | **0.0%** | 29.6% | 5.9 | 0.80 |
| 10p hunter | 11.5% | **0.1%** | **88.4%** | 11.1 | 0.90 |
| 10p random | 22.2% | **0.0%** | **77.8%** | 10.2 | 0.89 |

**Only the 6p row is a game.** The others each fail in a different direction:

- **4p is a coin flip that ends before it starts.** 3.6–5.2 nights. The take target is 2 (three
  children, `roster.length - 2`), so two unlucky blind commits end it — and the villain takes
  57–62% of the time. The candle clock is decoration: `dark` fires 0.3–4.8%. Under a mean of one
  Naming every two games, the children's only win route barely assembles before the game is over.
- **8p and 10p invert the game into a waiting contest.** Against the two stronger villain lines,
  62–88% of games end with the last candle dying, and at 10p the villain wins by taking **0.0%** of
  the time — 0 games in 1,000, twice. Eight people under three candles burn the house down long
  before eight takes can land. The take, which is the game's central verb, stops existing.
- The `light` villain rows at 8p and 10p swing the opposite way (children 70–76%), so these cells
  are not merely mistuned, they are wildly policy-sensitive — a sign nothing here has been tuned
  at all.

## Consequences

1. **"Play with whoever turns up" is not currently available**, so it cannot be part of any
   liquidity answer until the wax is retuned per player count. That retune is cheap — wax is the
   known single balance knob, and more wax monotonically favours the children — but it is real
   work that nobody has done, and 8p/10p need *less* wax while 4p needs the take target revisited,
   not the wax.
2. **The spec is wrong about 4p.** §8 says the take target "scales to 3 at four players"; the rule
   it derives from (`children − 1`) and the code (`roster.length - 2`) both give **2**. At three
   children a target of 3 would be unreachable, so the code is right and the prose is a typo — but
   the prose is what a reader plans from.
3. Dead time gets worse as tables grow: mean nights-spent-dead rises from ~1.0 at 4p to ~3.2–4.5 at
   6p to ~5.8–6.2 at 10p. Bigger tables are not a way out of the dead-player problem; they deepen
   it. See `2026-07-29-dead-player.md`.

**Net: six is not a starting point that can flex, it is the only cell that works.** Any plan that
treats variable player count as an available lever is planning on something that does not exist
yet.
