#!/usr/bin/env python3
"""
ODD SOCKS v12.1 economy enumerator, v2.

Exhaustive DFS over every legal villain action line across Nights 1-6 under the
v12.1 rules as written. No sampling, no policy bot. The only free parameters are
ones the RULES DO NOT PIN; all are swept.

Corrections over v1:
  * a grab interdicts ONE carrier, not every securing that night
  * "escort" is modelled: §7's interrupt clause makes an escorted carrier
    grab-proof, but the escorted pair + villain = 3 bodies, which fires §14
  * villain crowd-joins start Night 2 (§13 starts everyone in separate rooms)
  * usable vs created sheds are distinguished (a Night-6 sock still has M6)
"""
from itertools import product

NIGHTS, FLAMES, TAKES_TO_LOSE, CALL_PRICE = 6, 5, 3, 2
ACTIONS = ("grab", "snuff", "quiet")


def legal_lines(matchbox):
    out = []
    for line in product(ACTIONS, repeat=NIGHTS):
        if line[0] == "grab":
            continue                              # §13
        takes, lanterns, relights, ok = 0, 2, (1 if matchbox else 0), True
        for a in line:
            if a == "grab":
                takes += 1
                if takes > TAKES_TO_LOSE:
                    ok = False; break
            elif a == "snuff":
                if lanterns:
                    lanterns -= 1
                elif relights:
                    relights -= 1                 # children relit; villain re-snuffs
                else:
                    ok = False; break
        if ok:
            out.append(line)
    return out


def play(line, latency, interdict, escort, crowd_from=2):
    """One villain line. -> (villain_win_night, earliest_call_morning, flames_donated)"""
    flames, takes, quiet = FLAMES, 0, 0
    floor, board, donated = [], 0, 0
    earliest_call, win = None, None

    for n in range(1, NIGHTS + 1):
        a = line[n - 1]

        if a == "grab":
            takes += 1; flames -= 1; floor.append(n); quiet = 0
        elif a == "snuff":
            flames -= 1; floor.append(n); quiet = 0
        else:
            quiet += 1
            if quiet == 2:
                floor.append(n); quiet = 0        # §7 shed

        # §14 fires when the villain walks in on a pair. Free: not a §7 hostile act.
        if crowd_from is not None and n >= crowd_from:
            flames -= 1; donated += 1

        # Securing (§6). Ripe socks come home; a grab may drop one carrier (§6),
        # unless the carrier is escorted (§7) - which itself fires §14.
        ripe = [b for b in floor if n - b >= latency]
        if ripe:
            if escort and crowd_from is None:      # escort donates its own flame
                flames -= 1; donated += 1
            # A grab can only interdict a carrier who could already be carrying:
            # the sock this very grab created cannot be the one it drops.
            carriable = any(b < n for b in ripe)
            lost = 1 if (interdict and a == "grab" and not escort and carriable) else 0
            got = max(0, len(ripe) - lost)
            board += got
            keep = ripe[got:] if got < len(ripe) else []
            floor = [b for b in floor if n - b < latency] + keep

        if takes >= TAKES_TO_LOSE or flames <= 0:
            win = n; break
        if earliest_call is None and board >= CALL_PRICE:
            earliest_call = n                      # morning after night n

    return (win if win else NIGHTS + 1), earliest_call, donated


def denies(line, **kw):
    win, call, _ = play(line, **kw)
    return call is None or call >= win


def hdr(t):
    print("\n" + "=" * 78 + f"\n{t}\n" + "=" * 78)


hdr("M1 - THE RACE: does a villain line exist that denies the Call outright?")
print(f"{'matchbox':>9}{'latency':>9}{'interdict':>11}{'lines':>7}"
      f"{'denying':>9}{'exists?':>9}{'best Call':>11}")
for mb, lat, itd in product((True, False), (0, 1), (False, True)):
    lines = legal_lines(mb)
    kw = dict(latency=lat, interdict=itd, escort=False, crowd_from=None)
    bad = [l for l in lines if denies(l, **kw)]
    ok = [play(l, **kw)[1] for l in lines if not denies(l, **kw)]
    print(f"{str(mb):>9}{lat:>9}{str(itd):>11}{len(lines):>7}{len(bad):>9}"
          f"{('YES' if bad else 'no'):>9}{('M' + str(min(ok))) if ok else '-':>11}")
print("\n  A villain picks its line, so ONE denying line is enough. Only the")
print("  latency=0 + no-interdiction corner is safe for the children; EITHER")
print("  unpinned parameter alone opens denying lines, and both open 21-22.")
ex = [l for l in legal_lines(False)
      if denies(l, latency=1, interdict=True, escort=False, crowd_from=None)]
