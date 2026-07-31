import { Container, Graphics, Text } from 'pixi.js';
import type { ActorId } from '../core/events';
import { lightAt, visibilityAt, type Visibility } from '../core/light';
import { ACTOR_RADIUS, type Sim } from '../core/sim';

export interface ActorAppearance {
  visibility: Visibility; showName: boolean; saturation: number; alpha: number;
}

const PYJAMAS: Record<string, number> = {
  bell: 0xd98a8a, pike: 0x8ab6d9, clem: 0xd9c98a,
  wren: 0x9ad98a, sparrow: 0xc08ad9, moss: 0x8ad9c4,
};

/** v12.2 §4 ("A night" > "In the dark"): in deep darkness names vanish,
 *  pyjama colours wash out, faces disappear and outlines get fuzzy — but
 *  "you can still hear footsteps". So darkness must degrade a target to a
 *  silhouette, never to nothing. (Not §9 — §9 is Ghosts, an unrelated
 *  post-death head-count mechanic with no bearing on a living player's own
 *  view. This function's first draft carried the same stale §9 citation
 *  already flagged and deferred against core/light.ts's visibilityAt in the
 *  Task 4 ledger entry — fixed here, since this file exists specifically to
 *  serve §4.)
 *
 *  This function reads core's lightAt/visibilityAt and nothing else decides
 *  visibility here — the threshold lives in core/light.ts so a later
 *  networked slice's server can apply the identical rule authoritatively; a
 *  second copy of the threshold in this file is a copy that will drift.
 *  test/actors-visibility.test.ts's boundary test pins that claim directly
 *  (a version of this function that hardcodes its own threshold instead of
 *  calling visibilityAt passes every other test in that file unchanged —
 *  see task-10-report.md for the mutation evidence). */
export function appearanceOf(
  sim: Sim, observerId: ActorId, targetId: ActorId,
): ActorAppearance {
  const observer = sim.state.actors.find(a => a.id === observerId);
  const target = sim.state.actors.find(a => a.id === targetId);
  if (!observer || !target || observer.room !== target.room) {
    return { visibility: 'unseen', showName: false, saturation: 0, alpha: 0 };
  }
  const level = lightAt(
    sim.state.night, target.room, target.at, sim.lightSources(), sim.darkRooms);
  const visibility = visibilityAt(level);
  return {
    visibility,
    showName: visibility === 'identified',
    // Upper-clamped even though today's constants never reach it: a
    // silhouette's level is always < IDENTIFY_THRESHOLD (0.45), so
    // level*1.2 < 0.54 < 1 always, and this clamp is dead code today. Left
    // in anyway: an unclamped mix "amount" over 1 doesn't just look
    // over-saturated — desaturate()'s per-channel Math.round(grey +
    // (c-grey)*amount) can land outside a channel's 0-255 range, and the
    // bit-shifted pack ((mix(r)<<16)|(mix(g)<<8)|mix(b)) then corrupts
    // neighbouring channel bits rather than merely clipping. One-line
    // defensive clamp against a future retune of the threshold or the 1.2
    // multiplier; not a live bug today (task-10-report.md has the numbers).
    saturation: visibility === 'identified' ? 1 : Math.min(Math.max(level * 1.2, 0.15), 1),
    // 'unseen' can't actually reach here: lightAt's floor is the darkest
    // ambient-table entry (0.06, night six), never 0, so visibilityAt's
    // level>0 branch always holds once the early return above has passed.
    // Kept rather than deleted, for the same reason Task 9 kept
    // render/lighting.ts's MAX_OVERLAY outer clamp: harmless, and cheap
    // insurance against a future ambient-table change that lowers the floor
    // toward 0.
    alpha: visibility === 'unseen' ? 0 : Math.max(0.45, Math.min(level + 0.45, 1)),
  };
}

