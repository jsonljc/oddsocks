"""
ODD SOCKS v5 — does the occupancy burn actually break up crowds?

v5 claims the herd is fixed: "a candle burns a night of wax for every person in
the room. Crowds burn the house down." But the house says only the three spine
landings have candles; the other 17 rooms are permanently unlit. So a crowd
standing in a dark spoke burns nothing.

Second, the safety threshold is three: "Three or more is safe." Six players is
exactly two blocks of three. Movement is secret but a block agrees on its next
room out loud in the morning, which is legal — nothing in v5 forbids talking.

This measures the take rate for blocks of three touring the dark spokes, and
the per-night exposure of a single scout who peels off to fetch a sock.

CAVEAT, read before quoting anything from this file: `block_route` only ever
picks spokes, and spokes are dead ends, so blocks here never take the stairs
and stay pinned to one floor. That does not touch the 0.00% take rate — three
people in a room cannot be taken, on any topology, so that figure is
arithmetic rather than sampling. It does make the wax-per-night figure
unreliable. Use v5_wax.py for wax, and v5_probe.py for take rates.
"""
import random
from statistics import median

SPOKES = (6, 5, 6)


def build(spokes=SPOKES):
    adj = {'L0': ['L1'], 'L1': ['L0', 'L2'], 'L2': ['L1']}
    for i, n in enumerate(spokes):
        for j in range(n):
            s = f's{i}_{j}'
            adj[s] = [f'L{i}']
            adj[f'L{i}'].append(s)
    return adj


def block_route(adj, at, rng):
    """A block's publicly agreed next room. Prefers dark spokes: free of wax,
    and a block of 3+ cannot be taken in one."""
    spokes = [r for r in adj[at] if not r.startswith('L')]
    return rng.choice(spokes) if spokes else adj[at][0]


def wax_burned(rooms_occupied):
    """Candles burn 1/night + 1 per occupant, and only the 3 landings have one."""
    return sum(1 + n for room, n in rooms_occupied.items() if room.startswith('L'))


def run(mode, nights=40, games=4000, seed=7):
    rng = random.Random(seed)
    adj = build()
    take_nights = 0
    total_nights = 0
    scout_taken = 0
    scout_nights = 0
    wax = 0

    for _ in range(games):
        villain = rng.randrange(6)
        # two publicly agreed blocks of three; the villain is inside one of them
        blocks = [[0, 1, 2], [3, 4, 5]]
        at = {0: 's0_0', 1: 's0_0'}          # both blocks start in the Sitting Room
        alive = set(range(6))

        for _night in range(nights):
            dest = {b: block_route(adj, at[b], rng) for b in (0, 1)}
            pos = {}
            for b, members in enumerate(blocks):
                for p in members:
                    if p in alive:
                        pos[p] = dest[b]

            scout = None
            if mode == 'scout':
                # one child peels off into a different spoke to search for socks.
                pool = [p for p in alive if p != villain]
                if pool:
                    scout = rng.choice(pool)
                    landing = at[0] if scout in blocks[0] else at[1]
                    opts = [r for r in adj[landing] if not r.startswith('L')] \
                        if landing.startswith('L') else [adj[landing][0]]
                    pos[scout] = rng.choice(opts)
                    # the villain may abandon their block to hunt the scout,
                    # guessing blind among the spokes off their own landing
                    vland = at[0] if villain in blocks[0] else at[1]
                    vopts = [r for r in adj[vland] if not r.startswith('L')] \
                        if vland.startswith('L') else [adj[vland][0]]
                    pos[villain] = rng.choice(vopts)

            occ = {}
            for p in alive:
                occ[pos[p]] = occ.get(pos[p], 0) + 1
            wax += wax_burned(occ)

            vroom = pos[villain]
            here = [p for p in alive if pos[p] == vroom]
            total_nights += 1
            if scout is not None:
                scout_nights += 1
            if len(here) == 2:
                take_nights += 1
                victim = [p for p in here if p != villain][0]
                if victim == scout:
                    scout_taken += 1
                alive.discard(victim)

            for b in (0, 1):
                at[b] = dest[b]

    return (take_nights / total_nights,
            (scout_taken / scout_nights) if scout_nights else 0.0,
            wax / total_nights)


print("ODD SOCKS v5 — the herd, re-tested against the house as described\n")
for mode, label in [('blocks', 'two blocks of 3, touring dark spokes'),
                    ('scout',  'same, but one child scouts alone each night')]:
    take, sct, wax = run(mode)
    print(f"  {label}")
    print(f"     take-legal nights          {take*100:>6.2f}%")
    print(f"     scout taken, per scout-night{sct*100:>6.2f}%")
    print(f"     wax burned per night        {wax:>6.2f}   (0 = the house never darkens)\n")
