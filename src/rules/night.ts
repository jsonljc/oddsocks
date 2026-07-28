import type { Rng } from './rng.js';
import type { Path, PlayerId, RoomId } from './types.js';
import type { PostedCall, PublicEvent, Sighting } from './state.js';
import { type GameState, canClaim, isLit } from './state.js';
import { resolveMovement } from './movement.js';
import { sightingsAt } from './visibility.js';
import { resolveTheft, type TheftOutcome } from './theft.js';
import { resolveMarking } from './marking.js';
import { spawnItems, resolvePickups, processReturns } from './items.js';
import { applyItemUses, resolveBellWatch, clearNightlyItemEffects, type ItemUse } from './itemEffects.js';
import { canJoinCall, canPostCall, postCall, resolveCall } from './call.js';
import { resolveOddities } from './oddities.js';

export interface DuskAction { path: Path; pickUp: boolean }
export interface MidnightAction { path: Path; joinCall: boolean; snuffOwn: boolean }
export interface MorningAction {
  claim: RoomId | null;
  call: PostedCall | null;
  itemUses: ItemUse[];
}

export interface DuskResult {
  startPositions: Record<PlayerId, RoomId>;
  positions: Record<PlayerId, RoomId>;
  steps: Record<PlayerId, [RoomId, RoomId]>;
  events: PublicEvent[];
  sightings: Record<PlayerId, Sighting>;
}

export interface MidnightResult {
  positions: Record<PlayerId, RoomId>;
  steps: Record<PlayerId, [RoomId, RoomId]>;
  events: PublicEvent[];
  sightings: Record<PlayerId, Sighting>;
  theft: TheftOutcome;
  marked: PlayerId | null;
  caught: boolean;
  /** Who could have joined tonight's Call, taken before one spends their items. */
  callPool: PlayerId[];
}

const NO_THEFT: TheftOutcome = { stole: false, selfSnuff: false, victim: null, room: null, events: [] };

export function runDusk(
  state: GameState,
  actions: Readonly<Record<PlayerId, DuskAction>>,
  rng: Rng,
): DuskResult {
  const startPositions = { ...state.positions };
  processReturns(state);

  const events: PublicEvent[] = [...spawnItems(state, rng)];

  const paths: Record<PlayerId, Path> = {};
  const wants: Record<PlayerId, boolean> = {};
  for (const p of state.config.roster) {
    paths[p] = actions[p]!.path;
    wants[p] = actions[p]!.pickUp;
  }

  const moved = resolveMovement(state.config.house, state.positions, paths);
  state.positions = moved.positions;
  events.push(...resolvePickups(state, moved.positions, wants, rng));

  return {
    startPositions,
    positions: moved.positions,
    steps: moved.steps,
    events,
    sightings: sightingsAt(state, moved.positions),
  };
}

export function runMidnight(
  state: GameState,
  dusk: DuskResult,
  actions: Readonly<Record<PlayerId, MidnightAction>>,
  rng: Rng,
): MidnightResult {
  const paths: Record<PlayerId, Path> = {};
  for (const p of state.config.roster) paths[p] = actions[p]!.path;

  // 1. Movement.
  const moved = resolveMovement(state.config.house, state.positions, paths);
  state.positions = moved.positions;
  const events: PublicEvent[] = [];

  const active = state.night > 1;

  // The pool a Call can draw on, read before one resolves and spends the items
  // out of it. Marking is what removes a hand from here, and tonight's marking
  // has not happened yet — which is right, since a Call resolves first.
  const callPool = state.config.roster.filter((p) => canJoinCall(state, p));

  // 2. Calls — before the theft, so a landed trap saves the light.
  let caught = false;
  if (active && state.activeCall) {
    const joiners = state.config.roster.filter((p) => actions[p]!.joinCall);
    const call = resolveCall(state, moved.positions, joiners, rng);
    events.push(...call.events);
    caught = call.caught;
  }

  // 3. The villain's action.
  let theft: TheftOutcome = NO_THEFT;
  let marked: PlayerId | null = null;
  if (active && !caught) {
    theft = resolveTheft(state, moved.positions, actions[state.villain]!.snuffOwn, rng);
    events.push(...theft.events);
    if (!theft.stole) {
      marked = resolveMarking(state, moved.positions, rng).marked;
    }
  }

  events.push(...resolveBellWatch(state, moved.positions));

  // 4. Sightings, against post-theft lighting.
  const sightings = sightingsAt(state, moved.positions);

  events.push(...resolveOddities(state, {
    startPositions: dusk.startPositions,
    duskPositions: dusk.positions,
    midnightPositions: moved.positions,
    duskSteps: dusk.steps,
    midnightSteps: moved.steps,
    theftRoom: theft.room,
    thiefDuskRoom: theft.stole ? (dusk.positions[state.villain] ?? null) : null,
  }));

  return {
    positions: moved.positions, steps: moved.steps, events, sightings,
    theft, marked, caught, callPool,
  };
}