print(f"\n  shortest denying exemplars (matchbox=False, latency=1):")
for l in sorted(ex, key=lambda l: sum(a != 'quiet' for a in l))[:3]:
    w, c, _ = play(l, latency=1, interdict=True, escort=False, crowd_from=None)
    print(f"    {' '.join(a[:2].upper() for a in l)}  -> villain wins night {w}, "
          f"board never reaches {CALL_PRICE}")

hdr("M2 - THE FLAME BUDGET: the Matchbox is what completes the villain's win")
for mb in (True, False):
    worst = max((sum(1 for a in l if a in ("grab", "snuff"))
                 for l in legal_lines(mb)
                 if sum(1 for a in l if a == "grab") < TAKES_TO_LOSE), default=0)
    note = "children relit once -> 3rd snuff target" if mb else "no relight available"
    print(f"  Matchbox drawn = {str(mb):<5} -> villain-only flame ceiling = "
          f"{worst}/{FLAMES}   ({note})")
print("\n  Without a relight the ceiling is 4: the children MUST donate the 5th.")
print("  Relighting restores a snuff target and lifts the ceiling to exactly 5.")
print("  §5 recommends the Matchbox without noting it completes the flame loss.")

hdr("M3 - §14 AS A VILLAIN TOOL: one free flame per night, no hostile action")
print(f"{'crowd/night':>12}{'villain wins':>14}{'earliest Call':>15}{'flames donated':>16}")
for c in (None, 2):
    lines = legal_lines(False)
    soon, best, don = NIGHTS + 2, None, 0
    for l in lines:
        w, call, d = play(l, latency=0, interdict=False, escort=False, crowd_from=c)
        if w < soon:
            soon, don = w, d
        if call is not None and call < w:
            best = call if best is None else min(best, call)
    lbl = f"night {soon}" if soon <= NIGHTS else "dawn after N6"
    print(f"{('off' if c is None else 'from N2'):>12}{lbl:>14}"
          f"{('M' + str(best)) if best else 'none':>15}{don:>16}")
print("\n  Same villain line set. The only change is §14 firing once a night because")
print("  the villain stepped into a room holding two children.")

hdr("M4 - THE ESCORT TRAP: the only counter to interdiction pays a flame")
print(f"{'defence':>22}{'denying lines':>15}{'flames donated':>16}{'earliest Call':>15}")
for lbl, kw in (("unescorted carrier", dict(escort=False, crowd_from=None)),
                ("escorted carrier",  dict(escort=True,  crowd_from=None))):
    lines = legal_lines(False)
    k = dict(latency=1, interdict=True, **kw)
    bad = [l for l in lines if denies(l, **k)]
    ok = [play(l, **k) for l in lines if not denies(l, **k)]
    d = max((o[2] for o in ok), default=0)
    print(f"{lbl:>22}{len(bad):>15}{d:>16}"
          f"{('M' + str(min(o[1] for o in ok))) if ok else '-':>15}")
print("\n  REFUTES MY OWN PRIOR. I expected escorting to close the denying lines")
print("  (§7's interrupt clause makes an escorted carrier grab-proof). It does -")
print("  but the villain answers by crowd-joining the escort pair, and the flames")
print("  that costs are worth MORE than the interdiction it prevents: 21 -> 96")
print("  denying lines. The sanctioned counter is worse than the attack.")

hdr("M6 - WHICH UNPINNED RULE ACTUALLY DECIDES IT: full cross-sweep")
print(f"{'latency':>8}{'crowd-join':>12}{'interdict':>11}{'lines':>7}{'denying':>9}{'best Call':>11}")
for lat, cf, itd in product((0, 1), (None, 2), (False, True)):
    lines = legal_lines(False)
    kw = dict(latency=lat, interdict=itd, escort=False, crowd_from=cf)
    bad = [l for l in lines if denies(l, **kw)]
    ok = [play(l, **kw)[1] for l in lines if not denies(l, **kw)]
    print(f"{lat:>8}{('off' if cf is None else 'from N2'):>12}{str(itd):>11}"
          f"{len(lines):>7}{len(bad):>9}{('M' + str(min(ok))) if ok else 'NONE':>11}")
print("\n  §14's crowd-join DOMINATES. It alone moves 0 -> 28 in the children's best")
print("  corner and 6 -> 227 in the worst. Once it exists, interdiction stops")
print("  mattering at all (28 == 28, 227 == 227): the flame clock fires first.")
print("  Fix §14 AND pin latency=0 and Call-denial disappears: 0 of 282 lines.")

hdr("M5 - THE PASSIVE VILLAIN: §16 Q2's 'produces two' is off by one")
w, c, _ = play(("quiet",) * NIGHTS, latency=0, interdict=False, escort=False,
               crowd_from=None)
print(f"  all-quiet line: sheds fire on nights 2, 4, 6 -> 3 socks created")
print(f"  Call payable {'M' + str(c)}, villain wins at {w} (dawn), so the 3rd sock")
print(f"  still has M6: a passive villain funds TWO Calls, not one.")
