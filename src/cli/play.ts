/**
 * ODD SOCKS — single seat, one terminal.
 *
 * You play one child. Heuristic bots play the other five. Everything you are
 * shown comes from `knowledgeFor` — the same projection a networked client
 * would receive — plus your own private sightings, which are yours to see and
 * yours to lie about.
 *
 *   npm run play                   a random seat, a random seed
 *   npm run play -- --seat=wren    pick your child
 *   npm run play -- --role=villain be Odd Socks
 *   npm run play -- --seed=1234    replay a specific game
 *
 * This file owns its own night loop rather than calling `playGame`. The reason
 * is the morning: `playGame` pushes the night into `state.history` only after
 * the morning has been asked, so a bot deciding what to say cannot see the
 * trail from the night it is talking about. That is survivable for bots and
 * indefensible for a person — the morning is *about* what just happened. The
 * loop below is the same sequence of the same pure resolvers, with the recap
 * printed before you speak. No engine file is touched and no sweep number moves.
 */
import { readSync } from 'node:fs';
import { makeRng, type Rng } from '../rules/rng.js';
import { makeConfig, ROSTER, type GameConfig } from '../rules/config.js';
import { canClaim, createGame, darkBedroomCount, isLit,
  type GameState, type PublicEvent, type Sighting } from '../rules/state.js';
import { runDusk, runMidnight, runMorning,
  type DuskAction, type MidnightAction, type MorningAction } from '../rules/night.js';
import { knowledgeFor } from '../rules/game.js';
import { canJoinCall, canPostCall } from '../rules/call.js';
import { doorsOf, isBedroom, ownerOf } from '../rules/map.js';
import { heuristicBot } from '../bots/heuristic.js';
import type { Knowledge } from '../bots/types.js';
import type { ItemUse } from '../rules/itemEffects.js';
import type { ItemKind, Path, PlayerId, RoomId } from '../rules/types.js';

// ─── terminal ────────────────────────────────────────────────────────────────

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  grey: (s: string) => `\x1b[90m${s}\x1b[0m`,
};
const say = (s = '') => process.stdout.write(`${s}\n`);
const rule = (label = '') =>
  say(C.grey(label ? `── ${label} ${'─'.repeat(Math.max(0, 72 - label.length))}` : '─'.repeat(76)));

const buf = Buffer.alloc(4096);
/**
 * Blocking line read. The Bot interface is synchronous, so this must be too.
 *
 * `pending` is not an optimisation: one `readSync` on a pipe routinely returns
 * several lines at once, and typing ahead does the same on a terminal. Dropping
 * the tail would silently swallow every answer after the first in the chunk.
 */
let pending = '';
function readLine(): string {
  for (;;) {
    const nl = pending.indexOf('\n');
    if (nl >= 0) {
      const line = pending.slice(0, nl);
      pending = pending.slice(nl + 1);
      return line.trim();
    }
    let n = 0;
    try {
      n = readSync(0, buf, 0, buf.length, null);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'EAGAIN') continue;
      if (code === 'EOF') break;
      throw e;
    }
    if (n === 0) break;
    pending += buf.toString('utf8', 0, n);
  }
  const rest = pending.trim();
  pending = '';
  return rest;
}

function ask(question: string): string {
  process.stdout.write(`${question} `);
  const answer = readLine();
  // A terminal echoes the user's Enter for us; a pipe does not, and without
  // this every prompt and the line after it run together.
  if (!process.stdin.isTTY) process.stdout.write('\n');
  return answer;
}

function choose<T>(question: string, options: readonly { label: string; value: T }[]): T {
  // A caller that offers nothing would otherwise spin here forever, rejecting
  // every answer against an empty range.
  if (options.length === 0) throw new Error(`no options offered for: ${question}`);
  if (options.length === 1) {
    say(C.dim(`${question}  → ${options[0]!.label} (only option)`));
    return options[0]!.value;
  }
  say(question);
  for (const [i, o] of options.entries()) say(`   ${C.bold(String(i + 1))}) ${o.label}`);
  for (;;) {
    const n = Number(ask(C.cyan('>')));
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1]!.value;
    say(C.red(`  pick 1–${options.length}`));
  }
}

