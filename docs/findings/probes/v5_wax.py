"""
ODD SOCKS v5 — does "crowds burn the house down" actually discriminate?

Claim under test: "a candle burns a night of wax for every person in the room.
Crowds burn the house down." The fix credited with breaking up the herd.

Wax burned in one night = sum over LIT rooms of (1 + occupants there)
                        = (# lit rooms) + (people standing on lit rooms)

That total does not depend on how those people are distributed among lit rooms.
Six in one landing and two in each of three landings burn the same. This checks
what happens over a whole game, where candles die at different times and a dead
candle stops charging its occupants.
"""

W = 12          # nights of wax per candle; v5 gives no number anywhere
PEOPLE = 6


def burn(policy, wax=W, nights=200):
    """Landings only have candles. Spokes are dead ends, so everyone is forced
    back onto a landing every other night: 'on landing' alternates for all."""
    w = {'L0': wax, 'L1': wax, 'L2': wax}
    lit_room_nights = 0
    on_landing = True

    for night in range(1, nights + 1):
        live = [r for r in w if w[r] > 0]
        if not live:
            return night - 1, lit_room_nights
        lit_room_nights += len(live)

        if on_landing:
            if policy == 'huddle':
                # everyone in one room: the crowd picks a landing still lit
                occ = {live[0]: PEOPLE}
            else:
                # spread as evenly as possible across the lit landings
                occ = {r: PEOPLE // len(live) for r in live}
                for i in range(PEOPLE % len(live)):
                    occ[live[i]] += 1
        else:
            occ = {}                       # everyone in dark spokes, no candle charged

        for r in live:
            w[r] -= 1 + occ.get(r, 0)
        on_landing = not on_landing

    return nights, lit_room_nights


print("ODD SOCKS v5 — is the occupancy burn a decision or a fixed tax?\n")
print(f"  {PEOPLE} players, {W} nights of wax per candle, 3 candles\n")
print(f"  {'children play':<26}{'house fully dark on night':>26}{'lit-room-nights':>18}")
print("  " + "-" * 68)
for policy, label in [('spread', 'spread across landings'),
                      ('huddle', 'all six in one landing')]:
    night, lrn = burn(policy)
    print(f"  {label:<26}{night:>26}{lrn:>18}")
print("\n  (A dead candle charges nobody, so huddling parks the crowd in the dark")
print("   for free once its own room burns out.)")
