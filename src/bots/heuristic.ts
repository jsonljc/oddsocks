import type { Rng } from '../rules/rng.js';
import type { PlayerId, Path, RoomId } from '../rules/types.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';
import type { PublicEvent } from '../rules/state.js';
import { distance, isBedroom, legalPaths, ownerOf } from '../rules/map.js';
import { reachableInFourHops } from '../analysis/safeLies.js';
import { isLitFor, type Bot, type Knowledge } from './types.js';

/** Trail namings are the only people-facts the house produces, so they drive suspicion. */
export function suspicionFrom(k: Knowledge): Record<PlayerId, number> {
  const score: Record<PlayerId, number> = {};
  for (const p of k.config.roster) score[p] = 0;

  for (const e of k.publicEvents) {
    if (e.t === 'trail') score[e.player] = (score[e.player] ?? 0) + 1;
    if (e.t === 'eyesOpen') score[e.player] = (score[e.player] ?? 0) + 2;
    if (e.t === 'callResolved' && e.outcome === 'cleared') score[e.target] = -100;
  }

  score[k.me] = 0;
  return score;
}

const looseItemRooms = (k: Knowledge): RoomId[] => {
  const here = new Map<RoomId, number>();
  for (const e of k.publicEvents) {
    if (e.t === 'itemSpawned') here.set(e.room, (here.get(e.room) ?? 0) + 1);
    if (e.t === 'itemTaken') here.set(e.room, (here.get(e.room) ?? 0) - 1);
  }
  return [...here.entries()].filter(([, n]) => n > 0).map(([r]) => r);
};

const litBedrooms = (k: Knowledge): RoomId[] =>
  Object.keys(k.config.house.rooms)
    .filter((r) => isBedroom(k.config.house, r) && isLitFor(k, r));

/** Stable order for a candidate list of paths, so `rng.pick` stays reproducible
 *  from seed regardless of how the list was assembled. */
const sortPaths = (paths: readonly Path[]): Path[] =>
  [...paths].sort((a, b) => `${a[0]}|${a[1]}`.localeCompare(`${b[0]}|${b[1]}`));

/** Pick the legal path whose destination scores best; ties broken by the rng. */
function bestPath(k: Knowledge, rng: Rng, score: (dest: RoomId) => number): Path {
  const paths = legalPaths(k.config.house, k.position);
  let best = -Infinity;
  let pool: Path[] = [];
  for (const p of paths) {
    const v = score(p[1]);
    if (v > best) { best = v; pool = [p]; }
    else if (v === best) pool.push(p);
  }
  return rng.pick(sortPaths(pool));
}

