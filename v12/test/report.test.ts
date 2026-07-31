import { renderReport } from '../src/log/report';
import { projectForHouse } from '../src/log/project';
import type { MatchLog } from '../src/log/schema';
import type { MatchEvent } from '../src/core/events';
import { HOLLOW } from '../src/house/hollow';

const log = (events: MatchEvent[]): MatchLog => ({ seed: 1, house: 'HOLLOW', events });

describe('renderReport', () => {
  // v12.2 §8 — the house reports facts and never interprets, in this order.
  // (The brief's own comment cited stale v12.0 "§13.1" numbering here; see
  // Task 12's Finding A for how that citation maps to v12.2 §8. Fixed the
  // same way Task 12 fixed its own docstrings and one test title.)
  it('reads out in v12.2 §8 order', () => {
    const lines = renderReport(projectForHouse(log([
      { kind: 'take.complete', tick: 1, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
      { kind: 'flame.out', tick: 2, night: 2, reason: 'take', remaining: 4 },
      { kind: 'sound', tick: 3, night: 2, floor: 1, sound: 'take', room: 'attic' },
    ]), 2), HOLLOW);
    const text = lines.join('\n');
    expect(text.indexOf('did not return')).toBeLessThan(text.indexOf('flame'));
    expect(text.indexOf('flame')).toBeLessThan(text.indexOf('sound'));
  });

  // v12.2 §8 VOICE RULE — the house's phrasing depends only on the room, the
  // night, and counts of things, never on who was standing there. This is
  // the test that makes that rule real.
  //
  // STRENGTHENED beyond the brief's given fixture (see task-13-report.md for
  // the mutation-test evidence): the brief's own version touched only two of
  // the report's seven lines (the lanterns line and the floor-sound line) and
  // left `didNotReturn` — the one field that legitimately carries an ActorId
  // — empty in BOTH arms. A mutation that leaked the taker's identity into
  // `didNotReturn` (instead of the victim's) passed that fixture unchanged,
  // proving it could not have caught the exact leak §8 exists to prevent.
  //
  // This version exercises every line the report can produce. The same six
  // named children play every role (taker, lantern-placer, two lantern-
  // crossers, lantern-carrier, sock-securer, snuffer, three-person crowd) on
  // both nights, but WHICH child plays which role is cyclically rotated: with
  // a 5-name pool indexed `i % 5` and a rotation offset of 2, every one of the
  // 10 roles gets a DIFFERENT actor between variant one and variant two
  // (`i % 5 === (i + 2) % 5` has no solution for any i, since 2 !== 0 mod 5).
  // `pike` is held FIXED as the taken child in both variants — the one
  // identity §8 actually grants — so the test still demands byte-identical
  // output despite every OTHER identity changing hands.
  it('produces identical text when only the identities differ', () => {
    const roster = (names: string[]): MatchEvent[] => {
      const who = (i: number) => names[i % names.length]!;
      return [
        { kind: 'take.complete', tick: 1, night: 3, actor: who(0), victim: 'pike', room: 'attic' },
        { kind: 'lantern.place', tick: 2, night: 3, actor: who(1), lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
        { kind: 'move.enter', tick: 5, night: 3, actor: who(2), room: 'playroom', via: 'd_music_playroom' },
        { kind: 'move.enter', tick: 6, night: 3, actor: who(3), room: 'music_room', via: 'd_music_playroom' },
        { kind: 'lantern.carry', tick: 7, night: 3, actor: who(4), lantern: 'lantern_a', room: 'music_room' },
        { kind: 'sock.secure', tick: 8, night: 3, actor: who(5), sock: 'sock_1', room: 'kitchen' },
        { kind: 'lantern.snuff', tick: 9, night: 3, actor: who(6), lantern: 'lantern_b', room: 'bathroom' },
        { kind: 'sound', tick: 10, night: 3, floor: 0, sound: 'slip', room: 'cellar' },
        { kind: 'move.enter', tick: 11, night: 3, actor: who(7), room: 'library', via: 'd_hearth_library' },
        { kind: 'move.enter', tick: 12, night: 3, actor: who(8), room: 'library', via: 'd_hearth_library' },
        { kind: 'move.enter', tick: 13, night: 3, actor: who(9), room: 'library', via: 'd_hearth_library' },
      ];
    };
    const one = renderReport(projectForHouse(log(roster(['wren', 'bell', 'clem', 'moss', 'sparrow'])), 3), HOLLOW);
    const two = renderReport(projectForHouse(log(roster(['clem', 'moss', 'sparrow', 'wren', 'bell'])), 3), HOLLOW);
    expect(one).toEqual(two);

    // Review finding: `pike` is held FIXED across both variants (the one
    // identity §8 grants), so a bug that leaks `didNotReturn` onto a SECOND
    // line — e.g. the crowd line reusing it, since this fixture also
    // triggers `crowded` — would print the identical (wrong) text in both
    // arms and `toEqual` above could not see it; a same-value leak is
    // invisible to a differential test by construction, not a fixable
    // property of that assertion. `pike` is licensed on exactly one line
    // (§8 grants naming who didn't come back); this pins it to that one line
    // and no other, closing the gap directly rather than relying on identity
    // differing between arms to expose it.
    expect(one.filter(l => l.includes('pike'))).toEqual(['pike did not return.']);
  });

  it('names a child who did not return, because v12.2 §8 grants exactly that', () => {
    const lines = renderReport(projectForHouse(log([
      { kind: 'take.complete', tick: 1, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
    ]), 2), HOLLOW);
    expect(lines.join('\n')).toContain('pike');
  });

  it('never names the taker', () => {
    const lines = renderReport(projectForHouse(log([
      { kind: 'take.complete', tick: 1, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
    ]), 2), HOLLOW);
    expect(lines.join('\n')).not.toContain('wren');
  });

  it('says the house saw nothing rather than nothing at all', () => {
    const lines = renderReport(projectForHouse(log([]), 1), HOLLOW);
    expect(lines.join('\n')).toMatch(/saw nothing|stayed dark/i);
  });

  // v12.2 §8 reads the flame count out every morning, not only when one went out
  it('reports flames remaining on a night that lost none', () => {
    const lines = renderReport(projectForHouse(log([]), 1), HOLLOW);
    expect(lines.join('\n')).toMatch(/No flame went out\. 5 remain\./);
  });

  // v12.2 §8's last line. §14 prices crowding and §14 is parked, so the report
  // must still SAY it happened while nothing burns a flame for it.
  it('reports a crowd without naming the room or anyone in it', () => {
    const crowd: MatchEvent[] = ['clem', 'moss', 'sparrow'].map((actor, i) => ({
      kind: 'move.enter', tick: 10 + i, night: 5, actor, room: 'library', via: 'd_hearth_library',
    }));
    const lines = renderReport(projectForHouse(log(crowd), 5), HOLLOW);
    const text = lines.join('\n');
    expect(text).toMatch(/crowded together/i);
    expect(text).not.toMatch(/Library/i);
    for (const who of ['clem', 'moss', 'sparrow']) expect(text).not.toContain(who);
  });

  it('says nothing about crowding when only two gathered', () => {
    const pair: MatchEvent[] = ['clem', 'moss'].map((actor, i) => ({
      kind: 'move.enter', tick: 10 + i, night: 5, actor, room: 'library', via: 'd_hearth_library',
    }));
    expect(renderReport(projectForHouse(log(pair), 5), HOLLOW).join('\n'))
      .not.toMatch(/crowded/i);
  });

  // Midnight was cut in v12.1 — "a beat, not a mechanic". The report must not
  // resurrect it on night four.
  it('announces no Midnight room on night four', () => {
    expect(renderReport(projectForHouse(log([]), 4), HOLLOW).join('\n'))
      .not.toMatch(/midnight/i);
  });

  // Found by the advisor, empirically confirmed before fixing: the fallback
  // keyed on `lines.length === 1` alone, so a night whose ONLY event is a
  // flame going out (e.g. reason 'wrong-call', which has no corresponding
  // take.complete/lantern.snuff event to populate anything else — Task 12's
  // Concern 5 records that Task 14's fixture needs exactly one such night)
  // rendered "One flame went out. 4 remain." immediately followed by "The
  // house stayed dark. The house saw nothing." in the next line — the honest
  // narrator stating a falsehood, the same defect shape as Task 12's
  // "Nobody moved the lantern" finding. The fallback must also require that
  // no flame was lost, not merely that only one line printed.
  it('does not claim it saw nothing on a night a flame went out for no other reason', () => {
    const lines = renderReport(projectForHouse(log([
      { kind: 'flame.out', tick: 1, night: 2, reason: 'wrong-call', remaining: 4 },
    ]), 2), HOLLOW);
    const text = lines.join('\n');
    expect(text).toMatch(/One flame went out\. 4 remain\./);
    expect(text).not.toMatch(/saw nothing|stayed dark/i);
  });
});
