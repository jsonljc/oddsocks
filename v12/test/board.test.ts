import { emptyBoard, placeClaim, findContradictions, deniersOf, type Board } from '../src/log/board';
import { SIX_NIGHT_CLAIMS } from '../src/log/fixture';
import type { Claim } from '../src/log/schema';

function roomClaim(night: number, by: string, subject: string, room: string): Claim {
  return { id: `${by}-n${night}`, kind: 'player-room', night, by, subject, room };
}

// Contradiction.a/.b are typed as the general Claim union (per the brief's own
// pinned interface), even though findContradictions only ever constructs one
// from two player-room claims. This narrows for tests that read `.room`.
type RoomClaim = Extract<Claim, { kind: 'player-room' }>;
function roomOf(c: Claim): string { return (c as RoomClaim).room; }

describe('placeClaim', () => {
  // v12.2 §8 — each living player may place ONE claim marker per morning
  it('accepts one claim per player per morning', () => {
    const b = emptyBoard();
    expect(placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic')).ok).toBe(true);
    expect(placeClaim(b, roomClaim(2, 'clem', 'wren', 'attic')).ok).toBe(true);
  });

  it('refuses a second claim from the same player on the same morning', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    const r = placeClaim(b, roomClaim(2, 'bell', 'wren', 'cellar'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already/i);
  });

  it('allows the same player again on a later morning', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    expect(placeClaim(b, roomClaim(3, 'bell', 'wren', 'attic')).ok).toBe(true);
  });

  // v12.2 §8 — claims are permanent and public for the rest of the match
  it('never removes a claim once placed, and freezes what it stored', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(3, 'bell', 'wren', 'cellar'));
    expect(b.claims).toHaveLength(2);
    expect(Object.isFrozen(b.claims[0])).toBe(true);
    expect(Object.isFrozen(b.claims[1])).toBe(true);
  });

  // Object.freeze alone is a boolean introspection; this pins the behavior that
  // actually matters — the board's own copy cannot be edited after the fact.
  it('throws if you try to mutate a claim already on the board', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    const claim = b.claims[0]!;
    expect(claim.kind).toBe('player-room');
    expect(() => {
      if (claim.kind === 'player-room') claim.room = 'cellar';
    }).toThrow();
  });

  // A classic shared-mutable-singleton bug: nothing in the other tests here
  // depends on execution order, so this needs its own direct check.
  it('returns a fresh board on every call, not a shared one', () => {
    const b1 = emptyBoard();
    const b2 = emptyBoard();
    expect(b1).not.toBe(b2);
    placeClaim(b1, roomClaim(2, 'bell', 'wren', 'attic'));
    expect(b2.claims).toHaveLength(0);
  });
});

describe('findContradictions', () => {
  it('finds one author placing the same subject in two rooms', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(4, 'bell', 'wren', 'cellar'));
    const found = findContradictions(b);
    expect(found).toHaveLength(1);
    expect(found[0]!.because).toMatch(/two rooms/i);
    // Both arms of a same-night/cross-night ternary can independently contain
    // "two rooms" — this pins that a genuinely cross-night pair does not also
    // claim to be same-night, which /two rooms/i alone cannot tell apart.
    expect(found[0]!.because).not.toMatch(/same night/i);
  });

  it('does not flag two different authors disagreeing', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(2, 'clem', 'wren', 'cellar'));
    expect(findContradictions(b)).toEqual([]);
  });

  it('does not flag an author claiming two different subjects', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(3, 'bell', 'moss', 'cellar'));
    expect(findContradictions(b)).toEqual([]);
  });

  // Not given by the brief, and nothing in its suite touches this branch: an
  // author repeating the SAME room for the SAME subject is agreeing with
  // themselves, not contradicting — it must not be flagged.
  it('does not flag an author repeating the same room for the same subject', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(5, 'bell', 'wren', 'attic'));
    expect(findContradictions(b)).toEqual([]);
  });

  // spec §5 — a contradiction planted in the fixture must be findable
  it('finds the contradiction planted in the six-night fixture', () => {
    const b = emptyBoard();
    for (const c of SIX_NIGHT_CLAIMS) placeClaim(b, c);
    expect(findContradictions(b).length).toBeGreaterThan(0);
  });

  // Stronger than the test above, and the actual point of this task: bell's
  // claims (c1 night 2 hearth, c4 night 3 attic, c7 night 5 cellar) are a
  // THREE-WAY tangle, not the single pair the plan's own inline note names
  // (task-15-brief.md / plan doc line 4205 mentions only c4/c7, never c1).
  // Every pairing of three mutually-disagreeing claims is itself a
  // contradiction, so a correct pairwise scan must surface all three, not one.
  // This also doubles as proof that a denial does not suppress a
  // contradiction: c5 denies c4 (a tangle member) and the count is still 3.
  it('surfaces all three pairwise contradictions in the three-way tangle, not just one', () => {
    const b = emptyBoard();
    for (const c of SIX_NIGHT_CLAIMS) {
      const r = placeClaim(b, c);
      expect(r.ok, `${c.id} should have placed cleanly: ${r.reason ?? ''}`).toBe(true);
    }
    const found = findContradictions(b);
    expect(found).toHaveLength(3);
    const roomPairs = new Set(found.map(x => [roomOf(x.a), roomOf(x.b)].sort().join('/')));
    expect(roomPairs).toEqual(new Set(['attic/cellar', 'attic/hearth', 'cellar/hearth']));
  });

  // A same-night contradiction cannot arise from two calls to placeClaim: the
  // one-mark-per-morning check is keyed on (night, by) and is kind-agnostic, so
  // any two claims sharing an author are guaranteed to have different nights —
  // the second would always have been refused as "already claimed this
  // morning." This is findContradictions' behavior on a Board that already
  // contains a same-night pair, assembled directly (bypassing placeClaim) —
  // not a claim that live play through placeClaim can ever reach this shape.
  it('sorts a same-night contradiction ahead of a cross-night one', () => {
    const crossNightA = roomClaim(2, 'bell', 'wren', 'attic');
    const crossNightB = roomClaim(4, 'bell', 'wren', 'hearth');
    const sameNightPartner: Claim =
      { id: 'bell-n2b', kind: 'player-room', night: 2, by: 'bell', subject: 'wren', room: 'cellar' };
    const board: Board = { claims: [crossNightA, crossNightB, sameNightPartner] };

    const found = findContradictions(board);
    expect(found).toHaveLength(3);
    expect(found[0]!.because).toMatch(/same night/i);
    expect([roomOf(found[0]!.a), roomOf(found[0]!.b)].sort()).toEqual(['attic', 'cellar']);
  });
});