const yes = (question: string, dflt = true): boolean => {
  const a = ask(`${question} ${C.dim(dflt ? '[Y/n]' : '[y/N]')}`).toLowerCase();
  return a === '' ? dflt : a.startsWith('y');
};

// ─── rendering ───────────────────────────────────────────────────────────────

const pretty = (id: string) => id.replace(/^bed_/, "").replace(/_/g, ' ');
const roomName = (house: GameState['config']['house'], id: RoomId) =>
  isBedroom(house, id) ? `${pretty(id)}'s room` : pretty(id);
const who = (p: PlayerId) => C.bold(p);

function describe(state: GameState, e: PublicEvent, me: PlayerId): string | null {
  const h = state.config.house;
  const r = (id: RoomId) => roomName(h, id);
  switch (e.t) {
    case 'theft':
      return C.red(`the light in ${r(e.room)} went out`);
    case 'trail':
      return C.amber(`the trail leads to ${who(e.player)}`) + C.dim(` — seen near ${r(e.room)}`);
    case 'itemSpawned':
      return C.dim(`a ${e.item} is lying in ${r(e.room)}`);
    case 'itemTaken':
      return C.dim(`${who(e.player)} picked up a ${e.item} in ${r(e.room)}`);
    case 'grip':
      return `${who(e.player)} came away holding a ${e.item}`;
    case 'oddity': {
      const p = (e.payload ?? {}) as { count?: number; crossed?: boolean; floor?: number };
      const n = p.count ?? 0;
      switch (e.detail) {
        case 'adjacentCount':
          return C.cyan(`${who('bell')} never sleeps first: ${C.bold(String(n))} ` +
            `${n === 1 ? 'person was' : 'people were'} in the rooms next door`);
        case 'floorCrossing':
          return C.cyan(`${who('pike')} counts stairs: ` +
            (p.crossed ? 'someone used them tonight' : C.bold('nobody used them tonight')));
        case 'itemHolders':
          return C.cyan(`${who('clem')} watches hands: ${C.bold(String(n))} ` +
            `${n === 1 ? 'other in the room was' : 'others in the room were'} carrying something`);
        case 'atticTell':
          return C.cyan(`${who('wren')} was in the attic tonight`);
        case 'thiefFloor':
          // Spec §8 gives this to Sparrow alone; the engine currently pushes it
          // to the public stream anyway (a booked ruling in the findings doc,
          // "Sparrow's oddity is broadcast to everybody"). Showing it only to
          // Sparrow keeps this build faithful to §8 without touching the engine.
          return me === 'sparrow'
            ? C.cyan(`You listened at the door: the thief ended the night ` +
              C.bold(p.floor === 1 ? 'upstairs' : 'downstairs'))
            : null;
        default:
          return C.cyan(`${who(e.source)}: ${e.detail}`);
      }
    }
    case 'callPosted':
      return C.bold(C.amber(`CALL — ${e.caller} names ${e.target}: meet in ${r(e.room)}`));
    case 'callResolved': {
      const verdict = {
        caught: C.green('CAUGHT'), cleared: C.green('cleared'),
        noShow: C.red('did not come'), fizzled: C.dim('not enough hands'),
      }[e.outcome];
      return `the call on ${who(e.target)} in ${r(e.room)}: ${verdict} ${C.dim(`(${e.hands} hand${e.hands === 1 ? '' : 's'})`)}`;
    }
    case 'keyhole':
      return C.cyan(`${who(e.spender)} used a keyhole on ${r(e.room)}, night ${e.night}: ` +
        (e.occupants.length ? e.occupants.join(', ') : 'nobody was there'));
    case 'bellCast':
      return C.cyan(`${who(e.spender)} set a bell watching ${who(e.target)}`);
    case 'bell':
      return C.cyan(`the bell says ${who(e.target)} slept in ${r(e.room)}`);
    case 'lantern':
      return C.cyan(`${who(e.spender)} lit a lantern in ${r(e.room)}`);
    case 'eyesOpen':
      return C.red(`${who(e.player)} — ${e.reason}`);
    case 'reported': {
      const tail = e.lit
        ? (e.named.length ? ` and saw ${e.named.join(', ')}` : ' and saw nobody')
        : ` — dark${e.others ? `, ${e.others} other${e.others > 1 ? 's' : ''} in there` : ', alone'}`;
      const name = e.player === me ? C.dim(`${e.player} (you)`) : who(e.player);
      return `${name} says: slept in ${r(e.room)}${C.dim(tail)}`;
    }
  }
}

