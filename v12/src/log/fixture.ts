import type { MatchEvent } from '../core/events';
import type { Claim, MatchLog } from './schema';

/** A hand-authored six-night match. **Nobody has ever played v12** — this is
 *  invented, not recorded, and it must never be cited as evidence about
 *  balance or how the game actually plays. Its only job is to exercise the
 *  machinery slice 1 built: every report line, a sock that persists across
 *  nights, same-night securing, a shed, a wrong accusation, a crowd, a
 *  claim-board contradiction, and a denial.
 *
 *  Every room and door id below is checked against `house/hollow.ts`'s
 *  twelve-room house by this file's own test (`references only rooms and
 *  doors the house actually has`). Villain identity (`wren`, throughout) is
 *  visible here because this is the ground-truth log, not the report the
 *  house reads out — `projectForHouse`/`renderReport` are what launder
 *  identity away, and they do it structurally (`HouseProjection` carries no
 *  ActorId but `didNotReturn`), not because the log withholds it.
 *
 *  Sealing (§13, `houseAfterSealing`) is not wired into `projectForHouse` at
 *  this slice — `renderReport` is always called against the full, unsealed
 *  `HOLLOW` (see test/fixture.test.ts and test/report.test.ts alike) — so
 *  later nights are free to use peripheral rooms (library's `conservatory`
 *  door, etc.) without that being a defect at this slice.
 */
