import type { Rng } from '../rules/rng.js';
import type { PlayerId, Path, RoomId } from '../rules/types.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';
import { distance, isBedroom, legalPaths, ownerOf } from '../rules/map.js';
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
      return { path, joinCall: false, snuffOwn: path[1] === myBed && k.night > 1 };
    }

    // A child with an item joins a Call on the child they suspect most.
    const suspicion = suspicionFrom(k);
    const willJoin = call !== null && k.held.length > 0 &&
      (suspicion[call.target] ?? 0) >= Math.max(0, ...Object.values(suspicion)) &&
      (suspicion[call.target] ?? 0) > 0;

    if (willJoin && call) {
      const reaching = legalPaths(k.config.house, k.position).filter((p) => p[1] === call.room);
      if (reaching.length > 0) {
        return { path: rng.pick(reaching), joinCall: true, snuffOwn: false };
      }
    }

    // Otherwise go home — the Grip makes staying in your own bed profitable.
    const myBed = `bed_${k.me}`;
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

      const call = top && (suspicion[top] ?? 0) > 0 && rooms.length > 0 && k.held.length > 0
        ? { caller: k.me, target: top, room: rng.pick(rooms), selfNominated: false }
        : null;

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
  const nightEvents = k.publicEvents;
  const refuted = new Set<RoomId>();

  for (const e of nightEvents) {
    if (e.t !== 'reported' || e.player === k.me) continue;
    if (e.lit && e.named.includes(k.me)) return k.position;
    if (e.lit) refuted.add(e.room);
  }

  const candidates = Object.keys(k.config.house.rooms)
    .filter((r) => !refuted.has(r))
    .filter((r) => distance(k.config.house, k.position, r) <= 4);

  return candidates.length > 0 ? rng.pick(candidates.sort()) : k.position;
}
