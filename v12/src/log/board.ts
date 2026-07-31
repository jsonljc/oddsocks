import type { ActorId } from '../core/events';
import type { Claim, ClaimId } from './schema';

export interface Board { claims: Claim[] }

export function emptyBoard(): Board { return { claims: [] }; }

export interface PlaceResult { ok: boolean; reason?: string }

/** v12.2 §8 — one mark per living player per morning, permanent and public for
 *  the rest of the game. Permanence is why the stored claim is frozen: talking
 *  is deniable, a placed mark is committed.
 *
 *  Mutates `board` in place (pushes onto `board.claims`) and returns whether
 *  the placement succeeded — it does not return a new Board.
 *
 *  Checked in this order: the one-mark-per-morning rule first (kind-agnostic:
 *  a `deny` spends the morning's mark exactly like any other claim), then id
 *  uniqueness, then — only for `deny` claims — that the target exists and
 *  isn't the denier's own mark. Order matters and is pinned by a real test:
 *  two claims by the same author on the same night, using this file's own
 *  test helper (`id` derived from `${by}-n${night}`), collide on id too — so
 *  whichever check runs first decides which reason string comes back, and
 *  "you already claimed this morning" is the one callers should see for that
 *  case, not "duplicate id". */
export function placeClaim(board: Board, claim: Claim): PlaceResult {
  if (board.claims.some(c => c.night === claim.night && c.by === claim.by)) {
    return { ok: false, reason: `${claim.by} has already placed a mark this morning (night ${claim.night})` };
  }
  if (board.claims.some(c => c.id === claim.id)) {
    return { ok: false, reason: `duplicate claim id '${claim.id}'` };
  }
  // A denial has to point at a mark that exists, or the board could be
  // poisoned with references to nothing — and you cannot deny your own mark.
  if (claim.kind === 'deny') {
    const target = board.claims.find(c => c.id === claim.denies);
    if (!target) return { ok: false, reason: `nothing on the board with id '${claim.denies}'` };
    if (target.by === claim.by) return { ok: false, reason: 'you cannot deny your own mark' };
  }
  board.claims.push(Object.freeze({ ...claim }));
  return { ok: true };
}

/** Who has been contradicted, and by whom. A denial is an accusation of lying
 *  that costs the denier their whole morning — v12.2 §8 gives each player one
 *  mark, so spending it to say "that's not true" is a real commitment.
 *  Returns an empty array both when nobody has denied `id` and when `id`
 *  isn't on the board at all — this function doesn't validate the id, it
 *  just reports who, if anyone, denied it. */
export function deniersOf(board: Board, id: ClaimId): ActorId[] {
  return board.claims
    .filter((c): c is Extract<Claim, { kind: 'deny' }> => c.kind === 'deny' && c.denies === id)
    .map(c => c.by);
}

export interface Contradiction { a: Claim; b: Claim; because: string }

/** v12.2 §8 leaves "contradiction" undefined (the section once numbered
 *  §13.2, in an earlier draft); this is the reading this build takes. An
 *  author placing the same subject in two different rooms disagrees with
 *  themselves — that is the whole point of a permanent board. Same-night
 *  pairs are the sharper case and sort first.
 *
 *  Only `player-room` claims are compared: it is the only Claim variant that
 *  carries both a `subject` and a `room`, so it is the only kind for which
 *  "same subject, different room" is even expressible — this is not a
 *  narrowing choice, `player-player`/`player-sock` have no room and
 *  `room-incident` has no subject.
 *
 *  Note on reachability: `placeClaim`'s one-mark-per-morning check is keyed
 *  on (night, by) and is kind-agnostic, so two claims sharing an author are
 *  guaranteed to have different nights — a same-night pair (a.night ===
 *  b.night below) cannot arise from a board built by feeding claims through
 *  placeClaim one at a time. It CAN arise on a Board assembled some other
 *  way (a Board is just { claims: Claim[] }, and nothing requires it to have
 *  been built via placeClaim) — this function's same-night branch exists for
 *  that shape, not because live play can reach it through the mark rule. */
export function findContradictions(board: Board): Contradiction[] {
  const roomClaims = board.claims.filter(
    (c): c is Extract<Claim, { kind: 'player-room' }> => c.kind === 'player-room');

  const out: Contradiction[] = [];
  for (let i = 0; i < roomClaims.length; i++) {
    for (let j = i + 1; j < roomClaims.length; j++) {
      const a = roomClaims[i]!, b = roomClaims[j]!;
      if (a.by !== b.by) continue;
      if (a.subject !== b.subject) continue;
      if (a.room === b.room) continue;
      out.push({
        a, b,
        because: a.night === b.night
          ? `${a.by} put ${a.subject} in two rooms on the same night`
          : `${a.by} put ${a.subject} in two rooms — night ${a.night} and night ${b.night}`,
      });
    }
  }

  // Array.prototype.sort is stable (guaranteed since ES2019), so ties (both
  // same-night, or both cross-night) keep the order they were discovered in
  // above — no explicit tie-breaker needed.
  const sameNight = (c: Contradiction) => c.a.night === c.b.night;
  return out.sort((x, y) => Number(sameNight(y)) - Number(sameNight(x)));
}