const events: MatchEvent[] = [
  // ---- Night 1 — v12.2 §13: the Odd Sock cannot grab on Night One. Lanterns
  // get placed, that is all. Doors read `d_bed_hearth` etc. because every
  // actor starts each night in shared_bedroom (§3: "a bedroom you all start
  // in") — the log records only the arrival hop that matters, not the full
  // walk, matching the granularity project.ts itself expects (a curated log,
  // not a full simulation trace).
  { kind: 'move.enter', tick: 30, night: 1, actor: 'bell', room: 'hearth', via: 'd_bed_hearth' },
  { kind: 'lantern.place', tick: 60, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'hearth', watching: 'd_hearth_library' },
  { kind: 'move.enter', tick: 75, night: 1, actor: 'clem', room: 'kitchen', via: 'd_hearth_kitchen' },

  // ---- Night 2 — the villain's first hostile act (one per night, §7): a
  // grab, in the attic. Take -> sock -> flame -> noise, in that causal order
  // (§6/§7's own list).
  { kind: 'move.enter', tick: 120, night: 2, actor: 'pike', room: 'attic', via: 'd_attic_playroom' },
  { kind: 'take.complete', tick: 200, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
  { kind: 'sock.spawn', tick: 201, night: 2, sock: 'sock_1', room: 'attic', source: 'take' },
  { kind: 'flame.out', tick: 202, night: 2, reason: 'take', remaining: 4 },
  { kind: 'sound', tick: 203, night: 2, floor: 1, sound: 'take', room: 'attic' },

  // ---- Night 3 — quiet villain night 1 of 2. sock_1 was lying in the attic
  // since Night Two (v12.2 §6: socks stay put across the boundary) — sparrow
  // finds it AND boards it the same night: v12.2 §6's latency-zero pin, the
  // rule that is the difference between the children always reaching an
  // accusation (0/282 villain lines) and being denied one 227/282 of the time.
  { kind: 'sock.pickup', tick: 265, night: 3, actor: 'sparrow', sock: 'sock_1', room: 'attic' },
  { kind: 'move.enter', tick: 290, night: 3, actor: 'sparrow', room: 'shared_bedroom', via: 's_attic_bedroom' },
  { kind: 'sock.secure', tick: 310, night: 3, actor: 'sparrow', sock: 'sock_1', room: 'shared_bedroom' },
  { kind: 'lantern.place', tick: 340, night: 3, actor: 'moss', lantern: 'lantern_b', room: 'music_room', watching: 'd_music_playroom' },
  // Two crossings of the watched doorway (not one), so the report's plural
  // branch ("N figures cross") gets exercised alongside the singular branch
  // Night One's empty-doorway lantern already covers.
  { kind: 'move.enter', tick: 345, night: 3, actor: 'bell', room: 'playroom', via: 'd_music_playroom' },
  { kind: 'move.enter', tick: 350, night: 3, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },
  // moss picks the lantern back up (exercises the "was moved" line — no
  // fixture event exercised it before this file) and immediately sets it back
  // down watching the same doorway. Tick order matters and is load-bearing:
  // place (340) precedes both crossings (345, 350) and the carry (360), so
  // "watched 2 figures cross" and "was moved" are both TRUE statements, not
  // Task 12/13's "nobody moved it" falsehood-shape bug. The second place
  // (370) is not decoration: without it lantern_b is still fictionally in
  // moss's hands going into Night Five, where moss needs both hands free to
  // carry sock_2, and where wren snuffs this exact lantern — you cannot snuff
  // a lantern someone is carrying (§5 gates the snuff on nobody standing in
  // its light, and a carrier is definitionally in their own light).
  { kind: 'lantern.carry', tick: 360, night: 3, actor: 'moss', lantern: 'lantern_b', room: 'music_room' },
  { kind: 'lantern.place', tick: 370, night: 3, actor: 'moss', lantern: 'lantern_b', room: 'music_room', watching: 'd_music_playroom' },

  // ---- Night 4 — quiet villain night 2 of 2, so v12.2 §7 sheds a sock into
  // the exact room the villain is standing in. No flame — this is the leak
  // that prices hiding, not acting.
  { kind: 'sock.spawn', tick: 430, night: 4, sock: 'sock_2', room: 'library', source: 'shed' },
  { kind: 'sound', tick: 431, night: 4, floor: 0, sound: 'shed', room: 'library' },

  // ---- Night 5 — the villain's second hostile act (a snuff, resetting the
  // quiet counter), and a crowd. Night Four's report said only "a sound came
  // from downstairs" (no room — §8's voice rule), so several children
  // independently converge on the ground floor hunting for it; three of them
  // (bell, clem, sparrow) end the night in the library they were searching —
  // exactly the "escort/huddle/turtle, get crowd-joined" trap §14's notice
  // describes. Each gets an explicit `move.enter` ending in library THIS
  // night, because `crowded` is computed only from that (Task 12's Concern 3:
  // an actor already in a room who never moves is invisible to it).
  { kind: 'move.enter', tick: 500, night: 5, actor: 'bell', room: 'library', via: 'd_hearth_library' },
  { kind: 'move.enter', tick: 505, night: 5, actor: 'clem', room: 'library', via: 'd_cellar_library' },
  { kind: 'move.enter', tick: 510, night: 5, actor: 'sparrow', room: 'library', via: 'd_library_consv' },
  // moss also searches the library, finds the shed sock, and — unlike the
  // other three — leaves again, so moss's LAST move.enter this night is
  // shared_bedroom, not library. That is what holds the library crowd at
  // exactly three: a fourth body ending in library would still be a crowd,
  // but it would not demonstrate that only bodies present AT NIGHT'S END
  // count (project.test.ts's own "is not crowded when the same body enters a
  // room three times" pins the same fold from the other direction).
  { kind: 'move.enter', tick: 515, night: 5, actor: 'moss', room: 'library', via: 'd_hearth_library' },
  { kind: 'sock.pickup', tick: 520, night: 5, actor: 'moss', sock: 'sock_2', room: 'library' },
  { kind: 'lantern.snuff', tick: 530, night: 5, actor: 'wren', lantern: 'lantern_b', room: 'music_room' },
  { kind: 'sock.spawn', tick: 531, night: 5, sock: 'sock_3', room: 'music_room', source: 'snuff' },
  { kind: 'flame.out', tick: 532, night: 5, reason: 'snuff', remaining: 3 },
  { kind: 'sound', tick: 533, night: 5, floor: 1, sound: 'snuff', room: 'music_room' },
  // moss carries sock_2 home — a real, walkable, two-hop path
  // (library -> hearth -> shared_bedroom), not a teleport — and secures it
  // the same night it was found (the same latency-zero pin Night Three
  // already exercises once; a second instance costs nothing and only adds
  // confidence).
  { kind: 'move.enter', tick: 540, night: 5, actor: 'moss', room: 'hearth', via: 'd_hearth_library' },
  { kind: 'move.enter', tick: 550, night: 5, actor: 'moss', room: 'shared_bedroom', via: 'd_bed_hearth' },
  { kind: 'sock.secure', tick: 560, night: 5, actor: 'moss', sock: 'sock_2', room: 'shared_bedroom' },

  // ---- Night 6 — the morning opens with two secured socks (sock_1, sock_2)
  // funding a Call (§10: "once two socks are on the board"). It named the
  // wrong child. §10: a wrong accusation costs ONE sock and ONE flame, not
  // both — the board keeps sock_1, and the children are one sock from trying
  // again. There is no event in this log's vocabulary for "a sock was spent"
  // (only spawn/pickup/drop/secure exist), so that half of §10's cost is
  // stated here in prose, not in data — see the report's hand-off note to
  // Task 15.
  //
  // This event is deliberately the night's ONLY flame-affecting event: it
  // pins Task 13's fallback fix (task-13-report.md) against a real fixture,
  // not just report.test.ts's own synthetic one-line log — a wrong-call night
  // with nothing else to report must print the flame line and STOP, never
  // "the house saw nothing" beneath a flame that, in fact, went out.
  { kind: 'flame.out', tick: 600, night: 6, reason: 'wrong-call', remaining: 2 },

  // The night otherwise continues as normal (§10: "the night begins as
  // normal" after a Call resolves, whether it carried or not). moss checks
  // back on the music_room, where sock_3 has sat since Night Five (v12.2 §6:
  // it stays put), picks it up, and sets it back down in the SAME room before
  // returning empty-handed.
  //
  // That pickup+drop is an AUTHORING DEVICE, not a modeled mechanic: no rule
  // in v12.2 produces a voluntary same-room drop. §6's only stated drop is
  // "if you get grabbed you drop it," which needs a second grab — a fourth
  // flame.out, which would break the fixed 4->3->2 economy the monotonicity
  // test and "one Take, one Snuff, one failed Call" both pin. Its only job is
  // to keep "contains no Displace" a real check on a non-empty drops[]
  // (matching sock, matching room) instead of a vacuous pass against an
  // empty array that any accidental Displace would trivially still pass. See
  // the report's per-test failure analysis.
  { kind: 'move.enter', tick: 610, night: 6, actor: 'moss', room: 'music_room', via: 'd_music_playroom' },
  { kind: 'sock.pickup', tick: 615, night: 6, actor: 'moss', sock: 'sock_3', room: 'music_room' },
  { kind: 'sock.drop', tick: 620, night: 6, actor: 'moss', sock: 'sock_3', room: 'music_room' },
];

export const SIX_NIGHT_MATCH: MatchLog = { seed: 4242, house: 'HOLLOW', events };

/** One mark per living player per morning (v12.2 §8). Two things are planted
 *  here on purpose, and both are what slice 1 exists to make visible:
 *
 *  - **A self-contradiction — three-way, not just the pair the test names.**
 *    bell places wren in the hearth (c1, night 2), the attic (c4, night 3),
 *    and the cellar (c7, night 5): three claims, three different rooms, same
 *    author, same subject. Any two of the three already disagree, so this
 *    is three overlapping contradictions, not one. Mutation-tested: unifying
 *    c4 and c7 alone left the "same subject in two rooms" test green, because
 *    c1-vs-c4 was independently still a contradiction — only unifying all
 *    three rooms turns it red. (The test's own logic never checks the two
 *    nights match either, only that some pair of the same author's claims
 *    about the same subject disagrees on the room — see the report.)
 *  - **A denial.** clem's entire night-4 mark says bell's night-3 claim (c4)
 *    is false. That is the fifth mark type, new in v12.1 — before it, the
 *    board had four ways to assert and no way to disagree. It also happens to
 *    point backward in time (c5 denies c4, which is chronologically earlier),
 *    which is more than the "gives every mark a unique id" and "contains a
 *    denial that points at a mark on the board" tests require, but is true of
 *    this data anyway.
 */
export const SIX_NIGHT_CLAIMS: Claim[] = [
  { id: 'c1', kind: 'player-room',   night: 2, by: 'bell',    subject: 'wren',  room: 'hearth' },
  { id: 'c2', kind: 'player-room',   night: 2, by: 'clem',    subject: 'moss',  room: 'kitchen' },
  { id: 'c3', kind: 'room-incident', night: 3, by: 'sparrow', room: 'attic',    incident: 'a noise upstairs' },
  { id: 'c4', kind: 'player-room',   night: 3, by: 'bell',    subject: 'wren',  room: 'attic' },
  { id: 'c5', kind: 'deny',          night: 4, by: 'clem',    denies: 'c4' },
  { id: 'c6', kind: 'player-sock',   night: 4, by: 'sparrow', subject: 'wren',  sock: 'sock_1' },
  { id: 'c7', kind: 'player-room',   night: 5, by: 'bell',    subject: 'wren',  room: 'cellar' },
  { id: 'c8', kind: 'room-incident', night: 5, by: 'clem',    room: 'music_room', incident: 'the lantern went out' },
  { id: 'c9', kind: 'player-player', night: 6, by: 'sparrow', subject: 'wren',  object: 'bell' },
];