function showEvents(state: GameState, events: readonly PublicEvent[], me: PlayerId) {
  const lines = events.map((e) => describe(state, e, me)).filter((l): l is string => l !== null);
  if (!lines.length) { say(C.dim('   the house was quiet')); return; }
  for (const l of lines) say(`   · ${l}`);
}

function showSighting(state: GameState, s: Sighting, phase: string) {
  const h = state.config.house;
  if (s.lit) {
    say(C.dim(`   ${phase}: you are in ${roomName(h, s.room)}. `) +
      (s.named.length ? `With you: ${s.named.map(who).join(', ')}.` : C.dim('You are alone.')));
  } else {
    say(C.dim(`   ${phase}: ${roomName(h, s.room)} is dark. `) +
      (s.named.length
        ? `You can make out: ${s.named.map(who).join(', ')}.`
        : s.others
          ? `You can hear ${s.others} other${s.others > 1 ? 's' : ''} breathing.`
          : C.dim('You are alone.')));
  }
}

function showHouse(state: GameState, me: PlayerId) {
  const h = state.config.house;
  const beds = Object.keys(h.rooms).filter((r) => isBedroom(h, r)).sort();
  const out = beds.map((b) => {
    const mine = ownerOf(h, b) === me;
    const label = `${pretty(b)}${mine ? '*' : ''}`;
    return isLit(state, b) ? C.amber(`● ${label}`) : C.grey(`○ ${label}`);
  });
  const dark = darkBedroomCount(state);
  say(`   ${out.join('   ')}`);
  say(C.dim(`   ${dark} of ${state.config.lightsRequired} lights needed by Odd Socks are out` +
    `${me ? '   (* your room)' : ''}`));
}

// ─── the human seat ──────────────────────────────────────────────────────────

/**
 * No room is ever forbidden. A Call is an invitation, not a fence: walking into
 * one is how an innocent clears themselves and how the villain gets caught, so
 * the choice to dodge has to stay the player's.
 */
function pickPath(state: GameState, from: RoomId): Path {
  const h = state.config.house;
  const first = choose(C.dim('  A night is two rooms, then two more. Step through:'),
    doorsOf(h, from).sort().map((d) => ({ label: roomName(h, d), value: d })));
  const second = choose(C.dim('  …and sleep in:'), doorsOf(h, first).sort().map((d) => ({
    label: `${roomName(h, d)}${isBedroom(h, d) && isLit(state, d) ? C.amber(' (lit)') : ''}` +
      `${d === from ? C.dim(' — back where you started') : ''}`,
    value: d,
  })));
  return [first, second] as const;
}

function humanDusk(state: GameState, k: Knowledge): DuskAction {
  rule(`NIGHT ${k.night} · DUSK`);
  showHouse(state, k.me);
  say();
  say(`   You are ${who(k.me)}${k.isVillain ? C.red('  — ODD SOCKS') : ''}, in ` +
    `${C.bold(roomName(k.config.house, k.position))}.`);
  say(C.dim(`   Holding: ${k.held.length ? k.held.join(', ') : 'nothing'}`));
  const loose = Object.entries(state.loose).filter(([, v]) => v.length);
  if (loose.length) {
    say(C.dim(`   Lying about: ${loose.map(([r, v]) =>
      `${v.join('/')} in ${roomName(k.config.house, r)}`).join(', ')}`));
  }
  say();
  const path = pickPath(state, k.position);
  const pickUp = yes(C.dim('  Pick anything up you find there?'));
  return { path, pickUp };
}