function desaturate(colour: number, amount: number): number {
  const r = (colour >> 16) & 0xff, g = (colour >> 8) & 0xff, b = colour & 0xff;
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c: number) => Math.round(grey + (c - grey) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** Z-ORDER DECISION (Task 10 — nothing enforced this before now; Task 9's
 *  ledger entry logged it as an "OPEN QUESTION for Task 10/11"):
 *
 *  Actor bodies and names composite ABOVE render/lighting.ts's darkness
 *  overlay. Whatever wires the scene (Task 11) must `world.addChild()` this
 *  function's `layer`/`nameLayer` AFTER the lighting layer's own Graphics,
 *  not before. This is not a style preference — it's required for
 *  appearanceOf's "never to nothing" guarantee to survive compositing, not
 *  just hold as data:
 *
 *  Worked example, night six, unlit room, no lantern (this file's own
 *  darkest test fixture): render/lighting.ts's overlayAlphaFor(6, room,
 *  dark) = 0.8648, painted in near-black (0x05040a). A silhouette there
 *  renders at alpha 0.51 (appearanceOf's `alpha` field, above). If the
 *  overlay painted AFTER (on top of) the actor instead, standard
 *  over-compositing leaves only (1 - 0.8648) = 13.5% of the actor's own
 *  pixel surviving in the final frame — a silhouette that's supposed to
 *  never disappear would be visually swallowed to a sliver by the very
 *  overlay that's separately capped to keep the room's own silhouette
 *  legible. Painting actors AFTER the overlay avoids this: the actor's
 *  alpha and colour are what the viewer actually sees, composited over an
 *  already-dark room — which is what "silhouette" is supposed to mean.
 *
 *  Doors: this file doesn't draw them and isn't touching drawRooms, but the
 *  same argument applies with more force, because v12.2 §3 makes door
 *  legibility unconditional ("They never hide where the doors are") where
 *  the darkness rule for identity is not. Today that guarantee rests on
 *  drawLighting only ever painting room.bounds, never the inter-room GAP a
 *  door straddles (Task 9's report, and the cross-references at
 *  house/hollow.ts's GAP and render/lighting.ts's paint loop) — an accident
 *  of geometry, not a decision. Recommending, for Task 11's wiring: put
 *  drawRooms' door layer above the lighting overlay too, the same way
 *  actors are here. That turns an accidental, geometry-dependent protection
 *  into a structural one and retires the fragility Task 9 flagged, at zero
 *  cost — nothing in v12.2 says a door should darken. See the matching note
 *  left at render/lighting.ts's drawLighting.
 *
 *  Full recommended stack, bottom to top:
 *    floor -> lighting overlay -> doors -> room labels -> actor bodies
 *    (this function's `layer`) -> actor names (`nameLayer`)
 *  Room labels' position relative to the overlay is NOT decided here — the
 *  rules don't say whether a room's placeholder name/object label should
 *  wash out in the dark the way a face does, or stay legible the way a door
 *  must, and Task 9 already draws them above doors today; nothing here
 *  changes that. Only the overlay-vs-actors relationship (this function's
 *  own layers, decided) and the overlay-vs-doors relationship (a
 *  recommendation, not a code change — drawRooms/drawLighting aren't this
 *  task's files) are addressed. */
export function drawActors(
  layer: Graphics, nameLayer: Container, sim: Sim, observerId: ActorId,
): void {
  layer.clear();
  nameLayer.removeChildren();
  for (const actor of sim.state.actors) {
    if (!actor.alive) continue;
    // You always know your own body — a UI convenience, not a rule
    // citation. v12.2 §4 only ever describes how darkness looks to an
    // OBSERVER looking at someone else.
    const look = actor.id === observerId
      ? { visibility: 'identified' as const, showName: true, saturation: 1, alpha: 1 }
      : appearanceOf(sim, observerId, actor.id);
    if (look.alpha === 0) continue;

    const base = PYJAMAS[actor.id] ?? 0xcccccc;
    layer.circle(actor.at.x, actor.at.y, ACTOR_RADIUS);
    layer.fill({ color: desaturate(base, look.saturation), alpha: look.alpha });
    layer.circle(actor.at.x, actor.at.y, ACTOR_RADIUS);
    layer.stroke({ color: 0x3a2b33, width: 2, alpha: look.alpha });

    if (look.showName) {
      const t = new Text({ text: actor.id, style: { fill: 0xf0e6d8, fontSize: 13 } });
      t.x = actor.at.x - t.width / 2;
      t.y = actor.at.y - ACTOR_RADIUS - 18;
      nameLayer.addChild(t);
    }
  }
}
