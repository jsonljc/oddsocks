"""
ODD SOCKS v5 — consolidated structural probe. Supersedes v5_takerate / v5_camp,
both of which had a policy bug: 'explore' sent children to spokes only, and
spokes are dead ends, so children never used the stairs and were pinned to one
floor — a 7-room map, not the 20-room house.

Constructed house (v5 gives no room list): 3 landings chained L0-L1-L2, one per
floor, candles; 17 dead-end spokes hung off them (6/5/6), permanently unlit.
Diameter: spoke@L0 -> L0 -> L1 -> L2 -> spoke@L2 = 4. Matches the spec exactly.

All numbers are estimates from THAT map. Flagged as guesses.
"""
import random

STAIRS = 0.25   # chance an exploring child on a landing takes the stairs instead


def build(spokes=(6, 5, 6)):
    adj = {'L0': ['L1'], 'L1': ['L0', 'L2'], 'L2': ['L1']}
    for i, n in enumerate(spokes):
        for j in range(n):
            s = f's{i}_{j}'
            adj[s] = [f'L{i}']
            adj[f'L{i}'].append(s)
    return adj


def d_random(adj, pos):
    nb = adj[pos]
    return {r: 1 / len(nb) for r in nb}


def d_explore(adj, pos):
    """Spokes are 'where things are found', but the house has three floors and
    a child who never takes the stairs can only ever search one of them."""
    nb = adj[pos]
    spokes = [r for r in nb if not r.startswith('L')]
    lands = [r for r in nb if r.startswith('L')]
    if not spokes:
        return {r: 1 / len(nb) for r in nb}       # in a spoke: forced back out
    if not lands:
        return {r: 1 / len(spokes) for r in spokes}
    d = {r: (1 - STAIRS) / len(spokes) for r in spokes}
    for r in lands:
        d[r] = STAIRS / len(lands)
    return d


def sample(d, rng):
    x = rng.random()
    for r, p in d.items():
        x -= p
        if x <= 0:
            return r
    return list(d)[-1]


def p_one(dists, room):
    """Exact P(exactly one of these movers ends in `room`)."""
    ps = [d.get(room, 0.0) for d in dists]
    tot = 0.0
    for i, pi in enumerate(ps):
        if pi:
            pr = pi
            for j, pj in enumerate(ps):
                if i != j:
                    pr *= (1 - pj)
            tot += pr
    return tot


def run(n_players, child, villain, spokes=(6, 5, 6), nights=40, games=5000, seed=3):
    rng = random.Random(seed)
    adj = build(spokes)
    cd = d_explore if child == 'explore' else d_random
    legal = total = stayed = decisions = 0
    takes_all, night4 = [], []

    for _ in range(games):
        pos = {p: 's0_0' for p in range(n_players)}
        boss, alive, takes, got4 = 0, set(range(n_players)), 0, None

        for night in range(1, nights + 1):
            kids = [p for p in alive if p != boss]
            if not kids:
                break
            dists = [cd(adj, pos[p]) for p in kids]

            if villain == 'random':
                vroom = sample(d_random(adj, pos[boss]), rng)
            else:
                opts = list(adj[pos[boss]])
                if villain == 'oracle_camp':
                    opts.append(pos[boss])
                vroom = max(opts, key=lambda r: p_one(dists, r))
                decisions += 1
                if vroom == pos[boss]:
                    stayed += 1

            for p, d in zip(kids, dists):
                pos[p] = sample(d, rng)
            pos[boss] = vroom

            here = [p for p in alive if pos[p] == vroom]
            total += 1
            if len(here) == 2:
                legal += 1
                alive.discard([p for p in here if p != boss][0])
                takes += 1
                if takes == 4:
                    got4 = night
                    break
        takes_all.append(takes)
        night4.append(got4)

    hit = [n for n in night4 if n]
    return {
        'rate': legal / total,
        'takes40': sum(takes_all) / len(takes_all),
        'won': len(hit) / games,
        'med': sorted(hit)[len(hit) // 2] if hit else None,
        'camp': (stayed / decisions) if decisions else None,
    }


print("ODD SOCKS v5 — structural probe on a constructed 20-room house")
print("(estimates from a synthesised map, not facts about v5)\n")
hdr = f"{'':<46}{'take-legal':>11}{'takes/40n':>11}{'reach 4':>9}{'median':>8}"
print(hdr)
print("-" * len(hdr))

cases = [
    ("20r/6p random kids   | villain random",   6, 'random',  'random',      (6, 5, 6)),
    ("20r/6p random kids   | villain ORACLE",   6, 'random',  'oracle',      (6, 5, 6)),
    ("20r/6p exploring kids| villain random",   6, 'explore', 'random',      (6, 5, 6)),
    ("20r/6p exploring kids| villain ORACLE",   6, 'explore', 'oracle',      (6, 5, 6)),
    ("20r/6p exploring kids| ORACLE may camp",  6, 'explore', 'oracle_camp', (6, 5, 6)),
    ("32r/10p exploring    | villain ORACLE",  10, 'explore', 'oracle',     (10, 9, 10)),
]
for label, n, c, v, sp in cases:
    r = run(n, c, v, spokes=sp)
    med = str(r['med']) if r['med'] else '—'
    print(f"{label:<46}{r['rate']*100:>10.1f}%{r['takes40']:>11.2f}"
          f"{r['won']*100:>8.0f}%{med:>8}")
    if r['camp'] is not None and 'camp' in v:
        print(f"{'   ^ villain chose to stand still on':<46}{r['camp']*100:>10.1f}% of nights")

print("\n40-night horizon; v5 specifies no clock at all, so 40 is arbitrary.")