function humanMidnight(state: GameState, k: Knowledge): MidnightAction {
  rule(`NIGHT ${k.night} · MIDNIGHT`);
  const call = k.activeCall;
  if (call) {
    say(`   ${C.amber('A call is out:')} ${who(call.caller)} names ${who(call.target)} — ` +
      `meet in ${C.bold(roomName(k.config.house, call.room))}.`);
    if (call.target === k.me) {
      say(C.dim('   That is you. Go and clear yourself, or stay away and wear the suspicion.'));
    }
    say();
  }
  say(`   You are in ${C.bold(roomName(k.config.house, k.position))}. ` +
    C.dim(`Holding: ${k.held.length ? k.held.join(', ') : 'nothing'}`));
  say();
  const path = pickPath(state, k.position);
  const end = path[1];

  let joinCall = false;
  if (call && canJoinCall(state, k.me) && call.target !== k.me) {
    joinCall = end === call.room
      ? yes(C.dim(`  Lay a hand on the call? ${C.dim('(spends an item)')}`), false)
      : false;
    if (!joinCall && end !== call.room) {
      say(C.dim('  (you are not ending the night in the called room, so you cannot join it)'));
    }
  }

  let snuffOwn = false;
  const myBed = `bed_${k.me}`;
  if (k.isVillain && end === myBed && state.lit[myBed] === true && k.night > 1) {
    say(C.dim('  Your own light is still burning, and you are standing under it.'));
    snuffOwn = yes(C.red('  Snuff your own light?'), false);
  }
  return { path, joinCall, snuffOwn };
}

function humanMorning(
  state: GameState, k: Knowledge, tonight: readonly PublicEvent[],
): MorningAction {
  const h = k.config.house;
  rule(`NIGHT ${k.night} · MORNING`);
  say(C.bold('   In the night:'));
  showEvents(state, tonight, k.me);
  say();

  const mine = k.mySightings[k.mySightings.length - 1];
  if (mine) { showSighting(state, mine, 'You slept'); say(); }

  if (!canClaim(state, k.me)) {
    say(C.dim('   Your light is out. You say nothing this morning.'));
    return { claim: null, call: null, itemUses: [] };
  }

  const truth = mine?.room ?? k.position;
  const rooms = Object.keys(h.rooms).sort();
  const claim = yes(`   Say you slept in ${C.bold(roomName(h, truth))}?`, true)
    ? truth
    : choose(C.dim('   Where will you say you slept?'),
      rooms.map((r) => ({
        label: `${roomName(h, r)}${r === truth ? C.dim(' — the truth') : ''}`, value: r,
      })));

  const itemUses: ItemUse[] = [];
  for (const item of [...k.held]) {
    if (!yes(`   Spend your ${C.bold(item)}?`, false)) continue;
    const use = spendPrompt(state, k, item);
    if (use) itemUses.push(use);
  }

  let call: MorningAction['call'] = null;
  if (yes('   Set a call on someone?', false)) {
    const target = choose(C.dim('   Who?'),
      ROSTER.map((p) => ({ label: `${p}${p === k.me ? C.dim(' — yourself') : ''}`, value: p })));
    const legal = Object.keys(h.rooms).filter((r) => canPostCall(state, target, r)).sort();
    if (!legal.length) {
      say(C.dim('   No lit bedroom left to set it in.'));
    } else {
      const room = choose(C.dim('   Where do they have to be?'),
        legal.map((r) => ({
          label: `${roomName(h, r)}${r === `bed_${target}` ? C.dim(' — their own room') : ''}`,
          value: r,
        })));
      call = { caller: k.me, target, room, selfNominated: target === k.me };
    }
  }
  return { claim, call, itemUses };
}

