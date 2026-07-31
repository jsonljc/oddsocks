import { roomById, type House } from '../core/house';
import type { HouseProjection } from './project';

// v12.2 §8's floor numbering, pinned against house/hollow.ts: floor 1 is the
// upper floor (nursery, music_room, bathroom, attic, playroom, study), floor
// 0 is the ground floor (shared_bedroom, hearth, kitchen, cellar, library,
// conservatory) — confirmed by reading HOLLOW's room list directly, not
// assumed from the index order below.
const FLOOR_WORD = ['downstairs', 'upstairs'] as const;

/** v12.2 §8 — the house reports facts, never opinions, in this order:
 *  who didn't come back, how many flames are left, what the lanterns saw,
 *  which socks got secured, which rooms were disturbed, which floor a noise
 *  came from, whether the children crowded together.
 *
 *  It takes a HouseProjection and nothing else. That type carries no identity
 *  but didNotReturn, so §8's voice rule — "the house never says anything that
 *  depends on who someone is" — holds by construction: there is no ActorId in
 *  scope here to leak, for any line but the one §8 explicitly grants. */
export function renderReport(p: HouseProjection, house: House): string[] {
  const lines: string[] = [];
  const name = (id: string) => roomById(house, id).name;

  for (const child of p.didNotReturn) {
    lines.push(`${child} did not return.`);
  }

  // §8 lists "how many flames are left" among the things the house reads out
  // EVERY morning, not only on a night one went out — so this line is
  // unconditional. A quiet night that silently omitted the count would let
  // the children lose track of the clock (the whole point of the flame
  // economy, per §7/§13). This push always running first is why the
  // "nothing happened" fallback below can use `lines.length === 1` as PART
  // of its check — but not the whole of it; see the guard at that site for
  // why `flamesLost === 0` also has to hold.
  lines.push(
    p.flamesLost === 0 ? `No flame went out. ${p.flamesRemaining} remain.`
    : p.flamesLost === 1 ? `One flame went out. ${p.flamesRemaining} remain.`
    : `${p.flamesLost} flames went out. ${p.flamesRemaining} remain.`);

  // v12.2 §5 — "what the lanterns saw": numbers and rooms, never names.
  // `outward` and `hurried` are deliberately unread here — see the comment at
  // their construction site in project.ts. They are OPTIONAL and absent, not
  // populated stubs (slice-0/1 final review, item 7 — they used to default
  // to 0/false, which is itself a falsehood: "0 outward crossings" and
  // "movement was calm" are claims, not "not computed"), so there is nothing
  // here for this loop to read even by accident. Not a gap this task should
  // silently paper over by inventing text for them.
  for (const rec of p.lanternRecords) {
    const head = `The ${name(rec.room)} lantern`;
    lines.push(rec.crossings === 0
      ? `${head} watched an empty doorway.`
      : `${head} watched ${rec.crossings === 1 ? 'one figure' : `${rec.crossings} figures`} cross.`);
    if (rec.moved) lines.push(`${head} was moved.`);
  }

  if (p.socksSecured > 0) {
    lines.push(p.socksSecured === 1
      ? 'One sock was secured.'
      : `${p.socksSecured} socks were secured.`);
  }

  // Unlike the crowd line below, naming the room here is exactly what §8
  // asks for ("which rooms were disturbed") — this line and the crowd line
  // are governed by different clauses of §8, not an inconsistency to
  // reconcile.
  for (const room of p.roomsDisturbed) {
    lines.push(`Something was disturbed in the ${name(room)}.`);
  }

  // Phrasing choice: §8's own flavour blockquote says "noise" ("A noise came
  // from upstairs"), but nothing in the rule TEXT mandates that word, and the
  // report's own reading order is verified by searching for the substring
  // "sound" (see test/report.test.ts's "reads out in v12.2 §8 order" — the
  // brief's sample implementation used "noise" here, which contains no
  // "sound" substring at all and fails that test; verified empirically, see
  // task-13-report.md). Using "sound" satisfies both: it is still a bare
  // fact (floor + kind of sound, never a room, never a name).
  for (const s of p.floorSounds) {
    lines.push(`A sound came from ${FLOOR_WORD[s.floor] ?? 'somewhere'}.`);
  }

  // v12.2 §8's last line, and §14's own notice: it says a crowd happened,
  // never where or who — naming the room would identify everyone standing in
  // it, and §14 (which would price it) is parked, so this reports and costs
  // nothing.
  if (p.crowded) lines.push('The children crowded together.');

  // The flame line always prints (first push above, unconditional), so
  // "nothing ELSE happened" means exactly one line survived every other
  // conditional push above it — but that one line is not always silent: a
  // night whose only event is a flame going out (e.g. reason 'wrong-call',
  // which has no take.complete/lantern.snuff/sound counterpart to populate
  // anything else) still leaves `lines.length === 1`, and reporting "the
  // house saw nothing" in the very next line would contradict the flame line
  // above it — the referee stating a falsehood. So this fallback also
  // requires `flamesLost === 0`, not just a lone surviving line. (Found by
  // review; see task-13-report.md.)
  if (lines.length === 1 && p.flamesLost === 0) {
    lines.push('The house stayed dark. The house saw nothing.');
  }
  return lines;
}
