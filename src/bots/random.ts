import type { Rng } from '../rules/rng.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';
import { legalPaths } from '../rules/map.js';
import type { Bot, Knowledge } from './types.js';

/**
 * Uniform legal play. Its job is to prove the engine never crashes and to give
 * every metric a baseline that involves no strategy whatsoever.
 */
export const randomBot: Bot = {
  dusk(k: Knowledge, rng: Rng): DuskAction {
    return { path: rng.pick(legalPaths(k.config.house, k.position)), pickUp: true };
  },

  midnight(k: Knowledge, rng: Rng): MidnightAction {
    return {
      path: rng.pick(legalPaths(k.config.house, k.position)),
      joinCall: k.held.length > 0 && rng.next() < 0.5,
      snuffOwn: false,
    };
  },

  morning(k: Knowledge, _rng: Rng): MorningAction {
    return { claim: k.position, call: null, itemUses: [] };
  },
};
