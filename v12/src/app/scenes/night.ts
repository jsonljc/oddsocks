import { Container, Graphics } from 'pixi.js';
import { audibleVolume, playCue, soundFor } from '../../audio/sounds';
import { nearestDoor } from '../../core/house';
import { applyLanternAction } from '../../core/lantern';
import { createSim, DT, type Actor, type Input, type Sim } from '../../core/sim';
import { HOLLOW } from '../../house/hollow';
import { drawActors } from '../../render/actors';
import { drawLighting } from '../../render/lighting';
import { drawRooms } from '../../render/rooms';
import type { Stage } from '../../render/stage';
import { createStalker, type Stalker } from '../../scripted/stalker';
import { createInput, type UiAction } from '../input';

const PLAYER = 'bell';
const STALKER = 'wren';
const IDS = [PLAYER, 'pike', 'clem', STALKER, 'sparrow', 'moss'];

/** The one place the scene translates a keypress into a rule. Every branch
 *  calls a core action that already validates itself, so an illegal press is
 *  a no-op rather than a special case here.
 *
 *  Takes the whole `actor`, not just its room, because `nearestDoor` needs a
 *  position too — see below. Earlier (brief) version took `room: string` and
 *  always resolved `exitsOf(HOLLOW, room)[0]`, the FIRST exit in
 *  `house.doors`' declaration order, regardless of where the player actually
 *  stood; fixed by routing both the 'door' and 'place' branches through
 *  `nearestDoor` instead (core/house.ts, new in this task — see the report
 *  and test/house.test.ts). Controls describe 'F' as toggling "the nearest
 *  door"; this makes that literally true rather than true only in
 *  single-exit rooms and lucky three-door ones. */
function dispatch(sim: Sim, actor: Actor, action: UiAction): void {
  switch (action) {
    case 'hide':
      sim.beginHide(actor.id);
      break;
    case 'door': {
      const door = nearestDoor(HOLLOW, actor.room, actor.at);
      if (door) sim.toggleDoor(actor.id, door.id);
      break;
    }
    case 'interact': {
      const held = sim.state.lanterns.find(
        l => l.state.kind === 'held' && l.state.by === actor.id);
      if (held) break;
      const here = sim.state.lanterns.find(
        l => l.state.kind === 'placed' && l.state.room === actor.room);
      if (here) applyLanternAction(sim, actor.id, { kind: 'pickup', lantern: here.id });
      break;
    }
    case 'place': {
      const door = nearestDoor(HOLLOW, actor.room, actor.at);
      if (door) applyLanternAction(sim, actor.id, { kind: 'place', watching: door.id });
      break;
    }
    default:
      break;
  }
}

export function runNightScene(stage: Stage, seed: number, night: number): void {
  const sim = createSim(HOLLOW, seed, IDS);
  sim.state.night = night;
  const input = createInput(window);

  // Every non-player actor gets its own seeded wanderer so the house isn't
  // full of statues standing at their spawn point all night — without this,
  // criterion 3 ("hear someone move in an adjacent room") would have at most
  // ONE other moving body across twelve rooms, and a tester would read
  // silence as broken cross-room audio rather than as an empty house.
  // (Found empirically: the brief's own reference scene built `inputs` with
  // only PLAYER and STALKER entries; `Sim.step` silently skips any actor
  // with no entry in the map, so the other four never moved, never stepped,
  // and never emitted a sound at all.)
  //
  // Only STALKER's `tickBehaviour` is ever called — the other four consume
  // `nextInput` for movement only, so they patrol but never attempt a Take.
  // Rules: one Odd Sock.
  const wanderers = new Map<string, Stalker>(
    IDS.filter(id => id !== PLAYER)
      .map((id, i) => [id, createStalker(HOLLOW, id, seed ^ (0x5eed + i))] as const),
  );
  const stalker = wanderers.get(STALKER)!;

  // Z-ORDER (decided in render/actors.ts and render/lighting.ts; adopted
  // here): floor -> lighting overlay -> doors -> room labels -> actor bodies
  // -> actor names, bottom to top. `drawRooms` returns its three layers
  // unattached specifically so the lighting layer can be interleaved between
  // `floor` and `doors` — see render/rooms.ts's docstring for why that used
  // to be impossible without this restructuring.
  const rooms = drawRooms(HOLLOW);
  stage.world.addChild(rooms.floor);

  const lighting = new Graphics();
  stage.world.addChild(lighting);

  stage.world.addChild(rooms.doors, rooms.labels);

  const actors = new Graphics();
  const names = new Container();
  stage.world.addChild(actors, names);

  // Absorbs ordinary frame jitter without letting a long real-world gap
  // replay as a burst of simulated ticks. Found empirically while verifying
  // this task in a browser: a backgrounded tab's requestAnimationFrame can
  // be suspended for seconds to indefinitely (measured directly — 0 rAF
  // callbacks in 500ms — see the report), so on resume `ticker.deltaMS`
  // reflects the whole gap. Uncapped, the `while` loop below would replay
  // that entire gap as consecutive ticks in one synchronous burst — which
  // could complete an ENTIRE in-progress Take (its 1s warning and 3s
  // duration both) with zero real-world reaction time the instant the tab
  // regains focus, the exact opposite of v12.2 §4's "you get a warning
  // first... a real one." Capped at 15 ticks (0.5s) of catch-up: generous
  // for a dropped frame or two, nowhere near enough to swallow a whole Take.
  const MAX_CATCHUP = DT * 15;
  let accumulator = 0;
  let lastAction: string | null = null;

  stage.app.ticker.add(ticker => {
    accumulator = Math.min(accumulator + ticker.deltaMS / 1000, MAX_CATCHUP);
    while (accumulator >= DT) {
      accumulator -= DT;
      const mine = input.read();

      // Edge-triggered: fire once per press, not once per tick.
      if (mine.action !== lastAction) {
        const me = sim.state.actors.find(a => a.id === PLAYER);
        if (me && mine.action) dispatch(sim, me, mine.action);
        lastAction = mine.action;
      }

      const inputs = new Map<string, Input>();
      inputs.set(PLAYER, mine);
      for (const [id, w] of wanderers) inputs.set(id, w.nextInput(sim));
      sim.step(inputs);
      stalker.tickBehaviour(sim);

      const listener = sim.state.actors.find(a => a.id === PLAYER);
      for (const e of sim.drain()) {
        const cue = soundFor(e);
        if (cue && listener) playCue(cue, audibleVolume(e, listener.room, HOLLOW));
      }
    }
    drawLighting(lighting, HOLLOW, sim.state.night, sim.lightSources(), sim.darkRooms);
    drawActors(actors, names, sim, PLAYER);
    const me = sim.state.actors.find(a => a.id === PLAYER);
    if (me) stage.centreOn(me.at);
  });
}