/** `null` when the item has nothing it could usefully do tonight. */
function spendPrompt(state: GameState, k: Knowledge, item: ItemKind): ItemUse | null {
  const h = k.config.house;

  if (item === 'lantern') {
    const dark = Object.keys(h.rooms).filter((r) => isBedroom(h, r) && !isLit(state, r)).sort();
    if (!dark.length) {
      say(C.dim('   Every light in the house is still burning. Keep it.'));
      return null;
    }
    return {
      kind: 'lantern', spender: k.me,
      room: choose(C.dim('   Relight which room for tonight?'),
        dark.map((r) => ({ label: roomName(h, r), value: r }))),
    };
  }

  if (item === 'bell') {
    return {
      kind: 'bell', spender: k.me,
      target: choose(C.dim('   Set the bell watching whom?'),
        ROSTER.filter((p) => p !== k.me).map((p) => ({ label: p, value: p }))),
    };
  }

  // A Keyhole reads a night that has already been written down. On the first
  // morning there is no such night, and `applyItemUses` throws on one it cannot
  // find — so there is nothing to offer yet.
  const nights = state.history.map((r) => r.night);
  if (!nights.length) {
    say(C.dim('   There is no night behind you yet to look back at. Keep it.'));
    return null;
  }
  const room = choose(C.dim('   Look through the keyhole of which room?'),
    Object.keys(h.rooms).sort().map((r) => ({ label: roomName(h, r), value: r })));
  const night = choose(C.dim('   On which night?'),
    nights.map((n) => ({ label: `night ${n}`, value: n })));
  return { kind: 'keyhole', spender: k.me, room, night };
}

// ─── the loop ────────────────────────────────────────────────────────────────

interface Options { seat: PlayerId; seed: number; role: 'villain' | 'child' | 'any' }

function parseArgs(argv: readonly string[]): Options {
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const seat = get('seat');
  if (seat && !ROSTER.includes(seat as never)) {
    say(C.red(`unknown seat "${seat}" — pick one of ${ROSTER.join(', ')}`));
    process.exit(1);
  }
  const role = (get('role') ?? 'any') as Options['role'];
  if (!['villain', 'child', 'any'].includes(role)) {
    say(C.red('--role must be villain, child or any'));
    process.exit(1);
  }
  return {
    seat: (seat ?? ROSTER[Math.floor(Math.random() * ROSTER.length)]!) as PlayerId,
    seed: Number(get('seed') ?? Math.floor(Math.random() * 1e9)),
    role,
  };
}