// v12.2 §8's fifth mark type. §15: the board "had four ways to make a claim and
// no way to say 'that's not true,' so it couldn't actually hold an argument."
describe('denial', () => {
  it('records who denied a mark', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    expect(placeClaim(b, { id: 'd1', kind: 'deny', night: 2, by: 'clem', denies: 'bell-n2' }).ok)
      .toBe(true);
    expect(deniersOf(b, 'bell-n2')).toEqual(['clem']);
  });

  it('refuses to deny a mark that is not on the board', () => {
    const b = emptyBoard();
    const r = placeClaim(b, { id: 'd1', kind: 'deny', night: 2, by: 'clem', denies: 'nothing' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/nothing on the board/i);
  });

  it('refuses to let you deny yourself', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    const r = placeClaim(b, { id: 'd1', kind: 'deny', night: 3, by: 'bell', denies: 'bell-n2' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/deny your own mark/i);
  });

  // Denying costs your whole morning — §8 gives one mark each. Pinned to the
  // SPECIFIC reason (already-claimed-this-morning), not merely ok===false:
  // as given, this test would also pass if the third call were rejected for
  // any other reason (e.g. a wrongly-implemented duplicate-id check), without
  // actually proving a denial spends the morning's one mark.
  it('still consumes the denier’s single mark for that morning', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, { id: 'd1', kind: 'deny', night: 2, by: 'clem', denies: 'bell-n2' });
    const r = placeClaim(b, roomClaim(2, 'clem', 'moss', 'kitchen'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already/i);
  });

  it('rejects a duplicate claim id', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    const dup: Claim = { id: 'bell-n2', kind: 'player-room', night: 3, by: 'clem', subject: 'moss', room: 'kitchen' };
    const r = placeClaim(b, dup);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/duplicate/i);
  });

  it('returns no deniers for a mark nobody has denied', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    expect(deniersOf(b, 'bell-n2')).toEqual([]);
  });

  it('returns no deniers for an id that is not on the board at all', () => {
    const b = emptyBoard();
    expect(deniersOf(b, 'nothing-like-that')).toEqual([]);
  });

  it('collects denials from more than one denier', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, { id: 'd1', kind: 'deny', night: 2, by: 'clem', denies: 'bell-n2' });
    placeClaim(b, { id: 'd2', kind: 'deny', night: 3, by: 'sparrow', denies: 'bell-n2' });
    expect(deniersOf(b, 'bell-n2')).toEqual(['clem', 'sparrow']);
  });

  // Every other multi-denier test above has all denials point at the SAME
  // target, so none of them actually proves deniersOf filters BY target
  // rather than just returning every denial on the board. This one has two
  // different marks each denied by a different player, and checks that
  // querying one does not pull in the denier of the other.
  it('does not attribute a denial of a different mark', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(2, 'clem', 'moss', 'kitchen'));
    placeClaim(b, { id: 'd1', kind: 'deny', night: 3, by: 'sparrow', denies: 'clem-n2' });
    expect(deniersOf(b, 'bell-n2')).toEqual([]);
    expect(deniersOf(b, 'clem-n2')).toEqual(['sparrow']);
  });
});
