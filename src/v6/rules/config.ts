import { HOLLOW_20, SCALES, makeHouse, rosterFor } from './house.js';
import type { House, PlayerId } from './types.js';

export interface GameConfig {
  readonly house: House;
  readonly roster: readonly PlayerId[];

  /**
   * Wax per landing, ground floor first. Staggered so the house darkens from
   * the top down and the lit space shrinks — a schedule everyone can see.
   * A candle loses one a night plus one per occupant, and nothing but Sasha
   * ever puts wax back: the clock is monotone by design. Paying the children
   * for quiet nights inverts the incentive and rebuilds the stalemate.
   */
  readonly startingWax: readonly number[];

  readonly lanterns: number;

  /**
   * Derived, not tuned: a Corner needs two children in a room, so once one
   * child remains capture is already impossible. Takes needed = children - 1.
   */
  readonly takeTarget: number;

  /** Cuts off a stalled simulation. Reaching it is itself a finding. */
  readonly maxNights: number;
}

export function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  const players = overrides.roster?.length ?? 6;
  const house = overrides.house ?? (players === 6 ? HOLLOW_20 : makeHouse(SCALES[players] ?? SCALES[6]!));
  const roster = overrides.roster ?? rosterFor(players);
  const base: GameConfig = {
    house,
    roster,
    // Tuned, not guessed. 17/13/9 ran 6.1 nights and left the children at
    // 30/45/46 against the three villain lines; this runs 7.3 and gives
    // 41/66/60, inside the 7-9 target with the villain's best line — simply
    // staying in the light — still ahead. More wax monotonically favours the
    // children, since every extra night is another night to work the trail.
    startingWax: [25, 19, 13],
    lanterns: 3,
    takeTarget: roster.length - 2,
    maxNights: 40,
  };
  return { ...base, ...overrides, house, roster };
}

export const DEFAULT_CONFIG: GameConfig = makeConfig();