export const heuristicBot: Bot = {
  dusk(k: Knowledge, rng: Rng): DuskAction {
    const wantItem = k.held.length < k.config.carryCapacity ||
      (k.me === 'moss' && k.held.length < k.config.mossCarryCapacity);
    const targets = wantItem ? looseItemRooms(k) : [];

    const path = bestPath(k, rng, (dest) => {
      if (targets.includes(dest)) return 10;
      if (targets.length === 0) return 0;
      return -Math.min(...targets.map((t) => distance(k.config.house, dest, t)));
    });
    return { path, pickUp: true };
  },

  midnight(k: Knowledge, rng: Rng): MidnightAction {
    const call = k.activeCall;

    if (k.isVillain) {
      const forbidden = call && call.target === k.me ? call.room : null;
      const myBed = `bed_${k.me}`;
      const path = bestPath(k, rng, (dest) => {
        if (dest === forbidden) return -100;
        if (!isBedroom(k.config.house, dest) || !isLitFor(k, dest)) return 0;
        return ownerOf(k.config.house, dest) === k.me ? 1 : 20;
      });
      // Self-snuffing is a deliberate policy, not a coincidence of ending up
      // home: it only ever pays for itself when it's free
      // (!selfSnuffCostsNight buys claim-immunity at no cost in nights), and
      // it can only ever happen once — a bedroom that's already dark can't be
      // snuffed again, which this reads directly off the public lit state
      // rather than needing any memory of a prior decision. Deliberately the
      // raw map and not `isLitFor`: the question is whether my own light is
      // still alive, and a Lantern borrowing it back for one night does not
      // revive it, the same distinction `darkBedroomCount` makes.
      const snuffOwn = !k.config.selfSnuffCostsNight && k.night > 1 &&
        path[1] === myBed && k.lit[myBed] === true;
      return { path, joinCall: false, snuffOwn };
    }

    const myBed = `bed_${k.me}`;

    // A self-nomination is a promise made this same morning: "set on me, I'll
    // come, I'll clear myself." Honour it — this is the design's own route to
    // a `cleared` outcome, and nothing else in this bot walks the target
    // toward a Call posted on them.
    if (call && call.target === k.me && call.selfNominated) {
      const reaching = legalPaths(k.config.house, k.position).filter((p) => p[1] === call.room);
      if (reaching.length > 0) {
        return { path: rng.pick(sortPaths(reaching)), joinCall: false, snuffOwn: false };
      }
    }

    // A child with an item joins a Call on the child they suspect most — or,
    // for a self-nomination, joins regardless of suspicion: it's a standing
    // invitation to check, not an accusation that needs justifying.
    const suspicion = suspicionFrom(k);
    const willJoin = call !== null && k.held.length > 0 && (
      call.selfNominated ||
      ((suspicion[call.target] ?? 0) >= Math.max(0, ...Object.values(suspicion)) &&
        (suspicion[call.target] ?? 0) > 0)
    );

    if (willJoin && call) {
      const reaching = legalPaths(k.config.house, k.position).filter((p) => p[1] === call.room);
      if (reaching.length > 0) {
        return { path: rng.pick(sortPaths(reaching)), joinCall: true, snuffOwn: false };
      }
    }

    // Otherwise go home — the Grip makes staying in your own bed profitable.
    return {
      path: bestPath(k, rng, (dest) => (dest === myBed ? 5 : 0)),
      joinCall: false,
      snuffOwn: false,
    };
  },

  morning(k: Knowledge, rng: Rng): MorningAction {
    if (!k.isVillain) {
      const suspicion = suspicionFrom(k);
      const ranked = k.config.roster
        .filter((p) => p !== k.me)
        .sort((a, b) => (suspicion[b] ?? 0) - (suspicion[a] ?? 0));
      const top = ranked[0];
      const rooms = litBedrooms(k);
      const myBed = `bed_${k.me}`;

      // A Call constrains only the child it names, and the villain's own
      // bedroom is the one room they never need — darkening it does not
      // advance their quota. Aiming at `bed_<suspect>` therefore spends the
      // accusation on nothing precisely when the accusation is right. Name a
      // lit bedroom the suspect would still want if they are the villain.
      const denials = top ? rooms.filter((r) => r !== `bed_${top}`).sort() : [];
      const suspectCall = top && denials.length > 0 && (suspicion[top] ?? 0) > 0
        ? { caller: k.me, target: top, room: rng.pick(denials), selfNominated: false }
        : null;

      // Self-nomination: the design's own way to buy a hard fact — "I'll come,
      // I'll clear myself." A minority of mornings with no stronger suspect to
      // name, stake a call on my own lit bedroom instead.
      //
      // Neither branch checks `held`: `canPostCall` asks only for a lit
      // bedroom. An item is what a hand JOINING a Call spends, and posting is
      // free — gating it on carrying one rationed the children's only real
      // move by an economy that has nothing to do with the accusation.
      const selfNominate = !suspectCall && rooms.includes(myBed) && rng.next() < 0.3;

      const call = suspectCall ?? (selfNominate
        ? { caller: k.me, target: k.me, room: myBed, selfNominated: true }
        : null);

      return { claim: k.position, call, itemUses: [] };
    }

    return { claim: villainClaim(k, rng), call: null, itemUses: [] };
  },
};

/**
 * The villain's lie, reconstructed from what the house has said and what the
 * children have reported. Any room not refuted is fair game; the truth is always
 * in the set, so this never becomes an illegal claim.
 */
function villainClaim(k: Knowledge, rng: Rng): RoomId {
  const myBed = `bed_${k.me}`;

  // Only reports from the night just resolved count — an older naming
  // constrains nothing about tonight, even if the witness who made it has
  // since gone silent (Hushed) and so never gets superseded. `publicEvents`
  // never contains tonight's own reports either way (nights 1..N-1 only), so
  // "the night just resolved" is the freshest testimony that can exist.
  type Reported = Extract<PublicEvent, { t: 'reported' }>;
  const lastNight = k.night - 1;
  const reports = k.publicEvents.filter(
    (e): e is Reported => e.t === 'reported' && e.player !== k.me && e.night === lastNight,
  );

  // A witness's report from last night already naming me in a lit room makes
  // lying pointless — the truth is already on the record.
  if (reports.some((e) => e.lit && e.named.includes(k.me))) return k.position;

  const refuted = new Set<RoomId>();
  for (const e of reports) {
    if (e.lit) refuted.add(e.room);
  }

  // Dark rooms hide identity but not headcount, mirrored from the solver: if
  // enough other players already claim a dark room to fill it, I have no seat
  // left there.
  const lastClaims = k.claims[k.claims.length - 1];
  if (lastClaims) {
    for (const e of reports) {
      if (e.lit) continue;
      const claimants = k.config.roster
        .filter((p) => p !== k.me)
        .filter((p) => lastClaims[p] === e.room).length;
      if (claimants >= e.others + 1) refuted.add(e.room);
    }
  }

  // Reachability anchors on my own *public story* — what I claimed last
  // night (or, on night 1, the bedroom everyone starts in, which is public
  // knowledge) — not on my true position, which nobody else can check a
  // distance against. This is the same anchor `solve`'s cross-night chain
  // uses, just read from my own claim history instead of reconstructed.
  const anchor = lastClaims?.[k.me] ?? myBed;
  const candidates = Object.keys(k.config.house.rooms)
    .filter((r) => !refuted.has(r))
    .filter((r) => reachableInFourHops(k.config.house, anchor, r));

  return candidates.length > 0 ? rng.pick(candidates.sort()) : k.position;
}
