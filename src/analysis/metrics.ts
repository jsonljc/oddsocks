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
  thefts: number;
  /** Self-snuffs included in `thefts`; recoverable only from the omniscient record. */
  selfSnuffs: number;
  /** Active nights that produced no light going out at all. */
  markings: number;
  meanItemHolders: number;
  encounterRate: number;
}

export function measure(record: GameRecord): GameMetrics {
  const { forcedNight, hidingSpace } = solve(record);

  let trailNamings = 0, trailHits = 0;
  let callsPosted = 0, callsLive = 0, callsCaught = 0;
  let thefts = 0;
  let holderTotal = 0;

  let sharedRooms = 0, roomSlots = 0;

  for (const night of record.nights) {
    const held = new Set<string>();
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
          break;
        case 'theft': thefts++; break;
        case 'itemTaken': held.add(e.player); break;
        default: break;
      }
    }
    holderTotal += held.size;

    const occupancy = new Map<RoomId, number>();
    for (const room of Object.values(night.midnightPositions)) {
      occupancy.set(room, (occupancy.get(room) ?? 0) + 1);
    }
    roomSlots += Object.keys(record.config.house.rooms).length;
    for (const n of occupancy.values()) if (n >= 2) sharedRooms++;
  }

  // A self-snuff is publicly just a theft, so `thefts` already counts it. From the
  // omniscient record we can still tell them apart: a self-snuff is the one whose
  // victim is the villain. A marking is an active night that produced no light at all.
  const selfSnuffs = record.nights.filter((n) =>
    n.events.some((e) => e.t === 'theft' && e.victim === record.villain)).length;
  const activeNights = Math.max(0, record.nights.length - 1);
  const markings = Math.max(0, activeNights - thefts);

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
    thefts,
    selfSnuffs,
    markings,
    meanItemHolders: record.nights.length > 0 ? holderTotal / record.nights.length : 0,
    encounterRate: roomSlots > 0 ? sharedRooms / roomSlots : 0,
  };
}