/**
 * What one child says they saw, or `null` if there is nothing for them to say.
 *
 * R15 binds **innocents**: every one who still can reports, truthfully and
 * without a budget, so their report is simply their sighting made public.
 *
 * The villain is outside R15, and R19 keeps the engine from applying it to them
 * anyway: their report carries the room they *claimed* — never the room they
 * were in — and names nobody. Publishing their sighting handed the table the
 * robbed room on every theft night, a report that contradicted their own claim
 * most mornings, and dark-room names only they and Wren can produce. Dropping
 * them from the loop instead is worse, not better: on night one nobody is
 * Hushed, so the one child who said nothing would be the villain outright.
 * Build one models no *content* for a villain's testimony — `MorningAction` has
 * no "what I saw" field, and inventing one needs the liar AI §6.1 exists to
 * avoid — so they say where they slept and stop there.
 */
function reportOf(
  state: GameState,
  player: PlayerId,
  claim: RoomId | null,
  sighting: Sighting,
): Extract<PublicEvent, { t: 'reported' }> | null {
  if (player !== state.villain) {
    return {
      t: 'reported', player, room: sighting.room, named: sighting.named,
      others: sighting.others, lit: sighting.lit, night: state.night,
    };
  }
  if (claim === null) return null;
  return {
    t: 'reported', player, room: claim, named: [], others: 0,
    lit: isLit(state, claim), night: state.night,
  };
}

export function runMorning(
  state: GameState,
  _dusk: DuskResult,
  midnight: MidnightResult,
  actions: Readonly<Record<PlayerId, MorningAction>>,
  rng: Rng,
): { events: PublicEvent[]; claims: Record<PlayerId, RoomId | null>; reporters: PlayerId[] } {
  clearNightlyItemEffects(state);
  state.activeCall = null;

  const events: PublicEvent[] = [];
  const claims: Record<PlayerId, RoomId | null> = {};

  // The Hush's second half: a snuffed child can no longer report what they saw,
  // not just where they slept.
  const reporters: PlayerId[] = [];
  for (const p of state.config.roster) {
    const speaks = canClaim(state, p);
    const claim = speaks ? actions[p]!.claim : null;
    claims[p] = claim;

    const report = speaks ? reportOf(state, p, claim, midnight.sightings[p]!) : null;
    if (report) {
      reporters.push(p);
      events.push(report);
    }
    events.push(...applyItemUses(state, actions[p]!.itemUses));
  }

  // Every legal proposal this morning, gathered before any of them post. A
  // caller proposing an illegal room (common, or a bedroom already dark) is a
  // strategy error and is dropped here rather than competing for the slot.
  // Who wins a scarce slot among the rest is then a fair draw — picking in
  // ROSTER order instead let whichever player is index 0 win every tie by
  // construction, silently discarding every other legal Call (including a
  // human player's) for as long as that one caller kept proposing.
  const legalCalls = state.config.roster
    .map((p) => actions[p]!.call)
    .filter((call): call is PostedCall => call !== null && canPostCall(state, call.target, call.room));

  for (const call of rng.shuffle(legalCalls).slice(0, state.config.maxCallsPerNight)) {
    events.push(...postCall(state, call));
  }

  return { events, claims, reporters };
}
