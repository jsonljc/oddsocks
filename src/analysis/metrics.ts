import type { GameRecord } from '../rules/game.js';
import type { RoomId } from '../rules/types.js';
import { solve } from './safeLies.js';

export interface GameMetrics {
  winner: 'children' | 'oddsocks';
  how: 'caught' | 'survived' | 'lightsOut';
  nights: number;
  forcedNight: number | null;
  hidingSpace: number[];
  trailNamings: number;
  trailHits: number;
  callsPosted: number;
  callsLive: number;
  callsCaught: number;
  /** Live Calls whose target simply went elsewhere — spec §6.2 #7's dodge. */
  dodges: number;
  thefts: number;
  /** Self-snuffs included in `thefts`; recoverable only from the omniscient record. */
  selfSnuffs: number;
  /** Nights the villain marked somebody. */
  markings: number;
  /** Mean size of the pool that could physically join a Call, per night. */
  meanCallPool: number;
  encounterRate: number;
}

export function measure(record: GameRecord): GameMetrics {
  const { forcedNight, hidingSpace } = solve(record);

  let trailNamings = 0, trailHits = 0;
  let callsPosted = 0, callsLive = 0, callsCaught = 0, dodges = 0;
  let thefts = 0;
  let poolTotal = 0;

  let sharedRooms = 0, roomSlots = 0;

  for (const night of record.nights) {
    for (const e of night.events) {
      switch (e.t) {
        case 'trail':
          trailNamings++;
          if (e.player === record.villain) trailHits++;
          break;
        case 'callPosted': callsPosted++; break;
        case 'callResolved':
          if (e.outcome !== 'fizzled') callsLive++;
          if (e.outcome === 'caught') callsCaught++;
          if (e.outcome === 'noShow') dodges++;
          break;
        case 'theft': thefts++; break;
        default: break;
      }
    }
    poolTotal += night.callPool.length;

    const occupancy = new Map<RoomId, number>();
    for (const room of Object.values(night.midnightPositions)) {
      occupancy.set(room, (occupancy.get(room) ?? 0) + 1);
    }
    roomSlots += Object.keys(record.config.house.rooms).length;
    for (const n of occupancy.values()) if (n >= 2) sharedRooms++;
  }

  // A self-snuff is publicly just a theft, so `thefts` already counts it. From the
  // omniscient record we can still tell them apart: a self-snuff is the one whose
  // victim is the villain.
  const selfSnuffs = record.nights.filter((n) =>
    n.events.some((e) => e.t === 'theft' && e.victim === record.villain)).length;

  // Read markings off the record, never as `activeNights - thefts`. There is a
  // third option, and it is the common one: the villain ends midnight somewhere
  // that offers neither a lit bedroom to rob nor a dark room with company, and
  // the night simply passes. The subtraction counted all of those as markings.
  const markings = record.nights.filter((n) => n.marked !== null).length;

  return {
    winner: record.outcome.winner,
    how: record.outcome.how,
    nights: record.nights.length,
    forcedNight,
    hidingSpace,
    trailNamings,
    trailHits,
    callsPosted,
    callsLive,
    callsCaught,
    dodges,
    thefts,
    selfSnuffs,
    markings,
    meanCallPool: record.nights.length > 0 ? poolTotal / record.nights.length : 0,
    encounterRate: roomSlots > 0 ? sharedRooms / roomSlots : 0,
  };
}
