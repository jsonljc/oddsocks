import type { Rng } from './rng.js';
import type { Path, PlayerId, RoomId } from './types.js';
import type { PostedCall, PublicEvent, Sighting } from './state.js';
import { type GameState, canClaim } from './state.js';
import { resolveMovement } from './movement.js';
import { sightingsAt } from './visibility.js';
import { resolveTheft, type TheftOutcome } from './theft.js';
import { resolveMarking } from './marking.js';
import { spawnItems, resolvePickups, processReturns } from './items.js';
import { applyItemUses, resolveBellWatch, clearNightlyItemEffects, type ItemUse } from './itemEffects.js';
import { canPostCall, postCall, resolveCall } from './call.js';
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

  return { positions: moved.positions, steps: moved.steps, events, sightings, theft, marked, caught };
}

export function runMorning(
  state: GameState,
  _dusk: DuskResult,
  midnight: MidnightResult,
  actions: Readonly<Record<PlayerId, MorningAction>>,
  _rng: Rng,
): { events: PublicEvent[]; claims: Record<PlayerId, RoomId | null>; reporters: PlayerId[] } {
  clearNightlyItemEffects(state);
  state.activeCall = null;

  const events: PublicEvent[] = [];
  const claims: Record<PlayerId, RoomId | null> = {};

  // The Hush's second half: a snuffed child can no longer report what they saw,
  // not just where they slept. Under R15 every child who still can, does, truthfully
  // and without a budget — so a report is simply that child's sighting, made public.
  const reporters: PlayerId[] = [];
  for (const p of state.config.roster) {
    const speaks = canClaim(state, p);
    claims[p] = speaks ? actions[p]!.claim : null;
    if (speaks) {
      const s = midnight.sightings[p]!;
      reporters.push(p);
      events.push({
        t: 'reported', player: p, room: s.room, named: s.named,
        others: s.others, lit: s.lit, night: state.night,
      });
    }
    events.push(...applyItemUses(state, actions[p]!.itemUses));
  }

  let posted = 0;
  for (const p of state.config.roster) {
    const call = actions[p]!.call;
    // A bot proposing an illegal room (common, or a bedroom already dark) is a
    // strategy error, not a caller bug — skip it silently, and don't let it
    // consume the maxCallsPerNight slot a legal Call from someone else could use.
    if (call && posted < state.config.maxCallsPerNight && canPostCall(state, call.target, call.room)) {
      events.push(...postCall(state, call));
      posted++;
    }
  }

  return { events, claims, reporters };
}
