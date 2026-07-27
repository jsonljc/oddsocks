import type { Rng } from '../rules/rng.js';
import type { PlayerId, Path, RoomId } from '../rules/types.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';
import type { PublicEvent } from '../rules/state.js';
import { distance, isBedroom, legalPaths, ownerOf } from '../rules/map.js';
import { reachableInFourHops } from '../analysis/safeLies.js';
import type { Bot, Knowledge } from './types.js';

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
    .filter((r) => isBedroom(k.config.house, r) && k.lit[r] === true);

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
  return rng.pick(pool);
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
        if (!isBedroom(k.config.house, dest) || k.lit[dest] !== true) return 0;
        return ownerOf(k.config.house, dest) === k.me ? 1 : 20;
      });
      // Self-snuffing is a deliberate policy, not a coincidence of ending up
      // home: it only ever pays for itself when it's free
      // (!selfSnuffCostsNight buys claim-immunity at no cost in nights), and
      // it can only ever happen once — a bedroom that's already dark can't be
      // snuffed again, which this reads directly off the public lit state
      // rather than needing any memory of a prior decision.
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
        return { path: rng.pick(reaching), joinCall: false, snuffOwn: false };
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
        return { path: rng.pick(reaching), joinCall: true, snuffOwn: false };
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

      // Aim at a room the suspect might plausibly be in: their own bedroom,
      // not an arbitrary lit one — a suspect has no reason to walk into a
      // call that has nothing to do with them.
      const targetBed = top ? `bed_${top}` : null;
      const suspectCall = top && targetBed && rooms.includes(targetBed) &&
        (suspicion[top] ?? 0) > 0 && k.held.length > 0
        ? { caller: k.me, target: top, room: targetBed, selfNominated: false }
        : null;

      // Self-nomination: the design's own way to buy a hard fact — "I'll come,
      // I'll clear myself." A minority of item-holding mornings with no
      // stronger suspect to name, stake a call on my own lit bedroom instead.
      const selfNominate = !suspectCall && k.held.length > 0 && rooms.includes(myBed) &&
        rng.next() < 0.3;

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
  // Only each witness's freshest report counts — an older report a witness
  // has since superseded constrains nothing about tonight (and `publicEvents`
  // never even contains tonight's own reports, only nights 1..N-1's).
  type Reported = Extract<PublicEvent, { t: 'reported' }>;
  const latest = new Map<PlayerId, Reported>();
  for (const e of k.publicEvents) {
    if (e.t === 'reported' && e.player !== k.me) latest.set(e.player, e);
  }
  const reports = [...latest.values()];

  // A witness's most recent word already naming me in a lit room makes lying
  // pointless — the truth is already the freshest thing on the record.
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

  const candidates = Object.keys(k.config.house.rooms)
    .filter((r) => !refuted.has(r))
    .filter((r) => reachableInFourHops(k.config.house, k.position, r));

  return candidates.length > 0 ? rng.pick(candidates.sort()) : k.position;
}
