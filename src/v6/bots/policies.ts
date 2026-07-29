import type { Rng } from '../../rules/rng.js';
import { isSpoke, landingOf, legalMoves, spokesOf } from '../rules/house.js';
import type { MorningAction, NightAction } from '../rules/night.js';
import type { PlayerId, RoomId } from '../rules/types.js';
import { type Bot, type Knowledge, STAY } from './types.js';

const go = (to: RoomId, extra: Partial<NightAction> = {}): NightAction =>
  ({ to, setDown: false, takeUp: 'none', take: true, ...extra });

const anywhere = (k: Knowledge, rng: Rng): RoomId =>
  rng.pick(legalMoves(k.config.house, k.position));

/**
 * Who is missing from the lit rooms.
 *
 * Odd Socks must spend nights in the dark: that is where they shed and the only
 * place they can take anyone. So absence from the morning rosters is the
 * signal. It is deliberately noisy — a child out searching spokes is absent for
 * exactly the same reason — and that noise is the game.
 */
export function suspicion(k: Knowledge): Map<PlayerId, number> {
  const out = new Map<PlayerId, number>();
  const eligible = (p: PlayerId) =>
    p !== k.me && k.alive.includes(p) && !k.cleared.includes(p);
  for (const p of k.alive) if (eligible(p)) out.set(p, 0);
  const bump = (p: PlayerId, n: number) => {
    if (eligible(p)) out.set(p, (out.get(p) ?? 0) + n);
  };

  // The strong signal. Odd Socks sheds wherever they sleep, so a sock on a lit
  // floor arrives beside that room's roster — everyone standing there is a
  // suspect. This is the inference the whole design is built to produce.
  for (const s of k.mySightings) {
    if (!s.lit || s.socksHere === 0) continue;
    for (const p of s.named) bump(p, 3);
  }

  // The weak prior: time spent out of the light. Kept small and deliberately
  // subordinate — on its own it is worse than guessing, because a villain who
  // simply never leaves the lit landings scores lowest of anyone. Measured at
  // 0.0% naming accuracy against exactly that line, where chance is ~20%.
  const seen = new Map<PlayerId, number>();
  for (const e of k.publicEvents) {
    if (e.t !== 'roster') continue;
    for (const p of e.who) seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  const nights = Math.max(1, k.night - 1);
  for (const p of k.alive) bump(p, (nights - (seen.get(p) ?? 0)) * 0.25);

  return out;
}

function topSuspect(k: Knowledge): PlayerId | null {
  const s = suspicion(k);
  let best: PlayerId | null = null;
  let bestScore = -Infinity;
  for (const [p, score] of s) if (score > bestScore) { best = p; bestScore = score; }
  return best;
}

/** Rooms this player has already lit and read, so has no reason to read again soon. */
function searched(k: Knowledge): Set<RoomId> {
  return new Set(k.mySightings.filter((s) => s.lit).map((s) => s.room));
}

function nearestBurning(k: Knowledge): RoomId | null {
  const reachable = legalMoves(k.config.house, k.position);
  for (const r of reachable) if ((k.burningAt[r] ?? 0) > 0) return r;
  return null;
}

// ---------------------------------------------------------------------------

/** Moves at random, takes when it can. The floor for every other policy. */
export const randomBot: Bot = {
  morning: () => STAY,
  night: (k, rng) => go(anywhere(k, rng)),
};

/**
 * DEGENERATE, AND MUST LOSE. The whole table moves as one block, agreed out
 * loud, and never splits. Three or more in a room is unconditionally take-proof,
 * so this drove the previous design's take rate to exactly zero, permanently.
 *
 * Under v6 it should lose instead: six bodies under one candle burn it down,
 * and the children are five of the six, so sheltering is what hands Odd Socks
 * the darkness win. If this policy ever wins, the spine has failed the same way
 * its predecessor did.
 */
export const huddleBot: Bot = {
  morning: () => STAY,
  night: (k) => {
    const [ground, first] = k.config.house.landings as readonly RoomId[];
    // A block cannot stand still — movement is mandatory — so it paces.
    const target = k.night % 2 === 1 ? first! : ground!;
    const legal = legalMoves(k.config.house, k.position);
    return go(legal.includes(target) ? target : landingOf(k.config.house, k.position));
  },
};

/**
 * The behaviour the design is built to reward: carry a lantern into a dark
 * spoke, set it down to read the floor, and walk the sock home. Every one of
 * those trips is a room that holds two, which is the take condition.
 */
export const searcherBot: Bot = {
  morning: (k) => {
    const hand = k.held;
    if (hand?.t !== 'socks' || hand.n !== 2) return STAY;
    return { name: topSuspect(k) };
  },
  night: (k, rng) => {
    const house = k.config.house;

    // A Naming stands and the Named has already shown their move. Answer it.
    // Two of us in that room corners them; one of us is supper. Without this
    // the children name correctly and then nobody turns up, which is how the
    // predecessor's capture managed to fire zero times in every configuration.
    if (k.namedTonight) {
      const shown = [...k.publicEvents].reverse()
        .find((e) => e.t === 'walksOpen' && e.player === k.namedTonight);
      if (shown && shown.t === 'walksOpen') {
        const reach = legalMoves(house, k.position);
        if (reach.includes(shown.to) || k.position === shown.to) return go(shown.to);
      }
    }

    if (isSpoke(house, k.position)) return go(landingOf(house, k.position)); // forced

    const hand = k.held;
    // Children talk each morning, so they can divide the house between them.
    // Without this they all reach for the same lantern, every take-up is
    // contested, nothing is ever lifted, and the policy silently collapses into
    // the huddle it is supposed to be the opposite of. Dealing out distinct
    // jobs — rather than a shared preference order — is what makes the split
    // real when only one lantern is in reach.
    const rank = Math.max(0, [...k.alive].sort().indexOf(k.me));
    const reach = legalMoves(house, k.position);
    const litSpokes = reach.filter((r) => isSpoke(house, r) && (k.burningAt[r] ?? 0) > 0);
    const darkSpokes = reach.filter((r) => isSpoke(house, r) && (k.burningAt[r] ?? 0) === 0);
    const lanterns = reach.filter((r) => (k.burningAt[r] ?? 0) > 0);
    const done = searched(k);

    // Holding a pair: get under a candle and stay countable until morning.
    if (hand?.t === 'socks' && hand.n === 2) {
      const lit = reach.filter((r) => (k.wax[r] ?? 0) > 0);
      return go(lit.length > 0 ? lit[rank % lit.length]! : anywhere(k, rng));
    }

    const jobs: NightAction[] = [];
    if (hand?.t === 'lantern') {
      // Carry the light into an unread room, set it down, read the floor.
      const fresh = darkSpokes.filter((r) => !done.has(r));
      for (const s of (fresh.length > 0 ? fresh : darkSpokes)) {
        jobs.push(go(s, { setDown: true, takeUp: 'sock' }));
      }
    } else {
      // Anywhere already lit can be read on arrival — and since Odd Socks sheds
      // wherever they sleep, the lit landings collect evidence on their own.
      // Reaching for the lantern instead of the sock is how this policy spent
      // whole games reading floors and lifting nothing.
      const litReach = reach.filter((r) => (k.wax[r] ?? 0) > 0 || (k.burningAt[r] ?? 0) > 0);
      const knownSocks = new Set(k.mySightings.filter((s) => s.socksHere > 0).map((s) => s.room));
      for (const r of litReach.filter((r) => knownSocks.has(r))) jobs.push(go(r, { takeUp: 'sock' }));
      for (const r of litReach) jobs.push(go(r, { takeUp: 'sock' }));
      for (const r of lanterns) jobs.push(go(r, { takeUp: 'lantern' }));  // fetch light
      for (const s of darkSpokes) jobs.push(go(s, { takeUp: 'sock' }));   // go and listen
    }
    return jobs.length > 0 ? jobs[rank % jobs.length]! : go(anywhere(k, rng));
  },
};

/**
 * Hunts. Spokes are where a child can be caught alone, and every dark night
 * sheds a sock — so this line buys takes and pays in evidence.
 */
export const hunterBot: Bot = {
  morning: () => STAY,
  night: (k, rng) => {
    const house = k.config.house;
    if (isSpoke(house, k.position)) return go(landingOf(house, k.position));
    const spokes = spokesOf(house, k.position);
    return go(spokes.length > 0 ? rng.pick(spokes) : anywhere(k, rng));
  },
};

/**
 * THE ASSUMPTION UNDER TEST (design §12). A villain who never leaves the
 * landings sheds nothing, is named on a roster every night alongside everybody
 * else, and simply waits for the candles to die.
 *
 * The design argues this cannot dominate, because such a villain never takes
 * anyone and the children answer it by emptying the landings — starving the
 * burn to its base rate. That is an argument, not a measurement, and this
 * project has been wrong exactly this way before.
 */
export const lightVillainBot: Bot = {
  morning: () => STAY,
  night: (k, rng) => {
    const house = k.config.house;
    if (isSpoke(house, k.position)) return go(landingOf(house, k.position));
    const stairs = legalMoves(house, k.position).filter((r) => !isSpoke(house, r));
    return go(stairs.length > 0 ? rng.pick(stairs) : anywhere(k, rng));
  },
};

export const CHILD_POLICIES = { random: randomBot, huddle: huddleBot, searcher: searcherBot } as const;
export const VILLAIN_POLICIES = { random: randomBot, hunter: hunterBot, light: lightVillainBot } as const;
export type ChildPolicy = keyof typeof CHILD_POLICIES;
export type VillainPolicy = keyof typeof VILLAIN_POLICIES;
