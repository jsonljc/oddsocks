import { SIX_NIGHT_MATCH, SIX_NIGHT_CLAIMS } from '../src/log/fixture';
import { projectForHouse } from '../src/log/project';
import { renderReport } from '../src/log/report';
import { HOLLOW } from '../src/house/hollow';
import type { Claim } from '../src/log/schema';

describe('SIX_NIGHT_MATCH', () => {
  it('covers six nights', () => {
    expect(new Set(SIX_NIGHT_MATCH.events.map(e => e.night))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  // This assertion cannot fail against any fixture: report.ts pushes the
  // flame-count line unconditionally, first, before any per-night content is
  // evaluated, so lines.length >= 1 holds for every projection regardless of
  // what SIX_NIGHT_MATCH contains. This test exists so that invariant has
  // somewhere to live, not because the assertion below discriminates
  // anything about the fixture (same shape as project.test.ts's 'crowd'
  // guard test and its own comment explaining the same thing).
  it('renders a non-empty report for every night', () => {
    for (let n = 1; n <= 6; n++) {
      expect(renderReport(projectForHouse(SIX_NIGHT_MATCH, n), HOLLOW).length,
             `night ${n}`).toBeGreaterThan(0);
    }
  });

  // Flames only ever go out (rules §7). If remaining ever rises across the
  // six nights, the projection is treating a stock as a flow.
  it('never lets flames remaining rise across the six nights', () => {
    let previous = 5;
    for (let n = 1; n <= 6; n++) {
      const now = projectForHouse(SIX_NIGHT_MATCH, n).flamesRemaining;
      expect(now, `night ${n}`).toBeLessThanOrEqual(previous);
      previous = now;
    }
    expect(previous).toBe(2);   // one Take, one Snuff, one failed Call
  });

  it('references only rooms and doors the house actually has', () => {
    const rooms = new Set(HOLLOW.rooms.map(r => r.id));
    const doors = new Set(HOLLOW.doors.map(d => d.id));
    for (const e of SIX_NIGHT_MATCH.events) {
      if ('room' in e && e.room) expect(rooms, JSON.stringify(e)).toContain(e.room);
      if ('via' in e && e.via) expect(doors, JSON.stringify(e)).toContain(e.via);
    }
    // RoomId (core/house.ts) is a plain string alias, so a typo'd claim room
    // is not a compile error either, and SIX_NIGHT_CLAIMS was unchecked by
    // anything until this loop was added — review found that injecting
    // 'nonexistent_room' into a claim left both tsc and this file green.
    // Claims never carry a door field (schema.ts's Claim union has no `via`),
    // so only `room` needs checking here.
    for (const c of SIX_NIGHT_CLAIMS) {
      if ('room' in c && c.room) expect(rooms, JSON.stringify(c)).toContain(c.room);
    }
  });

  // Displace was CUT in v12.1: with a person-only accusation, where a sock was
  // found meant nothing mechanically, and moving it threw away the villain's
  // best quiet-night play. The fixture must not model one.
  it('contains no Displace — no sock is dropped in a room it was not found in', () => {
    const pickups = SIX_NIGHT_MATCH.events.filter(e => e.kind === 'sock.pickup');
    const drops = SIX_NIGHT_MATCH.events.filter(e => e.kind === 'sock.drop');
    const displaced = pickups.some(p =>
      drops.some(d => 'sock' in d && 'sock' in p && d.sock === p.sock && d.room !== p.room));
    expect(displaced).toBe(false);
  });

  // v12.2 §6 pins retrieval latency to zero, and it is the switch between 0 and
  // 227 villain lines that deny an accusation. The fixture must exercise it.
  it('secures a sock on the same night it was picked up', () => {
    const pickup = SIX_NIGHT_MATCH.events.find(e => e.kind === 'sock.pickup');
    expect(pickup).toBeDefined();
    const secure = SIX_NIGHT_MATCH.events.find(
      e => e.kind === 'sock.secure' && 'sock' in pickup! && e.sock === pickup.sock);
    expect(secure?.night).toBe(pickup!.night);
  });

  // v12.2 §6 — a sock on the floor stays there, night after night
  it('leaves a sock lying across a night boundary before anyone lifts it', () => {
    const spawn = SIX_NIGHT_MATCH.events.find(e => e.kind === 'sock.spawn' && e.sock === 'sock_1');
    const pickup = SIX_NIGHT_MATCH.events.find(e => e.kind === 'sock.pickup' && e.sock === 'sock_1');
    expect(pickup!.night).toBeGreaterThan(spawn!.night);
  });

  // v12.2 §13 — the Odd Sock cannot grab anyone on Night One
  it('has no grab on night one', () => {
    expect(SIX_NIGHT_MATCH.events.some(e => e.kind === 'take.complete' && e.night === 1)).toBe(false);
  });

  // v12.2 §10 — a wrong accusation costs one sock and one flame
  it('contains a wrong accusation that cost a flame', () => {
    expect(SIX_NIGHT_MATCH.events.some(e => e.kind === 'flame.out' && e.reason === 'wrong-call')).toBe(true);
  });

  // v12.2 §7 — after two quiet nights a sock falls in the villain's exact room,
  // and no flame goes out for it
  it('sheds a sock on the second quiet night without spending a flame', () => {
    const shed = SIX_NIGHT_MATCH.events.find(e => e.kind === 'sock.spawn' && e.source === 'shed');
    expect(shed).toBeDefined();
    expect(SIX_NIGHT_MATCH.events.some(
      e => e.kind === 'flame.out' && e.night === shed!.night)).toBe(false);
  });

  // §14 is parked. The fixture may report a crowd; it must never charge one.
  it('never burns a flame for crowding', () => {
    expect(SIX_NIGHT_MATCH.events.some(e => e.kind === 'flame.out' && e.reason === 'crowd')).toBe(false);
  });

  // ---- Added beyond the brief ----
  // None of the tests above actually assert that a crowd happened (only that
  // no flame was charged for one), or that any specific report line renders.
  // Every deliberate choice behind Night Three's plural lantern count, Night
  // Five's three-body crowd, and Night Six's single surviving line was
  // otherwise unverified: a future edit (e.g. adding a fourth `move.enter`
  // into the library, or having moss's exit never happen) could silently
  // break any of them and every given test would stay green regardless.

  it('actually crowds night five, and the report says so', () => {
    expect(projectForHouse(SIX_NIGHT_MATCH, 5).crowded).toBe(true);
    const text = renderReport(projectForHouse(SIX_NIGHT_MATCH, 5), HOLLOW).join('\n');
    expect(text).toMatch(/crowded together/i);
  });

  it('reports the night-three lantern as both crossed (plural) and moved', () => {
    const text = renderReport(projectForHouse(SIX_NIGHT_MATCH, 3), HOLLOW).join('\n');
    // Pinned to report.ts's exact template (`watched ${n} figures cross`), not
    // a loose /2 figures cross/: that looser pattern would also match "12
    // figures cross" (substring "2 figures cross"), so it does not actually
    // pin the count to two.
    expect(text).toMatch(/watched 2 figures cross/i);
    expect(text).toMatch(/was moved/i);
  });

  // Pins Task 13's fallback fix (task-13-report.md) against this fixture
  // specifically, not just report.test.ts's own synthetic one-line log: a
  // wrong-call night with nothing else to report must print the flame line
  // and STOP — never "the house saw nothing" beneath a flame that, in fact,
  // just went out.
  it('renders night six as exactly the flame line and nothing else', () => {
    expect(renderReport(projectForHouse(SIX_NIGHT_MATCH, 6), HOLLOW))
      .toEqual(['One flame went out. 2 remain.']);
  });
});

describe('SIX_NIGHT_CLAIMS', () => {
  // rules §13.2 — one claim marker per living player per morning
  it('gives no player two claims in one morning', () => {
    const seen = new Set<string>();
    for (const c of SIX_NIGHT_CLAIMS) {
      const key = `${c.night}:${c.by}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  // spec §5 — the fixture must contain a contradiction to find
  it('contains one author placing the same subject in two rooms on one night', () => {
    const roomClaims = SIX_NIGHT_CLAIMS.filter(c => c.kind === 'player-room');
    const contradiction = roomClaims.some(a => roomClaims.some(b =>
      a !== b && a.by === b.by && a.kind === 'player-room' && b.kind === 'player-room'
      && a.subject === b.subject && a.room !== b.room));
    expect(contradiction).toBe(true);
  });

  it('gives every mark a unique id, because a denial has to point at one', () => {
    const ids = SIX_NIGHT_CLAIMS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // v12.2 §8's fifth mark type — the one that lets the board hold an argument
  it('contains a denial that points at a mark actually on the board', () => {
    const denials = SIX_NIGHT_CLAIMS.filter(
      (c): c is Extract<Claim, { kind: 'deny' }> => c.kind === 'deny');
    expect(denials.length).toBeGreaterThan(0);
    for (const d of denials) {
      const target = SIX_NIGHT_CLAIMS.find(c => c.id === d.denies);
      expect(target, `denial ${d.id} points at nothing`).toBeDefined();
      expect(target!.by).not.toBe(d.by);
    }
  });
});