/** The villain is drawn inside `createGame`, so honouring --role means hunting a seed. */
function findSeed(config: GameConfig, opts: Options): number {
  if (opts.role === 'any') return opts.seed;
  for (let s = opts.seed; s < opts.seed + 5000; s++) {
    const probe = createGame(config, makeRng(s));
    const isVillain = probe.villain === opts.seat;
    if (isVillain === (opts.role === 'villain')) return s;
  }
  return opts.seed;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = makeConfig();
  const seed = findSeed(config, opts);
  const rng: Rng = makeRng(seed);
  const state = createGame(config, rng);
  const me = opts.seat;

  const sightingLog: Record<PlayerId, Sighting[]> =
    Object.fromEntries(config.roster.map((p) => [p, [] as Sighting[]]));
  const claimLog: Record<PlayerId, RoomId | null>[] = [];
  const kFor = (p: PlayerId) => knowledgeFor(state, p, sightingLog[p]!, claimLog);

  say();
  say(C.bold('   ODD SOCKS'));
  say(C.dim(`   six children, one of them is not asleep     seed ${seed}`));
  say();
  say(`   You are ${C.bold(me)}.`);
  say(state.villain === me
    ? C.red('   You are Odd Socks. Put out five lights before the week is done.\n' +
      '   You are the only one who may lie about where you slept.')
    : C.dim('   You are a child. Survive to the weekend, or catch them in a call.'));
  say();
  say(C.dim(`   Nights: ${config.totalNights}. Odd Socks needs ${config.lightsRequired} lights.\n` +
    '   Night one is safe — nothing can be stolen.'));
  ask(C.dim('   [enter]'));

  let extraNights = 0;
  for (let night = 1; night <= config.totalNights + extraNights; night++) {
    state.night = night;

    const dusk = runDusk(state, Object.fromEntries(config.roster.map((p) => [p,
      p === me ? humanDusk(state, kFor(p)) : heuristicBot.dusk(kFor(p), rng),
    ])) as Record<PlayerId, DuskAction>, rng);
    say();
    showSighting(state, dusk.sightings[me]!, 'At dusk');
    say(C.dim('   (what you see at dusk is yours alone — only midnight becomes testimony)'));
    say();

    const midnight = runMidnight(state, dusk, Object.fromEntries(config.roster.map((p) => [p,
      p === me ? humanMidnight(state, kFor(p)) : heuristicBot.midnight(kFor(p), rng),
    ])) as Record<PlayerId, MidnightAction>, rng);
    for (const p of config.roster) sightingLog[p]!.push(midnight.sightings[p]!);
    say();

    const tonight = [...dusk.events, ...midnight.events];
    const myMorning = humanMorning(state, kFor(me), tonight);
    const morning = runMorning(state, dusk, midnight, Object.fromEntries(
      config.roster.map((p) => [p,
        p === me ? myMorning : heuristicBot.morning(kFor(p), rng),
      ])) as Record<PlayerId, MorningAction>, rng);
    claimLog.push(morning.claims);

    if (myMorning.call) {
      const mine = myMorning.call;
      const wentUp = state.activeCall !== null
        && state.activeCall.caller === mine.caller
        && state.activeCall.target === mine.target
        && state.activeCall.room === mine.room;
      if (!wentUp) {
        say(C.dim(canPostCall(state, mine.target, mine.room)
          ? '   (another Call took the only slot tonight — yours did not go up)'
          : '   (that room was no longer legal for a Call by the time morning resolved — yours did not go up)'));
      }
    }

    state.history.push({
      night,
      duskPositions: dusk.positions,
      midnightPositions: midnight.positions,
      events: [...dusk.events, ...midnight.events, ...morning.events],
      sightings: midnight.sightings,
      claims: morning.claims,
      reporters: morning.reporters,
      callPool: midnight.callPool,
      marked: midnight.marked,
    });

    say();
    say(C.bold('   Around the table:'));
    showEvents(state, morning.events, me);
    say();

    if (!config.selfSnuffCostsNight && extraNights === 0 && midnight.theft.selfSnuff) extraNights = 1;
    if (state.over) break;
    if (darkBedroomCount(state) >= config.lightsRequired) {
      state.over = { winner: 'oddsocks', how: 'lightsOut' };
      break;
    }
    ask(C.dim('   [enter to sleep]'));
  }

  const outcome = state.over ?? { winner: 'children' as const, how: 'survived' as const };
  const iWon = (outcome.winner === 'oddsocks') === (state.villain === me);
  say();
  rule();
  say();
  const headline = {
    lightsOut: 'The last light goes out. Odd Socks has the house.',
    caught: 'A hand closes on a shoulder in the dark. They had them all along.',
    survived: 'Morning, properly. Everyone is accounted for.',
  }[outcome.how];
  say(`   ${C.bold(headline)}`);
  say(C.dim(`   Odd Socks was ${C.bold(state.villain)}.`));
  say(`   ${iWon ? C.green('   You won.') : C.red('   You lost.')}`);
  say();
  say(C.dim(`   Replay this exact game:  npm run play -- --seat=${me} --seed=${seed}`));
  say();
}

main();
