# ODD SOCKS Simulation Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless, deterministic six-player ODD SOCKS rules engine with bot drivers and a policy-independent measurement suite, so the design's information economy can be validated before any human plays it.

**Architecture:** Pure functions with no I/O under `src/rules/`, driven today by bots and later by a real server unchanged. Two boundaries carry the design: `projectView(truth, playerId)` isolates all who-knows-what logic in one testable place, and a seeded RNG makes every game reproducible from `(seed, config)`. Measurement is a dynamic-programming solver that computes whether a safe lie *existed* for the villain, rather than simulating a specific liar.

**Tech Stack:** TypeScript (strict), Node 24, Vitest, tsx. Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-26-odd-socks-sim-harness-design.md`

## Global Constraints

- **Six players only.** Player counts 7–10 and the two-villain duo are out of scope.
- **No runtime dependencies.** Dev dependencies are limited to `typescript`, `vitest`, `tsx`, `@types/node`.
- **Everything pure.** Nothing under `src/rules/` may perform I/O, read the clock, or call `Math.random()`. All randomness arrives as an injected `Rng`.
- **Every tunable lives in `GameConfig`.** No magic numbers in engine code. A sweep must be a parameter matrix, never a code edit.
- **TypeScript strict mode on.** `strict: true`, `noUncheckedIndexedAccess: true`.
- **Six-child roster:** `bell`, `pike`, `clem`, `wren`, `sparrow`, `moss`. These exact lowercase ids are used as `PlayerId` throughout.
- **Bedroom ids** are `bed_<playerId>`, e.g. `bed_bell`.
- **Numbers for six players:** 5 lights required, 6 active nights, 7 nights total, night 1 safe.
- **Commit after every task.** Conventional commit messages (`feat:`, `test:`, `chore:`).

## File Structure

| File | Responsibility |
|---|---|
| `src/rules/rng.ts` | Seeded deterministic random source |
| `src/rules/types.ts` | All domain types; no logic |
| `src/rules/houses/hollow.ts` | The canonical 12-room map, as data |
| `src/rules/map.ts` | Graph queries: doors, adjacency, legal 2-edge paths, distance |
| `src/rules/config.ts` | `GameConfig`, `DEFAULT_CONFIG`, the roster |
| `src/rules/state.ts` | `GameState` shape and `createGame` |
| `src/rules/movement.ts` | Path validation and movement resolution |
| `src/rules/visibility.ts` | `projectView` — the information boundary |
| `src/rules/theft.ts` | Theft, Grip, trail, Hush |
| `src/rules/marking.ts` | Marking |
| `src/rules/items.ts` | Pool, spawn, pickup, respawn |
| `src/rules/itemEffects.ts` | Lantern, Keyhole, Bell |
| `src/rules/call.ts` | Call posting and resolution |
| `src/rules/oddities.ts` | The six oddities |
| `src/rules/night.ts` | `resolveNight` — orchestration and ordering |
| `src/rules/game.ts` | `playGame`, win conditions |
| `src/bots/types.ts` | The `Bot` interface |
| `src/bots/random.ts` | Uniform legal play |
| `src/bots/heuristic.ts` | Goal-directed play |
| `src/analysis/safeLies.ts` | The DP solver |
| `src/analysis/metrics.ts` | Per-game metric extraction |
| `src/analysis/sweep.ts` | Config matrix runner |
| `src/analysis/report.ts` | Console tables |
| `src/cli/sweep.ts` | Entrypoint |

---

### Task 1: Scaffold and seeded RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/rules/rng.ts`
- Test: `src/rules/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Rng` interface with `next(): number` (float in `[0,1)`), `int(n: number): number` (integer in `[0,n)`), `pick<T>(xs: readonly T[]): T`, `shuffle<T>(xs: readonly T[]): T[]`. Factory `makeRng(seed: number): Rng`.

- [ ] **Step 1: Create the project files**

`package.json`:
```json
{
  "name": "odd-socks-sim",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "sweep": "tsx src/cli/sweep.ts"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

`.gitignore`:
```
node_modules/
dist/
*.log
```

Then run `npm install`.

- [ ] **Step 2: Write the failing test**

`src/rules/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';

describe('makeRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, () => makeRng(1).next());
    const b = Array.from({ length: 20 }, () => makeRng(2).next());
    expect(a).not.toEqual(b);
  });

  it('next() stays within [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) stays within [0, n)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('shuffle is a permutation and does not mutate its input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const frozen = [...input];
    const out = makeRng(3).shuffle(input);
    expect(input).toEqual(frozen);
    expect([...out].sort((x, y) => x - y)).toEqual(frozen);
  });

  it('pick returns a member of the array', () => {
    const xs = ['a', 'b', 'c'];
    const r = makeRng(9);
    for (let i = 0; i < 50; i++) expect(xs).toContain(r.pick(xs));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/rules/rng.test.ts`
Expected: FAIL — cannot resolve `./rng.js`.

- [ ] **Step 4: Write the implementation**

`src/rules/rng.ts`:
```ts
export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
}

/** mulberry32 — small, fast, and adequate for simulation. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (n: number): number => {
    if (n <= 0) throw new Error(`int(n) requires n > 0, got ${n}`);
    return Math.floor(next() * n);
  };

  const pick = <T,>(xs: readonly T[]): T => {
    if (xs.length === 0) throw new Error('pick() on empty array');
    return xs[int(xs.length)]!;
  };

  const shuffle = <T,>(xs: readonly T[]): T[] => {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  return { next, int, pick, shuffle };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/rules/rng.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/rules/rng.ts src/rules/rng.test.ts
git commit -m "feat: project scaffold and seeded deterministic RNG"
```

---

### Task 2: Domain types, the canonical house, and graph queries

**Files:**
- Create: `src/rules/types.ts`, `src/rules/houses/hollow.ts`, `src/rules/map.ts`
- Test: `src/rules/map.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types `PlayerId`, `RoomId`, `OddityId`, `ItemKind`, `Phase`, `Path`, `Room`, `House`.
  - `HOLLOW_HOUSE: House`.
  - `doorsOf(house, room): RoomId[]`, `isBedroom(house, room): boolean`, `ownerOf(house, room): PlayerId | undefined`, `bedroomOf(house, player): RoomId`, `floorOf(house, room): 0 | 1`, `adjacent(house, a, b): boolean`, `legalPaths(house, from): Path[]`, `isLegalPath(house, from, path): boolean`, `distance(house, a, b): number`, `roomsWithin(house, room, n): RoomId[]`.

- [ ] **Step 1: Write the failing test**

`src/rules/map.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { HOLLOW_HOUSE } from './houses/hollow.js';
import {
  doorsOf, isBedroom, ownerOf, bedroomOf, floorOf, adjacent,
  legalPaths, isLegalPath, distance, roomsWithin,
} from './map.js';

const H = HOLLOW_HOUSE;
const ROOMS = Object.keys(H.rooms);

describe('Hollow House', () => {
  it('has 12 rooms: 6 bedrooms and 6 commons', () => {
    expect(ROOMS).toHaveLength(12);
    expect(ROOMS.filter((r) => isBedroom(H, r))).toHaveLength(6);
    expect(ROOMS.filter((r) => !isBedroom(H, r))).toHaveLength(6);
  });

  it('gives every child exactly one owned bedroom', () => {
    for (const p of ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss']) {
      const bed = bedroomOf(H, p);
      expect(bed).toBe(`bed_${p}`);
      expect(ownerOf(H, bed)).toBe(p);
    }
  });

  it('has every door bidirectional', () => {
    for (const a of ROOMS) {
      for (const b of doorsOf(H, a)) {
        expect(doorsOf(H, b)).toContain(a);
      }
    }
  });

  it('has 14 edges', () => {
    const total = ROOMS.reduce((n, r) => n + doorsOf(H, r).length, 0);
    expect(total).toBe(28);
  });

  it('is fully connected with diameter 4', () => {
    let max = 0;
    for (const a of ROOMS) {
      for (const b of ROOMS) {
        const d = distance(H, a, b);
        expect(d).toBeLessThan(Infinity);
        max = Math.max(max, d);
      }
    }
    expect(max).toBe(4);
  });

  it('has two staircases and no others', () => {
    const stairs: string[] = [];
    for (const a of ROOMS) {
      for (const b of doorsOf(H, a)) {
        if (floorOf(H, a) !== floorOf(H, b) && a < b) stairs.push(`${a}->${b}`);
      }
    }
    expect(stairs.sort()).toEqual(['east_hall->sewing_room', 'landing->west_hall']);
  });
});

describe('paths', () => {
  it('treats a two-edge path as legal only if both steps are through doors', () => {
    expect(isLegalPath(H, 'bed_bell', ['west_hall', 'kitchen'])).toBe(true);
    expect(isLegalPath(H, 'bed_bell', ['kitchen', 'west_hall'])).toBe(false);
    expect(isLegalPath(H, 'bed_bell', ['west_hall', 'attic'])).toBe(false);
  });

  it('lets you stay home by stepping out and back', () => {
    expect(isLegalPath(H, 'bed_bell', ['west_hall', 'bed_bell'])).toBe(true);
  });

  it('enumerates every legal path from a room', () => {
    // bed_bell has one door (west_hall, degree 4) -> 4 paths.
    expect(legalPaths(H, 'bed_bell')).toHaveLength(4);
    // Every enumerated path must itself be legal.
    for (const room of ROOMS) {
      for (const p of legalPaths(H, room)) {
        expect(isLegalPath(H, room, p)).toBe(true);
      }
    }
  });

  it('can always stay home from any room', () => {
    for (const room of ROOMS) {
      const home = legalPaths(H, room).filter((p) => p[1] === room);
      expect(home.length).toBeGreaterThan(0);
    }
  });
});

describe('roomsWithin', () => {
  it('includes the room itself and its neighbours at radius 1', () => {
    expect(roomsWithin(H, 'bed_bell', 1).sort()).toEqual(['bed_bell', 'west_hall']);
    expect(roomsWithin(H, 'attic', 1).sort()).toEqual(['attic', 'bed_moss', 'landing']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/map.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the domain types**

`src/rules/types.ts`:
```ts
export type PlayerId = string;
export type RoomId = string;

export type OddityId = 'bell' | 'pike' | 'clem' | 'wren' | 'sparrow' | 'moss';
export type ItemKind = 'lantern' | 'keyhole' | 'bell';
export type Phase = 'dusk' | 'midnight';

/** The two rooms stepped into during one phase. The second is where you end. */
export type Path = readonly [RoomId, RoomId];

export interface Room {
  readonly id: RoomId;
  readonly kind: 'bedroom' | 'common';
  readonly floor: 0 | 1;
  /** Present on bedrooms only. */
  readonly owner?: PlayerId;
  readonly doors: readonly RoomId[];
}

export interface House {
  readonly id: string;
  readonly rooms: Readonly<Record<RoomId, Room>>;
}
```

- [ ] **Step 4: Write the house data**

`src/rules/houses/hollow.ts`:
```ts
import type { House, Room } from '../types.js';

const room = (
  id: string, kind: 'bedroom' | 'common', floor: 0 | 1,
  doors: string[], owner?: string,
): Room => ({ id, kind, floor, doors, ...(owner ? { owner } : {}) });

/**
 * Hollow House — 12 rooms, 6 bedrooms, 6 commons, two floors, 14 edges.
 * Diameter 4, so crossing the house takes exactly two nights.
 * Two staircases, so no single choke point carries every floor crossing.
 */
export const HOLLOW_HOUSE: House = {
  id: 'hollow',
  rooms: Object.fromEntries(
    [
      // Ground floor
      room('kitchen',     'common',  0, ['west_hall', 'east_hall', 'bed_pike']),
      room('west_hall',   'common',  0, ['kitchen', 'bed_bell', 'bed_pike', 'landing']),
      room('east_hall',   'common',  0, ['kitchen', 'bed_clem', 'sewing_room']),
      room('bed_bell',    'bedroom', 0, ['west_hall'], 'bell'),
      room('bed_pike',    'bedroom', 0, ['west_hall', 'kitchen'], 'pike'),
      room('bed_clem',    'bedroom', 0, ['east_hall'], 'clem'),
      // Upper floor
      room('landing',     'common',  1, ['west_hall', 'sewing_room', 'attic', 'bed_wren']),
      room('sewing_room', 'common',  1, ['east_hall', 'landing', 'bed_sparrow', 'bed_moss']),
      room('attic',       'common',  1, ['landing', 'bed_moss']),
      room('bed_wren',    'bedroom', 1, ['landing'], 'wren'),
      room('bed_sparrow', 'bedroom', 1, ['sewing_room'], 'sparrow'),
      room('bed_moss',    'bedroom', 1, ['sewing_room', 'attic'], 'moss'),
    ].map((r) => [r.id, r]),
  ),
};
```

- [ ] **Step 5: Write the graph queries**

`src/rules/map.ts`:
```ts
import type { House, Path, PlayerId, RoomId } from './types.js';

const roomOf = (house: House, id: RoomId) => {
  const r = house.rooms[id];
  if (!r) throw new Error(`unknown room: ${id}`);
  return r;
};

export const doorsOf = (house: House, id: RoomId): RoomId[] => [...roomOf(house, id).doors];
export const isBedroom = (house: House, id: RoomId): boolean => roomOf(house, id).kind === 'bedroom';
export const ownerOf = (house: House, id: RoomId): PlayerId | undefined => roomOf(house, id).owner;
export const floorOf = (house: House, id: RoomId): 0 | 1 => roomOf(house, id).floor;
export const adjacent = (house: House, a: RoomId, b: RoomId): boolean =>
  roomOf(house, a).doors.includes(b);

export function bedroomOf(house: House, player: PlayerId): RoomId {
  const found = Object.values(house.rooms).find((r) => r.owner === player);
  if (!found) throw new Error(`no bedroom for player: ${player}`);
  return found.id;
}

export function isLegalPath(house: House, from: RoomId, path: Path): boolean {
  const [a, b] = path;
  return adjacent(house, from, a) && adjacent(house, a, b);
}

export function legalPaths(house: House, from: RoomId): Path[] {
  const out: Path[] = [];
  for (const a of doorsOf(house, from)) {
    for (const b of doorsOf(house, a)) out.push([a, b] as const);
  }
  return out;
}

/** Breadth-first hop count. Returns Infinity if unreachable. */
export function distance(house: House, a: RoomId, b: RoomId): number {
  if (a === b) return 0;
  const seen = new Set<RoomId>([a]);
  let frontier: RoomId[] = [a];
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: RoomId[] = [];
    for (const cur of frontier) {
      for (const n of doorsOf(house, cur)) {
        if (seen.has(n)) continue;
        if (n === b) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Every room reachable in `n` hops or fewer, including `room` itself. */
export function roomsWithin(house: House, room: RoomId, n: number): RoomId[] {
  return Object.keys(house.rooms).filter((r) => distance(house, room, r) <= n);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/rules/map.test.ts`
Expected: PASS. If the diameter assertion fails, the map data is wrong — fix `hollow.ts`, never the test.

- [ ] **Step 7: Commit**

```bash
git add src/rules/types.ts src/rules/houses/hollow.ts src/rules/map.ts src/rules/map.test.ts
git commit -m "feat: domain types, Hollow House map, and graph queries"
```

---

### Task 3: Config and roster

**Files:**
- Create: `src/rules/config.ts`
- Test: `src/rules/config.test.ts`

**Interfaces:**
- Consumes: `House` from `types.ts`, `HOLLOW_HOUSE`.
- Produces: `GameConfig`, `DEFAULT_CONFIG`, `ROSTER: readonly PlayerId[]`, `ODDITY_OF: Record<PlayerId, OddityId>`, `makeConfig(overrides: Partial<GameConfig>): GameConfig`.

- [ ] **Step 1: Write the failing test**

`src/rules/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, ROSTER, ODDITY_OF, makeConfig } from './config.js';

describe('config', () => {
  it('has the six-child roster', () => {
    expect([...ROSTER]).toEqual(['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss']);
    for (const p of ROSTER) expect(ODDITY_OF[p]).toBe(p);
  });

  it('encodes the six-player numbers from the rules document', () => {
    expect(DEFAULT_CONFIG.lightsRequired).toBe(5);
    expect(DEFAULT_CONFIG.activeNights).toBe(6);
    expect(DEFAULT_CONFIG.totalNights).toBe(7);
    expect(DEFAULT_CONFIG.activeNights).toBe(DEFAULT_CONFIG.lightsRequired + 1);
    expect(DEFAULT_CONFIG.totalNights).toBe(DEFAULT_CONFIG.activeNights + 1);
  });

  it('defaults to the rulings recorded in the spec', () => {
    expect(DEFAULT_CONFIG.hushMode).toBe('silent');
    expect(DEFAULT_CONFIG.selfSnuffCostsNight).toBe(true);
    expect(DEFAULT_CONFIG.sparrowMode).toBe('dusk');
    expect(DEFAULT_CONFIG.trailRadius).toBe(1);
    expect(DEFAULT_CONFIG.callHandsRequired).toBe(2);
    expect(DEFAULT_CONFIG.itemsOnMap).toBe(3);
    expect(DEFAULT_CONFIG.itemRespawnDelay).toBe(2);
    expect(DEFAULT_CONFIG.maxCallsPerNight).toBe(1);
    expect(DEFAULT_CONFIG.carryCapacity).toBe(1);
    expect(DEFAULT_CONFIG.mossCarryCapacity).toBe(2);
  });

  it('holds a reserve of five items', () => {
    const { itemCounts } = DEFAULT_CONFIG;
    expect(itemCounts.lantern + itemCounts.keyhole + itemCounts.bell).toBe(5);
  });

  it('makeConfig overlays without mutating the default', () => {
    const c = makeConfig({ hushMode: 'oneNight', trailRadius: 2 });
    expect(c.hushMode).toBe('oneNight');
    expect(c.trailRadius).toBe(2);
    expect(c.callHandsRequired).toBe(2);
    expect(DEFAULT_CONFIG.hushMode).toBe('silent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/config.test.ts`
Expected: FAIL — cannot resolve `./config.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/config.ts`:
```ts
import type { House, ItemKind, OddityId, PlayerId } from './types.js';
import { HOLLOW_HOUSE } from './houses/hollow.js';

export const ROSTER = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'] as const;

/** In build one each child's oddity shares their name. */
export const ODDITY_OF: Readonly<Record<PlayerId, OddityId>> = Object.fromEntries(
  ROSTER.map((p) => [p, p as OddityId]),
);

/** How the Hush restricts a snuffed child's mandatory claim. */
export type HushMode = 'silent' | 'oneNight' | 'none';

/** Whether Sparrow's oddity is the null version from v10.0 or the patched one. */
export type SparrowMode = 'asWritten' | 'dusk';

/** Which rungs of the build are switched on. */
export interface LayerFlags {
  items: boolean;
  oddities: boolean;
  marking: boolean;
}

export interface GameConfig {
  house: House;
  roster: readonly PlayerId[];

  lightsRequired: number;
  activeNights: number;
  totalNights: number;

  hushMode: HushMode;
  selfSnuffCostsNight: boolean;
  sparrowMode: SparrowMode;

  /** Trail names one child within this many hops of the robbed bedroom. */
  trailRadius: number;

  itemCounts: Record<ItemKind, number>;
  itemsOnMap: number;
  itemRespawnDelay: number;
  carryCapacity: number;
  mossCarryCapacity: number;

  callHandsRequired: number;
  maxCallsPerNight: number;

  layers: LayerFlags;
}

export const DEFAULT_CONFIG: GameConfig = {
  house: HOLLOW_HOUSE,
  roster: ROSTER,

  lightsRequired: 5,
  activeNights: 6,
  totalNights: 7,

  hushMode: 'silent',
  selfSnuffCostsNight: true,
  sparrowMode: 'dusk',

  trailRadius: 1,

  itemCounts: { lantern: 2, keyhole: 2, bell: 1 },
  itemsOnMap: 3,
  itemRespawnDelay: 2,
  carryCapacity: 1,
  mossCarryCapacity: 2,

  callHandsRequired: 2,
  maxCallsPerNight: 1,

  layers: { items: true, oddities: true, marking: true },
};

export function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
```

**Every field of `GameConfig` is `readonly`, and the nested containers are readonly too**
(`itemCounts: Readonly<Record<ItemKind, number>>`, `layers: Readonly<LayerFlags>`, and `LayerFlags`'s
own fields `readonly`). `makeConfig`'s shallow spread would otherwise hand every caller the *same*
`itemCounts` and `layers` objects that live inside `DEFAULT_CONFIG` — one in-place write anywhere in
seventeen later tasks would corrupt the default for the rest of the process, and a sweep would
report wrong numbers with no crash and no symptom. The readonly modifiers make that a compile error
instead. Keep the spread as written; it constructs a new object and still type-checks.

Add a test that fails if the modifiers are ever removed:

```ts
  it('forbids writing through a config', () => {
    const c = makeConfig();
    // @ts-expect-error itemCounts is readonly — mutating it would corrupt DEFAULT_CONFIG
    c.itemCounts.lantern = 999;
    expect(DEFAULT_CONFIG.itemCounts.lantern).toBe(2);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/config.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/config.ts src/rules/config.test.ts
git commit -m "feat: game config, roster, and the rulings as tunables"
```

---

### Task 4: Game state and setup

**Files:**
- Create: `src/rules/state.ts`
- Test: `src/rules/state.test.ts`

**Interfaces:**
- Consumes: `GameConfig`, `Rng`, map helpers.
- Produces:
  - `GameState` (see code below — later tasks read and write these exact field names).
  - `createGame(config: GameConfig, rng: Rng): GameState`
  - `isLit(state, room): boolean`
  - `darkBedroomCount(state): number` — bedrooms out, excluding the villain's own.
  - `capacityOf(state, player): number`
  - `canClaim(state, player): boolean` — whether the Hush permits a self-claim this morning.

- [ ] **Step 1: Write the failing test**

`src/rules/state.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, isLit, darkBedroomCount, capacityOf, canClaim } from './state.js';

const fresh = (seed = 1) => createGame(makeConfig(), makeRng(seed));

describe('createGame', () => {
  it('starts every child asleep in their own lit bedroom', () => {
    const s = fresh();
    for (const p of ROSTER) {
      expect(s.positions[p]).toBe(`bed_${p}`);
      expect(isLit(s, `bed_${p}`)).toBe(true);
    }
  });

  it('names exactly one villain from the roster', () => {
    const s = fresh();
    expect(ROSTER).toContain(s.villain);
  });

  it('is deterministic for a given seed', () => {
    expect(createGame(makeConfig(), makeRng(99)).villain)
      .toBe(createGame(makeConfig(), makeRng(99)).villain);
  });

  it('picks different villains across seeds', () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => createGame(makeConfig(), makeRng(i)).villain),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('opens on night 1 with a full item reserve and nothing loose', () => {
    const s = fresh();
    expect(s.night).toBe(1);
    expect(s.reserve).toHaveLength(5);
    expect(Object.values(s.loose).flat()).toHaveLength(0);
    expect(s.over).toBeNull();
  });

  it('starts nobody hushed, marked, or eyes-open', () => {
    const s = fresh();
    for (const p of ROSTER) {
      expect(s.hushedSince[p]).toBeNull();
      expect(s.marked[p]).toBe(false);
      expect(s.eyesOpen[p]).toBe(false);
      expect(s.held[p]).toEqual([]);
    }
  });
});

describe('state queries', () => {
  it('never counts the villain\'s own dark bedroom toward their win', () => {
    const s = fresh();
    s.lit[`bed_${s.villain}`] = false;
    expect(darkBedroomCount(s)).toBe(0);
    const other = ROSTER.find((p) => p !== s.villain)!;
    s.lit[`bed_${other}`] = false;
    expect(darkBedroomCount(s)).toBe(1);
  });

  it('treats common rooms as permanently lit', () => {
    const s = fresh();
    s.lit['kitchen'] = false;
    expect(isLit(s, 'kitchen')).toBe(true);
  });

  it('gives Moss a carry capacity of two', () => {
    const s = fresh();
    expect(capacityOf(s, 'moss')).toBe(2);
    expect(capacityOf(s, 'bell')).toBe(1);
  });

  it('silences a hushed child permanently under hushMode silent', () => {
    const s = fresh();
    s.hushedSince['bell'] = 3;
    s.night = 5;
    expect(canClaim(s, 'bell')).toBe(false);
    expect(canClaim(s, 'pike')).toBe(true);
  });

  it('silences a hushed child for one night only under hushMode oneNight', () => {
    const s = createGame(makeConfig({ hushMode: 'oneNight' }), makeRng(1));
    s.hushedSince['bell'] = 3;
    s.night = 3;
    expect(canClaim(s, 'bell')).toBe(false);
    s.night = 4;
    expect(canClaim(s, 'bell')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/state.test.ts`
Expected: FAIL — cannot resolve `./state.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/state.ts`:
```ts
import type { GameConfig } from './config.js';
import type { Rng } from './rng.js';
import type { ItemKind, PlayerId, RoomId } from './types.js';
import { bedroomOf, isBedroom } from './map.js';

export interface PostedCall {
  caller: PlayerId;
  target: PlayerId;
  room: RoomId;
  selfNominated: boolean;
}

export interface Sighting {
  room: RoomId;
  /** Names, when the room was lit (or the viewer sees in the dark). */
  named: PlayerId[];
  /** How many others shared the room, always accurate. */
  others: number;
  lit: boolean;
}

export type PublicEvent =
  | { t: 'theft'; room: RoomId; victim: PlayerId }
  | { t: 'selfSnuff'; room: RoomId }
  | { t: 'trail'; player: PlayerId; room: RoomId }
  | { t: 'itemTaken'; player: PlayerId; item: ItemKind; room: RoomId }
  | { t: 'itemSpawned'; item: ItemKind; room: RoomId }
  | { t: 'grip'; player: PlayerId; item: ItemKind }
  | { t: 'oddity'; source: PlayerId; detail: string; payload: unknown }
  | { t: 'callPosted'; caller: PlayerId; target: PlayerId; room: RoomId }
  | { t: 'callResolved'; target: PlayerId; room: RoomId; hands: number;
      outcome: 'caught' | 'cleared' | 'noShow' | 'fizzled' }
  | { t: 'keyhole'; spender: PlayerId; room: RoomId; night: number; occupants: PlayerId[] }
  | { t: 'bell'; spender: PlayerId; target: PlayerId; room: RoomId }
  | { t: 'lantern'; spender: PlayerId; room: RoomId }
  | { t: 'eyesOpen'; player: PlayerId; reason: string };

export interface NightRecord {
  night: number;
  duskPositions: Record<PlayerId, RoomId>;
  midnightPositions: Record<PlayerId, RoomId>;
  events: PublicEvent[];
  /** Truth of what each player observed at midnight. */
  sightings: Record<PlayerId, Sighting>;
  /** What each player said in the morning. `null` means the Hush exempted them. */
  claims: Record<PlayerId, RoomId | null>;
}

export interface GameState {
  config: GameConfig;
  night: number;
  villain: PlayerId;

  positions: Record<PlayerId, RoomId>;
  lit: Record<RoomId, boolean>;

  hushedSince: Record<PlayerId, number | null>;
  marked: Record<PlayerId, boolean>;
  eyesOpen: Record<PlayerId, boolean>;

  held: Record<PlayerId, ItemKind[]>;
  loose: Record<RoomId, ItemKind[]>;
  reserve: ItemKind[];
  returning: { item: ItemKind; night: number }[];

  /** Bell spent last morning: this player's midnight room is announced tonight. */
  bellWatch: PlayerId | null;
  /** Lantern spent last morning: this room is lit for tonight only. */
  lanternRoom: RoomId | null;

  activeCall: PostedCall | null;
  over: null | { winner: 'children' | 'oddsocks'; how: 'caught' | 'survived' | 'lightsOut' };

  history: NightRecord[];
}

export function createGame(config: GameConfig, rng: Rng): GameState {
  const { house, roster } = config;

  const positions: Record<PlayerId, RoomId> = {};
  const hushedSince: Record<PlayerId, number | null> = {};
  const marked: Record<PlayerId, boolean> = {};
  const eyesOpen: Record<PlayerId, boolean> = {};
  const held: Record<PlayerId, ItemKind[]> = {};
  for (const p of roster) {
    positions[p] = bedroomOf(house, p);
    hushedSince[p] = null;
    marked[p] = false;
    eyesOpen[p] = false;
    held[p] = [];
  }

  const lit: Record<RoomId, boolean> = {};
  const loose: Record<RoomId, ItemKind[]> = {};
  for (const id of Object.keys(house.rooms)) {
    lit[id] = true;
    loose[id] = [];
  }

  const reserve: ItemKind[] = [];
  for (const kind of ['lantern', 'keyhole', 'bell'] as ItemKind[]) {
    for (let i = 0; i < config.itemCounts[kind]; i++) reserve.push(kind);
  }

  return {
    config,
    night: 1,
    villain: rng.pick(roster),
    positions,
    lit,
    hushedSince,
    marked,
    eyesOpen,
    held,
    loose,
    reserve: rng.shuffle(reserve),
    returning: [],
    bellWatch: null,
    lanternRoom: null,
    activeCall: null,
    over: null,
    history: [],
  };
}

/** Common rooms can never go dark. A Lantern relights one bedroom for one night. */
export function isLit(state: GameState, room: RoomId): boolean {
  if (!isBedroom(state.config.house, room)) return true;
  if (state.lanternRoom === room) return true;
  return state.lit[room] === true;
}

/** Lights out that count toward the villain's win — their own never does. */
export function darkBedroomCount(state: GameState): number {
  return state.config.roster
    .filter((p) => p !== state.villain)
    .filter((p) => state.lit[`bed_${p}`] === false).length;
}

export function capacityOf(state: GameState, player: PlayerId): number {
  if (!state.config.layers.oddities) return state.config.carryCapacity;
  return player === 'moss' ? state.config.mossCarryCapacity : state.config.carryCapacity;
}

/** Whether the Hush permits this child to say where they slept tonight. */
export function canClaim(state: GameState, player: PlayerId): boolean {
  const since = state.hushedSince[player];
  if (since === null || since === undefined) return true;
  switch (state.config.hushMode) {
    case 'none': return true;
    case 'oneNight': return state.night !== since;
    case 'silent': return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/state.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/state.ts src/rules/state.test.ts
git commit -m "feat: game state, setup, and Hush claim eligibility"
```

---

### Task 5: Movement resolution

**Files:**
- Create: `src/rules/movement.ts`
- Test: `src/rules/movement.test.ts`

**Interfaces:**
- Consumes: `House`, `Path`, map helpers.
- Produces:
  - `interface MoveResult { positions: Record<PlayerId, RoomId>; steps: Record<PlayerId, [RoomId, RoomId]> }`
  - `resolveMovement(house, from: Record<PlayerId, RoomId>, paths: Record<PlayerId, Path>): MoveResult`
  - `crossedFloors(house, from: RoomId, steps: readonly RoomId[]): boolean`

Illegal paths throw rather than being silently corrected — a bot that submits one is a bug, and a
sweep that quietly clamps movement produces numbers that mean nothing.

- [ ] **Step 1: Write the failing test**

`src/rules/movement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { HOLLOW_HOUSE as H } from './houses/hollow.js';
import { resolveMovement, crossedFloors } from './movement.js';

describe('resolveMovement', () => {
  it('ends each player on the second room of their path', () => {
    const r = resolveMovement(H,
      { bell: 'bed_bell', clem: 'bed_clem' },
      { bell: ['west_hall', 'kitchen'], clem: ['east_hall', 'kitchen'] });
    expect(r.positions['bell']).toBe('kitchen');
    expect(r.positions['clem']).toBe('kitchen');
  });

  it('records the intermediate step', () => {
    const r = resolveMovement(H, { bell: 'bed_bell' }, { bell: ['west_hall', 'kitchen'] });
    expect(r.steps['bell']).toEqual(['west_hall', 'kitchen']);
  });

  it('allows staying home by stepping out and back', () => {
    const r = resolveMovement(H, { bell: 'bed_bell' }, { bell: ['west_hall', 'bed_bell'] });
    expect(r.positions['bell']).toBe('bed_bell');
  });

  it('throws on a path that walks through a wall', () => {
    expect(() => resolveMovement(H, { bell: 'bed_bell' }, { bell: ['attic', 'landing'] }))
      .toThrow(/illegal path/i);
  });

  it('throws when a player has no path', () => {
    expect(() => resolveMovement(H, { bell: 'bed_bell', pike: 'bed_pike' },
      { bell: ['west_hall', 'kitchen'] })).toThrow(/no path/i);
  });

  it('returns exactly one position per player', () => {
    const r = resolveMovement(H,
      { bell: 'bed_bell', pike: 'bed_pike', clem: 'bed_clem' },
      { bell: ['west_hall', 'bed_bell'], pike: ['kitchen', 'west_hall'],
        clem: ['east_hall', 'kitchen'] });
    expect(Object.keys(r.positions).sort()).toEqual(['bell', 'clem', 'pike']);
  });

  it('cannot end in an adjacent dead-end room', () => {
    // bed_bell's only door is west_hall, so from west_hall the only two-edge walk
    // through it comes straight back. You must start two rooms away to sleep there.
    expect(() => resolveMovement(H, { bell: 'west_hall' }, { bell: ['west_hall', 'bed_bell'] }))
      .toThrow(/illegal path/i);
    expect(resolveMovement(H, { bell: 'kitchen' }, { bell: ['west_hall', 'bed_bell'] })
      .positions['bell']).toBe('bed_bell');
  });
});

describe('crossedFloors', () => {
  it('detects a staircase anywhere in the walk', () => {
    expect(crossedFloors(H, 'bed_bell', ['west_hall', 'landing'])).toBe(true);
    expect(crossedFloors(H, 'landing', ['west_hall', 'landing'])).toBe(true);
  });

  it('returns false for a walk that stays on one floor', () => {
    expect(crossedFloors(H, 'bed_bell', ['west_hall', 'kitchen'])).toBe(false);
  });
});
```

**A consequence of R1 worth knowing before you write anything else.** Because a path is *exactly*
two edges with no self-loop, **you can never end your phase in a dead-end room you are standing next
to** — from `west_hall` the only walk through `bed_bell` comes straight back out. To sleep in a
dead-end bedroom you must begin the phase exactly two rooms away.

Four of the six bedrooms in Hollow House are dead ends, so this shapes the whole game: camping in
the hallway outside someone's door does not let you step in next phase, and a villain must plan
their approach a full phase ahead. It also means the last test above is a rule, not a curiosity.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/movement.test.ts`
Expected: FAIL — cannot resolve `./movement.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/movement.ts`:
```ts
import type { House, Path, PlayerId, RoomId } from './types.js';
import { floorOf, isLegalPath } from './map.js';

export interface MoveResult {
  positions: Record<PlayerId, RoomId>;
  steps: Record<PlayerId, [RoomId, RoomId]>;
}

export function resolveMovement(
  house: House,
  from: Readonly<Record<PlayerId, RoomId>>,
  paths: Readonly<Record<PlayerId, Path>>,
): MoveResult {
  const positions: Record<PlayerId, RoomId> = {};
  const steps: Record<PlayerId, [RoomId, RoomId]> = {};

  for (const player of Object.keys(from)) {
    const start = from[player]!;
    const path = paths[player];
    if (!path) throw new Error(`no path submitted for ${player}`);
    if (!isLegalPath(house, start, path)) {
      throw new Error(`illegal path for ${player}: ${start} -> ${path[0]} -> ${path[1]}`);
    }
    positions[player] = path[1];
    steps[player] = [path[0], path[1]];
  }

  return { positions, steps };
}

/** True if any step of the walk passed through a staircase. */
export function crossedFloors(house: House, from: RoomId, steps: readonly RoomId[]): boolean {
  let prev = from;
  for (const room of steps) {
    if (floorOf(house, prev) !== floorOf(house, room)) return true;
    prev = room;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/movement.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules/movement.ts src/rules/movement.test.ts
git commit -m "feat: two-edge movement resolution and floor-crossing detection"
```

---

### Task 6: Visibility — the information boundary

**Files:**
- Create: `src/rules/visibility.ts`
- Test: `src/rules/visibility.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Sighting`, `isLit`.
- Produces:
  - `seesNamesInDark(state, player): boolean` — true for the villain always, and for Wren when the oddities layer is on.
  - `sightingsAt(state, positions: Record<PlayerId, RoomId>): Record<PlayerId, Sighting>`

This is the single most important function in the engine. Everything the game is about — lit rooms
name people, dark rooms do not, the villain sees in the dark — lives here and nowhere else.

- [ ] **Step 1: Write the failing test**

`src/rules/visibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame } from './state.js';
import { sightingsAt, seesNamesInDark } from './visibility.js';

const game = (villain = 'moss') => {
  const s = createGame(makeConfig(), makeRng(1));
  s.villain = villain;
  return s;
};

describe('sightingsAt', () => {
  it('names everyone else in a lit room', () => {
    const s = game();
    const sight = sightingsAt(s, { bell: 'kitchen', pike: 'kitchen', clem: 'kitchen' });
    expect(sight['bell']!.named.sort()).toEqual(['clem', 'pike']);
    expect(sight['bell']!.others).toBe(2);
    expect(sight['bell']!.lit).toBe(true);
  });

  it('gives a lone player an empty sighting', () => {
    const s = game();
    const sight = sightingsAt(s, { bell: 'kitchen', pike: 'attic' });
    expect(sight['bell']!.named).toEqual([]);
    expect(sight['bell']!.others).toBe(0);
  });

  it('gives shapes but not names in a dark bedroom', () => {
    const s = game();
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { bell: 'bed_clem', pike: 'bed_clem', clem: 'bed_clem' });
    expect(sight['bell']!.named).toEqual([]);
    expect(sight['bell']!.others).toBe(2);
    expect(sight['bell']!.lit).toBe(false);
  });

  it('lets the villain read names in the dark', () => {
    const s = game('moss');
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { moss: 'bed_clem', bell: 'bed_clem', pike: 'bed_clem' });
    expect(sight['moss']!.named.sort()).toEqual(['bell', 'pike']);
    expect(sight['bell']!.named).toEqual([]);
  });

  it('lets Wren read names in the dark when oddities are on', () => {
    const s = game('moss');
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { wren: 'bed_clem', bell: 'bed_clem' });
    expect(sight['wren']!.named).toEqual(['bell']);
  });

  it('takes Wren\'s dark vision away when the oddities layer is off', () => {
    const s = createGame(makeConfig({ layers: { items: true, oddities: false, marking: true } }),
      makeRng(1));
    s.villain = 'moss';
    s.lit['bed_clem'] = false;
    const sight = sightingsAt(s, { wren: 'bed_clem', bell: 'bed_clem' });
    expect(sight['wren']!.named).toEqual([]);
    expect(sight['wren']!.others).toBe(1);
  });

  it('treats a Lantern-lit room as lit', () => {
    const s = game();
    s.lit['bed_clem'] = false;
    s.lanternRoom = 'bed_clem';
    const sight = sightingsAt(s, { bell: 'bed_clem', pike: 'bed_clem' });
    expect(sight['bell']!.named).toEqual(['pike']);
  });

  it('never leaks a name into the dark for an ordinary child, over many states', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = createGame(makeConfig({ layers: { items: true, oddities: false, marking: true } }),
        makeRng(seed));
      const rng = makeRng(seed + 5000);
      const rooms = Object.keys(s.config.house.rooms);
      for (const p of ROSTER) if (rng.next() < 0.5) s.lit[`bed_${p}`] = false;
      const positions: Record<string, string> = {};
      for (const p of ROSTER) positions[p] = rng.pick(rooms);
      const sight = sightingsAt(s, positions);
      for (const p of ROSTER) {
        if (p === s.villain) continue;
        if (!sight[p]!.lit) expect(sight[p]!.named).toEqual([]);
        expect(sight[p]!.others).toBe(
          ROSTER.filter((q) => q !== p && positions[q] === positions[p]).length,
        );
      }
    }
  });
});

describe('seesNamesInDark', () => {
  it('is true for the villain and Wren, false for everyone else', () => {
    const s = game('bell');
    expect(seesNamesInDark(s, 'bell')).toBe(true);
    expect(seesNamesInDark(s, 'wren')).toBe(true);
    expect(seesNamesInDark(s, 'pike')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/visibility.test.ts`
Expected: FAIL — cannot resolve `./visibility.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/visibility.ts`:
```ts
import type { PlayerId, RoomId } from './types.js';
import { type GameState, type Sighting, isLit } from './state.js';

/**
 * The game's only asymmetry. Odd Socks always reads names in the dark; Wren does
 * too, when the oddities layer is switched on.
 */
export function seesNamesInDark(state: GameState, player: PlayerId): boolean {
  if (player === state.villain) return true;
  return state.config.layers.oddities && player === 'wren';
}

/**
 * What each player learns at the end of a phase. The count of others is always
 * truthful — only names are withheld.
 */
export function sightingsAt(
  state: GameState,
  positions: Readonly<Record<PlayerId, RoomId>>,
): Record<PlayerId, Sighting> {
  const byRoom = new Map<RoomId, PlayerId[]>();
  for (const [player, room] of Object.entries(positions)) {
    const list = byRoom.get(room) ?? [];
    list.push(player);
    byRoom.set(room, list);
  }

  const out: Record<PlayerId, Sighting> = {};
  for (const [player, room] of Object.entries(positions)) {
    const others = (byRoom.get(room) ?? []).filter((p) => p !== player);
    const lit = isLit(state, room);
    const named = lit || seesNamesInDark(state, player) ? [...others].sort() : [];
    out[player] = { room, named, others: others.length, lit };
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/visibility.test.ts`
Expected: PASS, 9 tests including the 200-state property check.

- [ ] **Step 5: Commit**

```bash
git add src/rules/visibility.ts src/rules/visibility.test.ts
git commit -m "feat: sighting projection — lit rooms name, dark rooms count"
```

---

### Task 7: Theft, the Grip, the trail, and the Hush

**Files:**
- Create: `src/rules/theft.ts`
- Test: `src/rules/theft.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Rng`, map helpers.
- Produces:
  - `interface TheftOutcome { stole: boolean; victim: PlayerId | null; room: RoomId | null; events: PublicEvent[] }`
  - `resolveTheft(state, midnight: Record<PlayerId, RoomId>, snuffOwn: boolean, rng): TheftOutcome` — mutates `state`.
  - `selectTrailWitness(state, robbed: RoomId, midnight, rng): PlayerId`

**Additional ruling decided here (append to the spec's §4 table as R16):** a **self-snuff produces
no trail**. The trail is described in §4 as what a theft leaves behind; snuffing your own light is
not a theft against anybody. Emitting a trail on self-snuff would also hand the children a free
people-fact for an action that costs the villain nothing.

The invariant that matters across the engine is **determinism given `(state, actions, rng)`**, not
immutability — resolution functions mutate the state they are handed, and `resolveNight` (Task 13)
is the only place that orders them.

- [ ] **Step 1: Write the failing test**

`src/rules/theft.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, type GameState } from './state.js';
import { resolveTheft, selectTrailWitness } from './theft.js';

const game = (villain: string, overrides = {}): GameState => {
  const s = createGame(makeConfig(overrides), makeRng(1));
  s.villain = villain;
  s.night = 2;
  return s;
};

describe('resolveTheft', () => {
  it('puts out the light when the villain ends midnight in a lit bedroom', () => {
    const s = game('moss');
    const out = resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(out.stole).toBe(true);
    expect(out.victim).toBe('bell');
    expect(s.lit['bed_bell']).toBe(false);
    expect(out.events.some((e) => e.t === 'theft')).toBe(true);
  });

  it('hushes the victim from the night their light died', () => {
    const s = game('moss');
    resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(s.hushedSince['bell']).toBe(2);
  });

  it('does nothing in a common room', () => {
    const s = game('moss');
    const out = resolveTheft(s, { moss: 'kitchen' }, false, makeRng(1));
    expect(out.stole).toBe(false);
    expect(out.events).toEqual([]);
  });

  it('does nothing in a bedroom that is already dark', () => {
    const s = game('moss');
    s.lit['bed_bell'] = false;
    const out = resolveTheft(s, { moss: 'bed_bell' }, false, makeRng(1));
    expect(out.stole).toBe(false);
  });

  it('snuffs the villain\'s own light only when they choose to, and hushes them', () => {
    const s = game('moss');
    const skipped = resolveTheft(s, { moss: 'bed_moss' }, false, makeRng(1));
    expect(s.lit['bed_moss']).toBe(true);
    expect(skipped.events).toEqual([]);

    const done = resolveTheft(s, { moss: 'bed_moss' }, true, makeRng(1));
    expect(s.lit['bed_moss']).toBe(false);
    expect(s.hushedSince['moss']).toBe(2);
    expect(done.events.some((e) => e.t === 'selfSnuff')).toBe(true);
    expect(done.events.some((e) => e.t === 'trail')).toBe(false);
  });

  it('emits a trail naming someone within the trail radius', () => {
    const s = game('moss');
    const out = resolveTheft(s,
      { moss: 'bed_bell', bell: 'west_hall', pike: 'attic' }, false, makeRng(3));
    const trail = out.events.find((e) => e.t === 'trail');
    expect(trail).toBeDefined();
    expect(['moss', 'bell']).toContain((trail as { player: string }).player);
  });
});

describe('the Grip', () => {
  it('takes the thief\'s item when the owner was home', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    const out = resolveTheft(s, { moss: 'bed_bell', bell: 'bed_bell' }, false, makeRng(1));
    expect(s.held['bell']).toEqual(['keyhole']);
    expect(s.held['moss']).toEqual([]);
    expect(out.events.some((e) => e.t === 'grip')).toBe(true);
  });

  it('hands the owner an item from the reserve when the thief carried nothing', () => {
    const s = game('moss');
    s.held['moss'] = [];
    const before = s.reserve.length;
    resolveTheft(s, { moss: 'bed_bell', bell: 'bed_bell' }, false, makeRng(1));
    expect(s.held['bell']).toHaveLength(1);
    expect(s.reserve).toHaveLength(before - 1);
  });

  it('does not fire when the owner was elsewhere', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen' }, false, makeRng(1));
    expect(s.held['bell']).toEqual([]);
    expect(s.held['moss']).toEqual(['keyhole']);
  });

  it('does not fire for a non-owner standing in the robbed room', () => {
    const s = game('moss');
    s.held['moss'] = ['keyhole'];
    resolveTheft(s, { moss: 'bed_bell', bell: 'kitchen', pike: 'bed_bell' }, false, makeRng(1));
    expect(s.held['pike']).toEqual([]);
  });
});

describe('selectTrailWitness', () => {
  it('only ever names someone inside the radius', () => {
    const s = game('moss');
    const midnight = { moss: 'bed_bell', bell: 'west_hall', pike: 'attic', clem: 'bed_clem' };
    for (let i = 0; i < 50; i++) {
      const named = selectTrailWitness(s, 'bed_bell', midnight, makeRng(i));
      expect(['moss', 'bell']).toContain(named);
    }
  });

  it('names the thief when nobody else is near', () => {
    const s = game('moss');
    const midnight: Record<string, string> = { moss: 'bed_bell' };
    for (const p of ROSTER) if (p !== 'moss') midnight[p] = 'attic';
    expect(selectTrailWitness(s, 'bed_bell', midnight, makeRng(1))).toBe('moss');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/theft.test.ts`
Expected: FAIL — cannot resolve `./theft.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/theft.ts`:
```ts
import type { Rng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import { type GameState, isLit } from './state.js';
import { isBedroom, ownerOf, roomsWithin } from './map.js';

export interface TheftOutcome {
  stole: boolean;
  victim: PlayerId | null;
  room: RoomId | null;
  events: PublicEvent[];
}

const NOTHING: TheftOutcome = { stole: false, victim: null, room: null, events: [] };

/**
 * The villain's night action in a bedroom. Theft is automatic on entering another
 * child's lit bedroom (R10); snuffing your own light is declared (R11).
 */
export function resolveTheft(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  snuffOwn: boolean,
  rng: Rng,
): TheftOutcome {
  const house = state.config.house;
  const room = midnight[state.villain];
  if (!room || !isBedroom(house, room) || !isLit(state, room)) return { ...NOTHING, events: [] };

  const owner = ownerOf(house, room);
  if (!owner) return { ...NOTHING, events: [] };

  // Their own light: optional, hushes them, and leaves no trail (R16).
  if (owner === state.villain) {
    if (!snuffOwn) return { ...NOTHING, events: [] };
    state.lit[room] = false;
    state.hushedSince[state.villain] = state.night;
    return {
      stole: false, victim: null, room,
      events: [{ t: 'selfSnuff', room }],
    };
  }

  const events: PublicEvent[] = [];
  state.lit[room] = false;
  state.hushedSince[owner] = state.night;
  events.push({ t: 'theft', room, victim: owner });

  // The Grip: the owner alone, and only if they were home (R3).
  if (midnight[owner] === room) {
    const carried = state.held[state.villain] ?? [];
    if (carried.length > 0) {
      const taken = rng.pick(carried);
      carried.splice(carried.indexOf(taken), 1);
      state.held[owner]!.push(taken);
      events.push({ t: 'grip', player: owner, item: taken });
    } else if (state.reserve.length > 0) {
      const given = state.reserve.pop()!;
      state.held[owner]!.push(given);
      events.push({ t: 'grip', player: owner, item: given });
    }
  }

  const witness = selectTrailWitness(state, room, midnight, rng);
  events.push({ t: 'trail', player: witness, room });

  return { stole: true, victim: owner, room, events };
}

/** One child, chosen uniformly, who ended midnight within the trail radius (R2). */
export function selectTrailWitness(
  state: GameState,
  robbed: RoomId,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  rng: Rng,
): PlayerId {
  const near = new Set(roomsWithin(state.config.house, robbed, state.config.trailRadius));
  const pool = Object.keys(midnight).filter((p) => near.has(midnight[p]!));
  if (pool.length === 0) throw new Error(`empty trail pool for ${robbed}`);
  return rng.pick(pool.sort());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/theft.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/theft.ts src/rules/theft.test.ts
git commit -m "feat: theft, the Grip, the trail, and the Hush"
```

---

### Task 8: Marking

**Files:**
- Create: `src/rules/marking.ts`
- Test: `src/rules/marking.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Rng`.
- Produces: `resolveMarking(state, midnight, rng): { marked: PlayerId | null }` — mutates `state`. Emits no public event: §5 says nobody is told.

- [ ] **Step 1: Write the failing test**

`src/rules/marking.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, type GameState } from './state.js';
import { resolveMarking } from './marking.js';

const dark = (villain = 'moss'): GameState => {
  const s = createGame(makeConfig(), makeRng(1));
  s.villain = villain;
  s.night = 3;
  s.lit['bed_bell'] = false;
  return s;
};

describe('resolveMarking', () => {
  it('marks the one eligible child in a dark room', () => {
    const s = dark();
    const out = resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1));
    expect(out.marked).toBe('pike');
    expect(s.marked['pike']).toBe(true);
  });

  it('marks one at random when several are present', () => {
    const s = dark();
    const out = resolveMarking(s,
      { moss: 'bed_bell', pike: 'bed_bell', clem: 'bed_bell' }, makeRng(4));
    expect(['pike', 'clem']).toContain(out.marked);
  });

  it('wastes the night when the room is empty', () => {
    const s = dark();
    expect(resolveMarking(s, { moss: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });

  it('never marks the villain or an already-marked child', () => {
    const s = dark();
    s.marked['pike'] = true;
    expect(resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });

  it('does nothing in a lit room', () => {
    const s = dark();
    expect(resolveMarking(s, { moss: 'kitchen', pike: 'kitchen' }, makeRng(1)).marked).toBeNull();
    expect(resolveMarking(s, { moss: 'bed_clem', pike: 'bed_clem' }, makeRng(1)).marked).toBeNull();
  });

  it('does nothing in a room a Lantern has relit', () => {
    const s = dark();
    s.lanternRoom = 'bed_bell';
    expect(resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });

  it('does nothing when the marking layer is off', () => {
    const s = createGame(
      makeConfig({ layers: { items: true, oddities: true, marking: false } }), makeRng(1));
    s.villain = 'moss';
    s.lit['bed_bell'] = false;
    expect(resolveMarking(s, { moss: 'bed_bell', pike: 'bed_bell' }, makeRng(1)).marked).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/marking.test.ts`
Expected: FAIL — cannot resolve `./marking.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/marking.ts`:
```ts
import type { Rng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import { type GameState, isLit } from './state.js';

/**
 * The villain's second verb. Blind like the theft: they commit on entering and
 * find out afterwards. Nobody is told, ever — the child discovers it when they
 * try to join a Call and cannot.
 */
export function resolveMarking(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  rng: Rng,
): { marked: PlayerId | null } {
  if (!state.config.layers.marking) return { marked: null };

  const room = midnight[state.villain];
  if (!room || isLit(state, room)) return { marked: null };

  const eligible = Object.keys(midnight)
    .filter((p) => midnight[p] === room && p !== state.villain && !state.marked[p])
    .sort();
  if (eligible.length === 0) return { marked: null };

  const target = rng.pick(eligible);
  state.marked[target] = true;
  return { marked: target };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/marking.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/marking.ts src/rules/marking.test.ts
git commit -m "feat: blind marking in dark rooms"
```

---

### Task 9: Item circulation

**Files:**
- Create: `src/rules/items.ts`
- Test: `src/rules/items.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Rng`, `capacityOf`, map helpers.
- Produces:
  - `spawnItems(state, rng): PublicEvent[]` — at dusk, top the map up to `itemsOnMap` loose items in common rooms, drawing from the reserve.
  - `resolvePickups(state, dusk: Record<PlayerId, RoomId>, wants: Record<PlayerId, boolean>, rng): PublicEvent[]` — R5: contested items go to one claimant at random.
  - `spendItem(state, player, kind): void` — removes from hand and schedules the return.
  - `processReturns(state): void` — returns items whose delay has elapsed to the reserve.
  - `itemHolders(state): PlayerId[]`

- [ ] **Step 1: Write the failing test**

`src/rules/items.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame } from './state.js';
import { spawnItems, resolvePickups, spendItem, processReturns, itemHolders } from './items.js';
import { isBedroom } from './map.js';

const game = () => { const s = createGame(makeConfig(), makeRng(1)); s.villain = 'moss'; return s; };
const looseCount = (s: ReturnType<typeof game>) => Object.values(s.loose).flat().length;

describe('spawnItems', () => {
  it('tops the map up to itemsOnMap, in common rooms only', () => {
    const s = game();
    const events = spawnItems(s, makeRng(2));
    expect(looseCount(s)).toBe(3);
    expect(events).toHaveLength(3);
    for (const room of Object.keys(s.loose)) {
      if (s.loose[room]!.length > 0) expect(isBedroom(s.config.house, room)).toBe(false);
    }
  });

  it('draws from the reserve', () => {
    const s = game();
    spawnItems(s, makeRng(2));
    expect(s.reserve).toHaveLength(2);
  });

  it('adds nothing when the map is already full', () => {
    const s = game();
    spawnItems(s, makeRng(2));
    expect(spawnItems(s, makeRng(3))).toEqual([]);
    expect(looseCount(s)).toBe(3);
  });

  it('does nothing when the items layer is off', () => {
    const s = createGame(
      makeConfig({ layers: { items: false, oddities: true, marking: true } }), makeRng(1));
    expect(spawnItems(s, makeRng(2))).toEqual([]);
  });
});

describe('resolvePickups', () => {
  it('gives the item to a lone claimant and announces it', () => {
    const s = game();
    s.loose['kitchen'] = ['keyhole'];
    const events = resolvePickups(s, { bell: 'kitchen' }, { bell: true }, makeRng(1));
    expect(s.held['bell']).toEqual(['keyhole']);
    expect(s.loose['kitchen']).toEqual([]);
    expect(events[0]).toMatchObject({ t: 'itemTaken', player: 'bell', item: 'keyhole' });
  });

  it('gives a contested item to exactly one claimant', () => {
    const s = game();
    s.loose['kitchen'] = ['keyhole'];
    resolvePickups(s, { bell: 'kitchen', pike: 'kitchen' }, { bell: true, pike: true }, makeRng(6));
    expect(s.held['bell']!.length + s.held['pike']!.length).toBe(1);
  });

  it('leaves the item when nobody wants it', () => {
    const s = game();
    s.loose['kitchen'] = ['keyhole'];
    expect(resolvePickups(s, { bell: 'kitchen' }, { bell: false }, makeRng(1))).toEqual([]);
    expect(s.loose['kitchen']).toEqual(['keyhole']);
  });

  it('refuses a pickup that would exceed carrying capacity', () => {
    const s = game();
    s.held['bell'] = ['bell'];
    s.loose['kitchen'] = ['keyhole'];
    expect(resolvePickups(s, { bell: 'kitchen' }, { bell: true }, makeRng(1))).toEqual([]);
  });

  it('lets Moss carry two', () => {
    const s = game();
    s.held['moss'] = ['bell'];
    s.loose['kitchen'] = ['keyhole'];
    resolvePickups(s, { moss: 'kitchen' }, { moss: true }, makeRng(1));
    expect(s.held['moss']).toEqual(['bell', 'keyhole']);
  });
});

describe('spending and returning', () => {
  it('returns a spent item to the reserve after the configured delay', () => {
    const s = game();
    s.night = 3;
    s.held['bell'] = ['keyhole'];
    const before = s.reserve.length;
    spendItem(s, 'bell', 'keyhole');
    expect(s.held['bell']).toEqual([]);
    expect(s.reserve).toHaveLength(before);

    s.night = 4; processReturns(s);
    expect(s.reserve).toHaveLength(before);

    s.night = 5; processReturns(s);
    expect(s.reserve).toHaveLength(before + 1);
    expect(s.returning).toEqual([]);
  });

  it('throws when spending an item the player does not hold', () => {
    const s = game();
    expect(() => spendItem(s, 'bell', 'keyhole')).toThrow(/does not hold/i);
  });
});

describe('itemHolders', () => {
  it('lists every child with at least one item', () => {
    const s = game();
    s.held['bell'] = ['keyhole'];
    s.held['moss'] = ['lantern', 'bell'];
    expect(itemHolders(s)).toEqual(['bell', 'moss']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/items.test.ts`
Expected: FAIL — cannot resolve `./items.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/items.ts`:
```ts
import type { Rng } from './rng.js';
import type { ItemKind, PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import { type GameState, capacityOf } from './state.js';
import { isBedroom } from './map.js';

const commonRooms = (state: GameState): RoomId[] =>
  Object.keys(state.config.house.rooms).filter((r) => !isBedroom(state.config.house, r)).sort();

const looseTotal = (state: GameState): number =>
  Object.values(state.loose).reduce((n, xs) => n + xs.length, 0);

/** Items appear in common rooms only, so fetching one means crossing the house. */
export function spawnItems(state: GameState, rng: Rng): PublicEvent[] {
  if (!state.config.layers.items) return [];
  const events: PublicEvent[] = [];
  const rooms = commonRooms(state);

  while (looseTotal(state) < state.config.itemsOnMap && state.reserve.length > 0) {
    const item = state.reserve.pop()!;
    const room = rng.pick(rooms);
    state.loose[room]!.push(item);
    events.push({ t: 'itemSpawned', item, room });
  }
  return events;
}

/** Picking one up is announced out loud. Contested items go to one claimant (R5). */
export function resolvePickups(
  state: GameState,
  dusk: Readonly<Record<PlayerId, RoomId>>,
  wants: Readonly<Record<PlayerId, boolean>>,
  rng: Rng,
): PublicEvent[] {
  if (!state.config.layers.items) return [];
  const events: PublicEvent[] = [];

  for (const room of commonRooms(state)) {
    const pile = state.loose[room]!;
    while (pile.length > 0) {
      const claimants = Object.keys(dusk)
        .filter((p) => dusk[p] === room && wants[p] === true)
        .filter((p) => state.held[p]!.length < capacityOf(state, p))
        .sort();
      if (claimants.length === 0) break;

      const winner = rng.pick(claimants);
      const item = pile.shift()!;
      state.held[winner]!.push(item);
      events.push({ t: 'itemTaken', player: winner, item, room });
    }
  }
  return events;
}

/** Spent items are gone for `itemRespawnDelay` mornings, then rejoin the reserve. */
export function spendItem(state: GameState, player: PlayerId, kind: ItemKind): void {
  const hand = state.held[player]!;
  const at = hand.indexOf(kind);
  if (at === -1) throw new Error(`${player} does not hold a ${kind}`);
  hand.splice(at, 1);
  state.returning.push({ item: kind, night: state.night + state.config.itemRespawnDelay });
}

export function processReturns(state: GameState): void {
  const due = state.returning.filter((r) => r.night <= state.night);
  state.returning = state.returning.filter((r) => r.night > state.night);
  for (const r of due) state.reserve.push(r.item);
}

export const itemHolders = (state: GameState): PlayerId[] =>
  state.config.roster.filter((p) => state.held[p]!.length > 0);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/items.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/items.ts src/rules/items.test.ts
git commit -m "feat: item pool, spawning, contested pickup, and respawn"
```

---

### Task 10: Item effects — Lantern, Keyhole, Bell

**Files:**
- Create: `src/rules/itemEffects.ts`
- Test: `src/rules/itemEffects.test.ts`

**Interfaces:**
- Consumes: `GameState`, `spendItem`, `NightRecord` history.
- Produces:
  - `type ItemUse = { kind: 'lantern'; spender: PlayerId; room: RoomId } | { kind: 'keyhole'; spender: PlayerId; room: RoomId; night: number } | { kind: 'bell'; spender: PlayerId; target: PlayerId }`
  - `applyItemUses(state, uses: ItemUse[]): PublicEvent[]` — called in the morning; sets up tonight.
  - `resolveBellWatch(state, midnight): PublicEvent[]` — called after midnight movement.
  - `clearNightlyItemEffects(state): void`

Each item is a choice between knowing and winning: spending it for information means it is not in
your hand when a Call needs two.

- [ ] **Step 1: Write the failing test**

`src/rules/itemEffects.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, isLit } from './state.js';
import { applyItemUses, resolveBellWatch, clearNightlyItemEffects } from './itemEffects.js';

const game = () => { const s = createGame(makeConfig(), makeRng(1)); s.villain = 'moss'; s.night = 3; return s; };

describe('the Lantern', () => {
  it('relights a dead bedroom for one night only', () => {
    const s = game();
    s.lit['bed_bell'] = false;
    s.held['pike'] = ['lantern'];
    const events = applyItemUses(s, [{ kind: 'lantern', spender: 'pike', room: 'bed_bell' }]);
    expect(isLit(s, 'bed_bell')).toBe(true);
    expect(events.some((e) => e.t === 'lantern')).toBe(true);
    expect(s.held['pike']).toEqual([]);

    clearNightlyItemEffects(s);
    expect(isLit(s, 'bed_bell')).toBe(false);
  });
});

describe('the Keyhole', () => {
  it('announces who was really in a room on a past night', () => {
    const s = game();
    s.held['pike'] = ['keyhole'];
    s.history.push({
      night: 2, duskPositions: {}, midnightPositions: { bell: 'kitchen', moss: 'kitchen' },
      events: [], sightings: {}, claims: {},
    });
    const events = applyItemUses(s, [
      { kind: 'keyhole', spender: 'pike', room: 'kitchen', night: 2 }]);
    expect(events[0]).toMatchObject({ t: 'keyhole', room: 'kitchen', night: 2 });
    expect((events[0] as { occupants: string[] }).occupants.sort()).toEqual(['bell', 'moss']);
  });

  it('reports an empty room honestly', () => {
    const s = game();
    s.held['pike'] = ['keyhole'];
    s.history.push({
      night: 2, duskPositions: {}, midnightPositions: { bell: 'kitchen' },
      events: [], sightings: {}, claims: {},
    });
    const events = applyItemUses(s, [{ kind: 'keyhole', spender: 'pike', room: 'attic', night: 2 }]);
    expect((events[0] as { occupants: string[] }).occupants).toEqual([]);
  });
});

describe('the Bell', () => {
  it('watches a named child and announces their midnight room that night', () => {
    const s = game();
    s.held['pike'] = ['bell'];
    applyItemUses(s, [{ kind: 'bell', spender: 'pike', target: 'moss' }]);
    expect(s.bellWatch).toBe('moss');

    const events = resolveBellWatch(s, { moss: 'sewing_room' });
    expect(events[0]).toMatchObject({ t: 'bell', target: 'moss', room: 'sewing_room' });

    clearNightlyItemEffects(s);
    expect(s.bellWatch).toBeNull();
  });

  it('announces nothing when no Bell is in play', () => {
    expect(resolveBellWatch(game(), { moss: 'attic' })).toEqual([]);
  });
});

describe('spending', () => {
  it('refuses a use the spender cannot pay for', () => {
    const s = game();
    expect(() => applyItemUses(s, [{ kind: 'bell', spender: 'pike', target: 'moss' }]))
      .toThrow(/does not hold/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/itemEffects.test.ts`
Expected: FAIL — cannot resolve `./itemEffects.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/itemEffects.ts`:
```ts
import type { PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import type { GameState } from './state.js';
import { spendItem } from './items.js';

export type ItemUse =
  | { kind: 'lantern'; spender: PlayerId; room: RoomId }
  | { kind: 'keyhole'; spender: PlayerId; room: RoomId; night: number }
  | { kind: 'bell'; spender: PlayerId; target: PlayerId };

/** Spent in the morning; shapes the night that follows. */
export function applyItemUses(state: GameState, uses: readonly ItemUse[]): PublicEvent[] {
  const events: PublicEvent[] = [];

  for (const use of uses) {
    spendItem(state, use.spender, use.kind);

    switch (use.kind) {
      case 'lantern':
        state.lanternRoom = use.room;
        events.push({ t: 'lantern', spender: use.spender, room: use.room });
        break;

      case 'keyhole': {
        const record = state.history.find((h) => h.night === use.night);
        const occupants = record
          ? Object.keys(record.midnightPositions)
              .filter((p) => record.midnightPositions[p] === use.room).sort()
          : [];
        events.push({
          t: 'keyhole', spender: use.spender, room: use.room, night: use.night, occupants,
        });
        break;
      }

      case 'bell':
        state.bellWatch = use.target;
        break;
    }
  }

  return events;
}

/** The watched child's midnight room, announced publicly. */
export function resolveBellWatch(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
): PublicEvent[] {
  const target = state.bellWatch;
  if (!target) return [];
  const room = midnight[target];
  if (!room) return [];
  return [{ t: 'bell', spender: target, target, room }];
}

export function clearNightlyItemEffects(state: GameState): void {
  state.lanternRoom = null;
  state.bellWatch = null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/itemEffects.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/itemEffects.ts src/rules/itemEffects.test.ts
git commit -m "feat: Lantern, Keyhole, and Bell effects"
```

---

### Task 11: The Call

**Files:**
- Create: `src/rules/call.ts`
- Test: `src/rules/call.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PostedCall`, `spendItem`, `isLit`, `isBedroom`.
- Produces:
  - `canPostCall(state, target, room): boolean` — the room must be a lit bedroom (§7).
  - `postCall(state, call: PostedCall): PublicEvent[]`
  - `canJoinCall(state, player): boolean` — holds an item and is not marked.
  - `resolveCall(state, midnight, joiners: readonly PlayerId[], rng): { caught: boolean; events: PublicEvent[] }` — mutates state.

Resolution order matters: this runs **before** the theft, so a landed trap means the light is never
taken. Fewer than `callHandsRequired` hands and nothing is spent — miscoordination is free.

- [ ] **Step 1: Write the failing test**

`src/rules/call.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, type GameState } from './state.js';
import { canPostCall, postCall, canJoinCall, resolveCall } from './call.js';

const armed = (): GameState => {
  const s = createGame(makeConfig(), makeRng(1));
  s.villain = 'moss';
  s.night = 3;
  s.held['bell'] = ['keyhole'];
  s.held['pike'] = ['lantern'];
  s.activeCall = { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false };
  return s;
};

describe('posting', () => {
  it('accepts a lit bedroom', () => {
    expect(canPostCall(armed(), 'moss', 'bed_clem')).toBe(true);
  });

  it('rejects commons and dark bedrooms', () => {
    const s = armed();
    expect(canPostCall(s, 'moss', 'kitchen')).toBe(false);
    s.lit['bed_clem'] = false;
    expect(canPostCall(s, 'moss', 'bed_clem')).toBe(false);
  });

  it('announces the call publicly', () => {
    const s = createGame(makeConfig(), makeRng(1));
    const events = postCall(s, { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false });
    expect(events[0]).toMatchObject({ t: 'callPosted', caller: 'bell', target: 'moss' });
    expect(s.activeCall?.target).toBe('moss');
  });
});

describe('joining', () => {
  it('requires an item and an unmarked hand', () => {
    const s = armed();
    expect(canJoinCall(s, 'bell')).toBe(true);
    expect(canJoinCall(s, 'clem')).toBe(false);
    s.marked['bell'] = true;
    expect(canJoinCall(s, 'bell')).toBe(false);
  });
});

describe('resolving', () => {
  it('catches the villain when two hands arrive and the target is Odd Socks', () => {
    const s = armed();
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', moss: 'bed_clem' }, ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(true);
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'caught')).toBe(true);
  });

  it('clears an innocent who arrives, and spends the items', () => {
    const s = armed();
    s.activeCall!.target = 'clem';
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', clem: 'bed_clem' }, ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(false);
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'cleared')).toBe(true);
    expect(s.held['bell']).toEqual([]);
    expect(s.held['pike']).toEqual([]);
  });

  it('spends the items even when the target never comes', () => {
    const s = armed();
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', moss: 'kitchen' }, ['bell', 'pike'], makeRng(1));
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'noShow')).toBe(true);
    expect(s.held['bell']).toEqual([]);
  });

  it('spends nothing when only one hand arrives', () => {
    const s = armed();
    const out = resolveCall(s, { bell: 'bed_clem', moss: 'bed_clem' }, ['bell'], makeRng(1));
    expect(out.caught).toBe(false);
    expect(out.events.some((e) => e.t === 'callResolved' && e.outcome === 'fizzled')).toBe(true);
    expect(s.held['bell']).toEqual(['keyhole']);
  });

  it('ignores a joiner who did not actually reach the room', () => {
    const s = armed();
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'kitchen', moss: 'bed_clem' }, ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(false);
    expect(s.held['pike']).toEqual(['lantern']);
  });

  it('does not catch a villain who is present but was not the named target', () => {
    const s = armed();
    s.activeCall!.target = 'clem';
    const out = resolveCall(s,
      { bell: 'bed_clem', pike: 'bed_clem', moss: 'bed_clem', clem: 'kitchen' },
      ['bell', 'pike'], makeRng(1));
    expect(out.caught).toBe(false);
  });

  it('opens the eyes of a self-nominated target who fails to arrive', () => {
    const s = armed();
    s.activeCall = { caller: 'moss', target: 'moss', room: 'bed_clem', selfNominated: true };
    resolveCall(s, { bell: 'bed_clem', pike: 'bed_clem', moss: 'attic' }, ['bell', 'pike'], makeRng(1));
    expect(s.eyesOpen['moss']).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/call.test.ts`
Expected: FAIL — cannot resolve `./call.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/call.ts`:
```ts
import type { Rng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import type { PostedCall, PublicEvent } from './state.js';
import { type GameState, isLit } from './state.js';
import { isBedroom } from './map.js';
import { spendItem } from './items.js';

/** Traps only work in lit bedrooms — the set that shrinks every night. */
export function canPostCall(state: GameState, _target: PlayerId, room: RoomId): boolean {
  return isBedroom(state.config.house, room) && isLit(state, room);
}

export function postCall(state: GameState, call: PostedCall): PublicEvent[] {
  state.activeCall = call;
  return [{ t: 'callPosted', caller: call.caller, target: call.target, room: call.room }];
}

/** A hand needs an item to spend, and marking is exactly what takes that away. */
export function canJoinCall(state: GameState, player: PlayerId): boolean {
  return state.held[player]!.length > 0 && !state.marked[player];
}

export function resolveCall(
  state: GameState,
  midnight: Readonly<Record<PlayerId, RoomId>>,
  joiners: readonly PlayerId[],
  rng: Rng,
): { caught: boolean; events: PublicEvent[] } {
  const call = state.activeCall;
  if (!call) return { caught: false, events: [] };

  const hands = joiners
    .filter((p) => midnight[p] === call.room)
    .filter((p) => canJoinCall(state, p))
    .sort();

  // Miscoordination is free: nothing forms, nothing is spent.
  if (hands.length < state.config.callHandsRequired) {
    return {
      caught: false,
      events: [{
        t: 'callResolved', target: call.target, room: call.room,
        hands: hands.length, outcome: 'fizzled',
      }],
    };
  }

  for (const hand of hands) spendItem(state, hand, rng.pick(state.held[hand]!));

  const arrived = midnight[call.target] === call.room;
  const caught = arrived && call.target === state.villain;
  const outcome = caught ? 'caught' : arrived ? 'cleared' : 'noShow';

  const events: PublicEvent[] = [{
    t: 'callResolved', target: call.target, room: call.room, hands: hands.length, outcome,
  }];

  // A self-nomination the target does not honour costs them their credibility.
  if (!arrived && call.selfNominated) {
    state.eyesOpen[call.target] = true;
    events.push({ t: 'eyesOpen', player: call.target, reason: 'self-nominated and did not come' });
  }

  if (caught) state.over = { winner: 'children', how: 'caught' };
  return { caught, events };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/call.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/call.ts src/rules/call.test.ts
git commit -m "feat: the Call — public target, secret joining, two hands"
```

---

### Task 12: The oddities

**Files:**
- Create: `src/rules/oddities.ts`
- Test: `src/rules/oddities.test.ts`

**Interfaces:**
- Consumes: `GameState`, map helpers, `crossedFloors`, `itemHolders`.
- Produces:
  - `interface OddityContext { duskPositions: Record<PlayerId, RoomId>; midnightPositions: Record<PlayerId, RoomId>; duskSteps: Record<PlayerId, [RoomId, RoomId]>; midnightSteps: Record<PlayerId, [RoomId, RoomId]>; startPositions: Record<PlayerId, RoomId>; theftRoom: RoomId | null; thiefDuskRoom: RoomId | null }`
  - `resolveOddities(state, ctx: OddityContext): PublicEvent[]`
  - `PUBLIC_ODDITIES: readonly OddityId[]` — `['bell', 'pike', 'clem']`.

**Correctness note for Task 16:** only `PUBLIC_ODDITIES` may be used as solver constraints. Private
oddities (Wren, Sparrow) are reported by the player and are deniable by design (§8), so the villain
could simply lie about their output. Feeding them to the solver would overstate the available signal.

Wren's dark vision already lives in `visibility.ts`; what belongs here is the public attic tell.
Moss's capacity already lives in `state.ts`. Sparrow follows `config.sparrowMode` — `'asWritten'`
reproduces the null v10.0 version so the defect stays measurable.

- [ ] **Step 1: Write the failing test**

`src/rules/oddities.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig } from './config.js';
import { createGame, type GameState } from './state.js';
import { resolveOddities, type OddityContext } from './oddities.js';

const ctx = (over: Partial<OddityContext> = {}): OddityContext => ({
  startPositions: {}, duskPositions: {}, midnightPositions: {},
  duskSteps: {}, midnightSteps: {}, theftRoom: null, thiefDuskRoom: null, ...over,
});

const game = (): GameState => {
  const s = createGame(makeConfig(), makeRng(1)); s.villain = 'moss'; s.night = 3; return s;
};
const find = (events: ReturnType<typeof resolveOddities>, source: string) =>
  events.find((e) => e.t === 'oddity' && e.source === source) as
    { source: string; detail: string; payload: Record<string, unknown> } | undefined;

describe('public oddities', () => {
  it('Bell counts people in the rooms beside Bell', () => {
    const s = game();
    const events = resolveOddities(s, ctx({
      midnightPositions: { bell: 'west_hall', pike: 'kitchen', clem: 'bed_bell', moss: 'attic' },
    }));
    expect(find(events, 'bell')!.payload['count']).toBe(2);
  });

  it('Pike reports whether anyone used a staircase', () => {
    const s = game();
    const flat = resolveOddities(s, ctx({
      startPositions: { pike: 'bed_pike' },
      duskSteps: { pike: ['west_hall', 'kitchen'] },
      midnightSteps: { pike: ['west_hall', 'bed_bell'] },
    }));
    expect(find(flat, 'pike')!.payload['crossed']).toBe(false);

    const climbed = resolveOddities(s, ctx({
      startPositions: { pike: 'bed_pike' },
      duskSteps: { pike: ['west_hall', 'landing'] },
      midnightSteps: { pike: ['attic', 'bed_moss'] },
    }));
    expect(find(climbed, 'pike')!.payload['crossed']).toBe(true);
  });

  it('Clem counts item-holders sharing Clem\'s room', () => {
    const s = game();
    s.held['pike'] = ['keyhole'];
    s.held['moss'] = ['lantern'];
    const events = resolveOddities(s, ctx({
      midnightPositions: { clem: 'kitchen', pike: 'kitchen', moss: 'kitchen', bell: 'kitchen' },
    }));
    expect(find(events, 'clem')!.payload['count']).toBe(2);
  });
});

describe('private oddities', () => {
  it('announces Wren in the attic, publicly, whichever phase it was', () => {
    const s = game();
    const events = resolveOddities(s, ctx({
      duskPositions: { wren: 'attic' }, midnightPositions: { wren: 'landing' },
    }));
    expect(find(events, 'wren')!.detail).toBe('atticTell');
  });

  it('says nothing about Wren when Wren stayed out of the attic', () => {
    const s = game();
    const events = resolveOddities(s, ctx({
      duskPositions: { wren: 'landing' }, midnightPositions: { wren: 'bed_wren' },
    }));
    expect(find(events, 'wren')).toBeUndefined();
  });

  it('gives Sparrow the thief\'s dusk floor under sparrowMode dusk', () => {
    const s = game();
    const events = resolveOddities(s, ctx({ theftRoom: 'bed_bell', thiefDuskRoom: 'attic' }));
    expect(find(events, 'sparrow')!.payload['floor']).toBe(1);
  });

  it('reproduces the null oddity under sparrowMode asWritten', () => {
    const s = createGame(makeConfig({ sparrowMode: 'asWritten' }), makeRng(1));
    s.villain = 'moss'; s.night = 3;
    const events = resolveOddities(s, ctx({ theftRoom: 'bed_bell', thiefDuskRoom: 'attic' }));
    expect(find(events, 'sparrow')!.payload['floor']).toBe(0); // the robbed room's own floor
  });

  it('says nothing about Sparrow on a night with no theft', () => {
    expect(find(resolveOddities(game(), ctx()), 'sparrow')).toBeUndefined();
  });
});

describe('the layer switch', () => {
  it('emits nothing when oddities are off', () => {
    const s = createGame(
      makeConfig({ layers: { items: true, oddities: false, marking: true } }), makeRng(1));
    expect(resolveOddities(s, ctx({ midnightPositions: { bell: 'west_hall' } }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/oddities.test.ts`
Expected: FAIL — cannot resolve `./oddities.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/oddities.ts`:
```ts
import type { OddityId, PlayerId, RoomId } from './types.js';
import type { PublicEvent } from './state.js';
import type { GameState } from './state.js';
import { doorsOf, floorOf } from './map.js';
import { crossedFloors } from './movement.js';

/** Only these are announced by the house, so only these are safe solver constraints. */
export const PUBLIC_ODDITIES: readonly OddityId[] = ['bell', 'pike', 'clem'];

export interface OddityContext {
  startPositions: Record<PlayerId, RoomId>;
  duskPositions: Record<PlayerId, RoomId>;
  midnightPositions: Record<PlayerId, RoomId>;
  duskSteps: Record<PlayerId, [RoomId, RoomId]>;
  midnightSteps: Record<PlayerId, [RoomId, RoomId]>;
  theftRoom: RoomId | null;
  thiefDuskRoom: RoomId | null;
}

const say = (source: PlayerId, detail: string, payload: Record<string, unknown>): PublicEvent =>
  ({ t: 'oddity', source, detail, payload });

export function resolveOddities(state: GameState, ctx: OddityContext): PublicEvent[] {
  if (!state.config.layers.oddities) return [];
  const house = state.config.house;
  const events: PublicEvent[] = [];

  // Bell, who never sleeps first — counts, never names.
  const bellRoom = ctx.midnightPositions['bell'];
  if (bellRoom) {
    const beside = new Set(doorsOf(house, bellRoom));
    const count = Object.keys(ctx.midnightPositions)
      .filter((p) => p !== 'bell' && beside.has(ctx.midnightPositions[p]!)).length;
    events.push(say('bell', 'adjacentCount', { count }));
  }

  // Pike, who counts stairs.
  if ('pike' in ctx.midnightPositions || Object.keys(ctx.duskSteps).length > 0) {
    const crossed = Object.keys(ctx.startPositions).some((p) =>
      crossedFloors(house, ctx.startPositions[p]!, [
        ...(ctx.duskSteps[p] ?? []), ...(ctx.midnightSteps[p] ?? []),
      ]));
    events.push(say('pike', 'floorCrossing', { crossed }));
  }

  // Clem, who watches hands.
  const clemRoom = ctx.midnightPositions['clem'];
  if (clemRoom) {
    const count = Object.keys(ctx.midnightPositions)
      .filter((p) => p !== 'clem' && ctx.midnightPositions[p] === clemRoom)
      .filter((p) => state.held[p]!.length > 0).length;
    events.push(say('clem', 'itemHolders', { count }));
  }

  // Wren, afraid of the attic — the public half of a private oddity.
  if (ctx.duskPositions['wren'] === 'attic' || ctx.midnightPositions['wren'] === 'attic') {
    events.push(say('wren', 'atticTell', { attic: true }));
  }

  // Sparrow, who listens at doors.
  if (ctx.theftRoom) {
    const room = state.config.sparrowMode === 'dusk'
      ? (ctx.thiefDuskRoom ?? ctx.theftRoom)
      : ctx.theftRoom; // v10.0 as written: the robbed room's own floor, i.e. no information
    events.push(say('sparrow', 'thiefFloor', { floor: floorOf(house, room) }));
  }

  return events;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/oddities.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/rules/oddities.ts src/rules/oddities.test.ts
git commit -m "feat: the six oddities, with Sparrow's defect kept measurable"
```

---

### Task 13: Night orchestration and ordering

**Files:**
- Create: `src/rules/night.ts`
- Test: `src/rules/night.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5–12.
- Produces:
  - `interface DuskAction { path: Path; pickUp: boolean }`
  - `interface MidnightAction { path: Path; joinCall: boolean; snuffOwn: boolean }`
  - `interface MorningAction { claim: RoomId | null; call: PostedCall | null; itemUses: ItemUse[] }`
  - `interface DuskResult { positions; steps; events; sightings }`
  - `interface MidnightResult { positions; steps; events; sightings; theft: TheftOutcome; caught: boolean }`
  - `runDusk(state, actions: Record<PlayerId, DuskAction>, rng): DuskResult`
  - `runMidnight(state, dusk: DuskResult, actions: Record<PlayerId, MidnightAction>, rng): MidnightResult`
  - `runMorning(state, dusk, midnight, actions: Record<PlayerId, MorningAction>, rng): { events; claims }`

Ordering is the contract this task exists to pin down. At midnight: **movement → Calls → theft →
sightings**, with sightings computed against post-theft lighting. A landed trap therefore means the
light is never taken, and a victim who stayed home to Grip the thief is standing in a room that has
just gone dark and sees only a shadow.

Night 1 is safe: no theft, no marking, no Call.

- [ ] **Step 1: Write the failing test**

`src/rules/night.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from './rng.js';
import { makeConfig, ROSTER } from './config.js';
import { createGame, type GameState } from './state.js';
import { runDusk, runMidnight, type DuskAction, type MidnightAction } from './night.js';
import type { Path } from './types.js';

const stay = (s: GameState, p: string): Path => {
  const here = s.positions[p]!;
  return [s.config.house.rooms[here]!.doors[0]!, here] as Path;
};

const allDusk = (s: GameState, over: Record<string, Path> = {}): Record<string, DuskAction> =>
  Object.fromEntries(ROSTER.map((p) => [p, { path: over[p] ?? stay(s, p), pickUp: false }]));

const allMid = (s: GameState, over: Record<string, Path> = {},
  extra: Partial<MidnightAction> = {}): Record<string, MidnightAction> =>
  Object.fromEntries(ROSTER.map((p) => [p,
    { path: over[p] ?? stay(s, p), joinCall: false, snuffOwn: false, ...extra }]));

const game = (villain = 'moss'): GameState => {
  const s = createGame(makeConfig(), makeRng(1)); s.villain = villain; return s;
};

describe('night one is safe', () => {
  it('takes no light even when the villain stands in a lit bedroom', () => {
    const s = game();
    s.night = 1;
    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk,
      allMid(s, { moss: ['sewing_room', 'bed_sparrow'] }), makeRng(1));
    expect(mid.theft.stole).toBe(false);
    expect(s.lit['bed_sparrow']).toBe(true);
  });
});

describe('midnight ordering', () => {
  it('resolves a landed Call before the theft, so the light survives', () => {
    const s = game();
    s.night = 3;
    s.held['bell'] = ['keyhole'];
    s.held['pike'] = ['lantern'];
    // Everyone starts in the kitchen: bed_clem is a dead end off east_hall, so it
    // is reachable in exactly two edges only from two rooms away.
    s.positions['bell'] = 'kitchen';
    s.positions['pike'] = 'kitchen';
    s.positions['moss'] = 'kitchen';
    s.activeCall = { caller: 'bell', target: 'moss', room: 'bed_clem', selfNominated: false };

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s),
      bell: { path: ['east_hall', 'bed_clem'], joinCall: true, snuffOwn: false },
      pike: { path: ['east_hall', 'bed_clem'], joinCall: true, snuffOwn: false },
      moss: { path: ['east_hall', 'bed_clem'], joinCall: false, snuffOwn: false },
    }, makeRng(1));

    expect(mid.caught).toBe(true);
    expect(s.lit['bed_clem']).toBe(true);
    expect(mid.theft.stole).toBe(false);
    expect(s.over).toEqual({ winner: 'children', how: 'caught' });
  });

  it('computes sightings after the theft, so the victim sees only a shadow', () => {
    const s = game();
    s.night = 3;
    s.positions['moss'] = 'kitchen'; // two rooms from bed_bell, so it can be reached
    s.positions['bell'] = 'bed_bell';

    const dusk = runDusk(s, allDusk(s), makeRng(1));
    const mid = runMidnight(s, dusk, {
      ...allMid(s),
      moss: { path: ['west_hall', 'bed_bell'], joinCall: false, snuffOwn: false },
      bell: { path: ['west_hall', 'bed_bell'], joinCall: false, snuffOwn: false },
    }, makeRng(1));

    expect(mid.theft.stole).toBe(true);
    expect(mid.sightings['bell']!.named).toEqual([]);
    expect(mid.sightings['bell']!.others).toBe(1);
    expect(mid.sightings['bell']!.lit).toBe(false);
    // The villain reads names in the dark.
    expect(mid.sightings['moss']!.named).toEqual(['bell']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/night.test.ts`
Expected: FAIL — cannot resolve `./night.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/night.ts`:
```ts
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
import { postCall, resolveCall } from './call.js';
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

const NO_THEFT: TheftOutcome = { stole: false, victim: null, room: null, events: [] };

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
    if (!theft.stole && theft.events.length === 0) {
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
  _midnight: MidnightResult,
  actions: Readonly<Record<PlayerId, MorningAction>>,
  _rng: Rng,
): { events: PublicEvent[]; claims: Record<PlayerId, RoomId | null> } {
  clearNightlyItemEffects(state);
  state.activeCall = null;

  const events: PublicEvent[] = [];
  const claims: Record<PlayerId, RoomId | null> = {};

  for (const p of state.config.roster) {
    claims[p] = canClaim(state, p) ? actions[p]!.claim : null;
    events.push(...applyItemUses(state, actions[p]!.itemUses));
  }

  let posted = 0;
  for (const p of state.config.roster) {
    const call = actions[p]!.call;
    if (call && posted < state.config.maxCallsPerNight) {
      events.push(...postCall(state, call));
      posted++;
    }
  }

  return { events, claims };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/night.test.ts`
Expected: PASS, 3 tests. These are the golden ordering tests — if either fails, the ordering is
wrong, and every downstream metric would have been wrong with it.

- [ ] **Step 5: Commit**

```bash
git add src/rules/night.ts src/rules/night.test.ts
git commit -m "feat: night orchestration with Call-before-theft-before-sightings ordering"
```

---

### Task 14: The bot interface and a random bot

**Files:**
- Create: `src/bots/types.ts`, `src/bots/random.ts`
- Test: `src/bots/random.test.ts`

**Interfaces:**
- Consumes: `GameState`, `legalPaths`, `DuskAction`, `MidnightAction`, `MorningAction`.
- Produces:
  - `interface Knowledge` — everything one player legitimately knows.
  - `interface Bot { dusk(k, rng): DuskAction; midnight(k, rng): MidnightAction; morning(k, rng): MorningAction }`
  - `randomBot: Bot`

**`Knowledge` deliberately omits `marked`.** §5 says nobody is told they have been marked; a child
discovers it when they try to join a Call and cannot. A bot that could read its own marked flag
would dodge that discovery and the marking metric would be meaningless.

- [ ] **Step 1: Write the failing test**

`src/bots/random.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from '../rules/rng.js';
import { makeConfig } from '../rules/config.js';
import { createGame } from '../rules/state.js';
import { isLegalPath } from '../rules/map.js';
import { randomBot } from './random.js';
import type { Knowledge } from './types.js';

const knowledge = (over: Partial<Knowledge> = {}): Knowledge => {
  const s = createGame(makeConfig(), makeRng(1));
  return {
    me: 'bell', isVillain: false, night: 2, position: 'bed_bell', held: [],
    lit: { ...s.lit }, publicEvents: [], mySightings: [], claims: [],
    activeCall: null, config: s.config, ...over,
  };
};

describe('randomBot', () => {
  it('only ever submits legal paths', () => {
    const k = knowledge();
    for (let i = 0; i < 200; i++) {
      const rng = makeRng(i);
      expect(isLegalPath(k.config.house, k.position, randomBot.dusk(k, rng).path)).toBe(true);
      expect(isLegalPath(k.config.house, k.position, randomBot.midnight(k, rng).path)).toBe(true);
    }
  });

  it('claims its true position and posts no Calls', () => {
    const m = randomBot.morning(knowledge({ position: 'attic' }), makeRng(1));
    expect(m.claim).toBe('attic');
    expect(m.call).toBeNull();
    expect(m.itemUses).toEqual([]);
  });

  it('never offers to join when it holds nothing', () => {
    for (let i = 0; i < 50; i++) {
      expect(randomBot.midnight(knowledge({ held: [] }), makeRng(i)).joinCall).toBe(false);
    }
  });

  it('never snuffs its own light', () => {
    const k = knowledge({ isVillain: true, me: 'moss', position: 'bed_moss' });
    for (let i = 0; i < 50; i++) {
      expect(randomBot.midnight(k, makeRng(i)).snuffOwn).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/bots/random.test.ts`
Expected: FAIL — cannot resolve `./random.js`.

- [ ] **Step 3: Write the bot interface**

`src/bots/types.ts`:
```ts
import type { GameConfig } from '../rules/config.js';
import type { Rng } from '../rules/rng.js';
import type { ItemKind, PlayerId, RoomId } from '../rules/types.js';
import type { PostedCall, PublicEvent, Sighting } from '../rules/state.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';

/**
 * Everything one player legitimately knows. Note what is absent: whether they
 * have been marked (§5 — nobody is told), and anyone else's position, holdings
 * or sightings beyond what the house announced.
 */
export interface Knowledge {
  me: PlayerId;
  isVillain: boolean;
  night: number;
  position: RoomId;
  held: ItemKind[];
  /** Which bedrooms are still burning — public, everyone sees the house. */
  lit: Record<RoomId, boolean>;
  /** Every event the house has announced, all nights, oldest first. */
  publicEvents: PublicEvent[];
  /** This player's own sightings, oldest first. */
  mySightings: Sighting[];
  /** Mandatory claims per night, oldest first. `null` means the Hush exempted them. */
  claims: Record<PlayerId, RoomId | null>[];
  activeCall: PostedCall | null;
  config: GameConfig;
}

export interface Bot {
  dusk(k: Knowledge, rng: Rng): DuskAction;
  midnight(k: Knowledge, rng: Rng): MidnightAction;
  morning(k: Knowledge, rng: Rng): MorningAction;
}
```

- [ ] **Step 4: Write the random bot**

`src/bots/random.ts`:
```ts
import type { Rng } from '../rules/rng.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';
import { legalPaths } from '../rules/map.js';
import type { Bot, Knowledge } from './types.js';

/**
 * Uniform legal play. Its job is to prove the engine never crashes and to give
 * every metric a baseline that involves no strategy whatsoever.
 */
export const randomBot: Bot = {
  dusk(k: Knowledge, rng: Rng): DuskAction {
    return { path: rng.pick(legalPaths(k.config.house, k.position)), pickUp: true };
  },

  midnight(k: Knowledge, rng: Rng): MidnightAction {
    return {
      path: rng.pick(legalPaths(k.config.house, k.position)),
      joinCall: k.held.length > 0 && rng.next() < 0.5,
      snuffOwn: false,
    };
  },

  morning(k: Knowledge, _rng: Rng): MorningAction {
    return { claim: k.position, call: null, itemUses: [] };
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/bots/random.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/bots/types.ts src/bots/random.ts src/bots/random.test.ts
git commit -m "feat: bot interface with honest knowledge, and a random baseline bot"
```

---

### Task 15: The game loop and win conditions

**Files:**
- Create: `src/rules/game.ts`
- Test: `src/rules/game.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `interface GameRecord { seed: number; config: GameConfig; villain: PlayerId; nights: NightRecord[]; outcome: { winner: 'children' | 'oddsocks'; how: 'caught' | 'survived' | 'lightsOut' } }`
  - `playGame(config, seed, bots: Record<PlayerId, Bot>): GameRecord`
  - `knowledgeFor(state, player, mySightings, claims): Knowledge`

Win conditions: the villain wins the moment `darkBedroomCount(state) >= lightsRequired`. The
children win by catching the villain in a Call, or by surviving — dawn breaking after the last
active night with any required light still burning.

- [ ] **Step 1: Write the failing test**

`src/rules/game.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from './config.js';
import { playGame } from './game.js';
import { randomBot } from '../bots/random.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number, over = {}) => playGame(makeConfig(over), seed, bots);

describe('playGame', () => {
  it('always terminates with a winner', () => {
    for (let seed = 0; seed < 300; seed++) {
      const g = play(seed);
      expect(['children', 'oddsocks']).toContain(g.outcome.winner);
      expect(['caught', 'survived', 'lightsOut']).toContain(g.outcome.how);
    }
  });

  it('never runs past the configured night count', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(play(seed).nights.length).toBeLessThanOrEqual(makeConfig().totalNights);
    }
  });

  it('records one entry per night played, with claims and sightings', () => {
    const g = play(1);
    g.nights.forEach((n, i) => {
      expect(n.night).toBe(i + 1);
      expect(Object.keys(n.midnightPositions).sort()).toEqual([...ROSTER].sort());
      expect(Object.keys(n.sightings).sort()).toEqual([...ROSTER].sort());
      expect(Object.keys(n.claims).sort()).toEqual([...ROSTER].sort());
    });
  });

  it('is byte-identical for the same seed', () => {
    expect(JSON.stringify(play(77).nights)).toBe(JSON.stringify(play(77).nights));
  });

  it('produces different games across seeds', () => {
    const shapes = new Set(Array.from({ length: 40 }, (_, i) =>
      `${play(i).villain}:${play(i).nights.length}:${play(i).outcome.how}`));
    expect(shapes.size).toBeGreaterThan(3);
  });

  it('gives the children the survival win when the deadline passes', () => {
    const survivals = Array.from({ length: 200 }, (_, i) => play(i))
      .filter((g) => g.outcome.how === 'survived');
    for (const g of survivals) {
      expect(g.nights.length).toBe(makeConfig().totalNights);
      expect(g.outcome.winner).toBe('children');
    }
  });

  it('never leaves a hushed child making a claim under hushMode silent', () => {
    for (let seed = 0; seed < 50; seed++) {
      const g = play(seed);
      const hushed = new Set<string>();
      for (const night of g.nights) {
        for (const p of ROSTER) {
          if (hushed.has(p)) expect(night.claims[p]).toBeNull();
        }
        for (const e of night.events) {
          if (e.t === 'theft') hushed.add(e.victim);
          if (e.t === 'selfSnuff') hushed.add(g.villain);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/game.test.ts`
Expected: FAIL — cannot resolve `./game.js`.

- [ ] **Step 3: Write the implementation**

`src/rules/game.ts`:
```ts
import type { GameConfig } from './config.js';
import { makeRng } from './rng.js';
import type { PlayerId, RoomId } from './types.js';
import type { NightRecord, Sighting } from './state.js';
import { type GameState, createGame, darkBedroomCount } from './state.js';
import { runDusk, runMidnight, runMorning,
  type DuskAction, type MidnightAction, type MorningAction } from './night.js';
import type { Bot, Knowledge } from '../bots/types.js';

export interface GameRecord {
  seed: number;
  config: GameConfig;
  villain: PlayerId;
  nights: NightRecord[];
  outcome: { winner: 'children' | 'oddsocks'; how: 'caught' | 'survived' | 'lightsOut' };
}

export function knowledgeFor(
  state: GameState,
  player: PlayerId,
  mySightings: Sighting[],
  claims: Record<PlayerId, RoomId | null>[],
): Knowledge {
  return {
    me: player,
    isVillain: player === state.villain,
    night: state.night,
    position: state.positions[player]!,
    held: [...state.held[player]!],
    lit: { ...state.lit },
    publicEvents: state.history.flatMap((h) => h.events),
    mySightings,
    claims,
    activeCall: state.activeCall,
    config: state.config,
  };
}

export function playGame(
  config: GameConfig,
  seed: number,
  bots: Readonly<Record<PlayerId, Bot>>,
): GameRecord {
  const rng = makeRng(seed);
  const state = createGame(config, rng);
  const sightingLog: Record<PlayerId, Sighting[]> =
    Object.fromEntries(config.roster.map((p) => [p, [] as Sighting[]]));
  const claimLog: Record<PlayerId, RoomId | null>[] = [];

  const ask = <T,>(pick: (bot: Bot, k: Knowledge) => T): Record<PlayerId, T> =>
    Object.fromEntries(config.roster.map((p) =>
      [p, pick(bots[p]!, knowledgeFor(state, p, sightingLog[p]!, claimLog))]));

  for (let night = 1; night <= config.totalNights; night++) {
    state.night = night;

    const dusk = runDusk(state,
      ask<DuskAction>((bot, k) => bot.dusk(k, rng)) as Record<PlayerId, DuskAction>, rng);

    const midnight = runMidnight(state, dusk,
      ask<MidnightAction>((bot, k) => bot.midnight(k, rng)) as Record<PlayerId, MidnightAction>,
      rng);

    for (const p of config.roster) sightingLog[p]!.push(midnight.sightings[p]!);

    const morning = runMorning(state, dusk, midnight,
      ask<MorningAction>((bot, k) => bot.morning(k, rng)) as Record<PlayerId, MorningAction>, rng);
    claimLog.push(morning.claims);

    state.history.push({
      night,
      duskPositions: dusk.positions,
      midnightPositions: midnight.positions,
      events: [...dusk.events, ...midnight.events, ...morning.events],
      sightings: midnight.sightings,
      claims: morning.claims,
    });

    if (state.over) break;
    if (darkBedroomCount(state) >= config.lightsRequired) {
      state.over = { winner: 'oddsocks', how: 'lightsOut' };
      break;
    }
  }

  const outcome = state.over ?? { winner: 'children' as const, how: 'survived' as const };
  return { seed, config, villain: state.villain, nights: state.history, outcome };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/rules/game.test.ts`
Expected: PASS, 7 tests. The 300-seed termination check is the smoke test for the whole engine — if
any seed throws, fix the rule that threw, never the loop.

- [ ] **Step 5: Commit**

```bash
git add src/rules/game.ts src/rules/game.test.ts
git commit -m "feat: full game loop with the three win conditions"
```

---

### Task 16: The safe-lie solver

**Files:**
- Create: `src/analysis/safeLies.ts`
- Test: `src/analysis/safeLies.test.ts`

**Interfaces:**
- Consumes: `GameRecord`, `House`, `distance`, `roomsWithin`, `PUBLIC_ODDITIES`.
- Produces:
  - `viableRoomsAt(record, night): RoomId[]` — rooms the villain could have claimed on that night, ignoring the chain.
  - `solve(record): { forcedNight: number | null; hidingSpace: number[] }` — forward-backward DP over the whole claim history.

This is the instrument the whole harness exists for. It does not simulate a liar; it computes
whether a consistent lie **existed**. Rooms are viable only if they survive every constraint listed
in the spec's §6.1 table.

Only public oddities constrain — private ones are deniable by design.

- [ ] **Step 1: Write the failing test**

`src/analysis/safeLies.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { randomBot } from '../bots/random.js';
import { viableRoomsAt, solve } from './safeLies.js';
import type { GameRecord } from '../rules/game.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number): GameRecord => playGame(makeConfig(), seed, bots);

describe('viableRoomsAt', () => {
  it('never marks a room viable when a lit-room witness saw the villain elsewhere', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = play(seed);
      g.nights.forEach((n, i) => {
        const seen = ROSTER.some((p) =>
          p !== g.villain && n.sightings[p]!.lit && n.sightings[p]!.named.includes(g.villain));
        if (!seen) return;
        const truth = n.midnightPositions[g.villain]!;
        expect(viableRoomsAt(g, i + 1)).toEqual([truth]);
      });
    }
  });

  it('always includes the villain\'s true room — the truth is never contradicted', () => {
    for (let seed = 0; seed < 60; seed++) {
      const g = play(seed);
      g.nights.forEach((n, i) => {
        expect(viableRoomsAt(g, i + 1)).toContain(n.midnightPositions[g.villain]);
      });
    }
  });

  it('refutes a lit room whose occupants did not name the villain', () => {
    const g = play(3);
    const night = g.nights[1]!;
    const occupied = ROSTER.find((p) =>
      p !== g.villain && night.sightings[p]!.lit &&
      night.midnightPositions[p] !== night.midnightPositions[g.villain]);
    if (!occupied) return;
    expect(viableRoomsAt(g, 2)).not.toContain(night.midnightPositions[occupied]);
  });
});

describe('solve', () => {
  it('reports a hiding space for every night played', () => {
    const g = play(11);
    const r = solve(g);
    expect(r.hidingSpace).toHaveLength(g.nights.length);
    for (const n of r.hidingSpace) expect(n).toBeGreaterThanOrEqual(0);
  });

  it('never reports a forced contradiction, since the truth is always available', () => {
    // The true claim history is always consistent, so no game can be "forced"
    // unless a constraint is wrong. This is the solver's own correctness check.
    for (let seed = 0; seed < 100; seed++) {
      expect(solve(play(seed)).forcedNight).toBeNull();
    }
  });

  it('collapses the hiding space to one when the villain is fully witnessed', () => {
    const g = play(5);
    const r = solve(g);
    g.nights.forEach((n, i) => {
      const witnessed = ROSTER.some((p) =>
        p !== g.villain && n.sightings[p]!.lit && n.sightings[p]!.named.includes(g.villain));
      if (witnessed) expect(r.hidingSpace[i]).toBe(1);
    });
  });
});
```

**Important:** the second `solve` test encodes the solver's key invariant. Because the villain's
*true* history is always consistent with every fact, `forcedNight` must be `null` for any game
where the villain claimed truthfully. `forcedNight` only becomes non-null once the heuristic villain
(Task 17) starts claiming from the viable set and that set runs empty. If this test ever fails, a
constraint is over-tight and is refuting the truth — fix the constraint, never the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analysis/safeLies.test.ts`
Expected: FAIL — cannot resolve `./safeLies.js`.

- [ ] **Step 3: Write the implementation**

`src/analysis/safeLies.ts`:
```ts
import type { GameRecord } from '../rules/game.js';
import type { PlayerId, RoomId } from '../rules/types.js';
import type { NightRecord } from '../rules/state.js';
import { distance, doorsOf, floorOf, isBedroom, roomsWithin } from '../rules/map.js';

/** Two phases of two steps each. */
const MAX_HOPS_PER_NIGHT = 4;

const others = (record: GameRecord): PlayerId[] =>
  record.config.roster.filter((p) => p !== record.villain);

/**
 * Every room the villain could have claimed on this night without contradicting a
 * hard fact. Ignores the night-to-night chain — `solve` handles that.
 */
export function viableRoomsAt(record: GameRecord, night: number): RoomId[] {
  const n = record.nights[night - 1];
  if (!n) return [];

  const house = record.config.house;
  const villain = record.villain;
  const truth = n.midnightPositions[villain]!;
  const innocents = others(record);

  // A lit-room witness names everyone present. If one named the villain, the
  // claim is pinned; if one was somewhere else and did not, that room is refuted.
  const refuted = new Set<RoomId>();
  for (const p of innocents) {
    const s = n.sightings[p]!;
    if (!s.lit) continue;
    if (s.named.includes(villain)) return [truth];
    refuted.add(s.room);
  }

  // Dark rooms hide identity but not headcount. If an occupant reported k others,
  // exactly k+1 players were there — one more claimant than that is a contradiction.
  for (const p of innocents) {
    const s = n.sightings[p]!;
    if (s.lit) continue;
    const claimants = record.config.roster.filter((q) => n.claims[q] === s.room).length;
    if (claimants >= s.others + 1) refuted.add(s.room);
  }

  let candidates = Object.keys(house.rooms).filter((r) => !refuted.has(r));

  // The trail: if it named the villain, they were within the radius of the robbery.
  for (const e of n.events) {
    if (e.t === 'trail' && e.player === villain) {
      const near = new Set(roomsWithin(house, e.room, record.config.trailRadius));
      candidates = candidates.filter((r) => near.has(r));
    }
    // The Bell announces the true room outright — no lie survives it.
    if (e.t === 'bell' && e.target === villain) candidates = [e.room];
    // A Keyhole pins or forbids this night's claim.
    if (e.t === 'keyhole' && e.night === night) {
      candidates = e.occupants.includes(villain)
        ? candidates.filter((r) => r === e.room)
        : candidates.filter((r) => r !== e.room);
    }
  }

  // Public oddities only — private ones are deniable, so they prove nothing.
  candidates = candidates.filter((r) => publicOdditiesAllow(record, n, r));

  // A theft is a light going out in a room the villain was standing in, and a
  // dark room can hold a lie. Nothing further to enforce here.
  return candidates.sort();
}

function publicOdditiesAllow(record: GameRecord, n: NightRecord, claim: RoomId): boolean {
  if (!record.config.layers.oddities) return true;
  const house = record.config.house;
  const villain = record.villain;
  const innocents = others(record);

  for (const e of n.events) {
    if (e.t !== 'oddity') continue;
    const payload = e.payload as Record<string, unknown>;

    if (e.source === 'bell' && e.detail === 'adjacentCount' && villain !== 'bell') {
      const bellRoom = n.midnightPositions['bell'];
      if (!bellRoom) continue;
      const beside = new Set(doorsOf(house, bellRoom));
      const fromInnocents = innocents
        .filter((p) => p !== 'bell' && beside.has(n.midnightPositions[p]!)).length;
      const implied = fromInnocents + (beside.has(claim) ? 1 : 0);
      if (implied !== payload['count']) return false;
    }

    if (e.source === 'clem' && e.detail === 'itemHolders' && villain !== 'clem') {
      const clemRoom = n.midnightPositions['clem'];
      if (!clemRoom || claim !== clemRoom) continue;
      // Item holding is public, so a villain claiming Clem's room must fit the tally.
      const held = n.events.filter((x) => x.t === 'itemTaken' && x.player === villain).length;
      if (held > 0 && payload['count'] === 0) return false;
    }
  }
  return true;
}

/**
 * Forward-backward DP over claim histories. State is "the room claimed on night n",
 * transitions are "reachable within four hops".
 */
export function solve(record: GameRecord): { forcedNight: number | null; hidingSpace: number[] } {
  const house = record.config.house;
  const nights = record.nights.length;

  const viable: RoomId[][] = [];
  for (let i = 1; i <= nights; i++) viable.push(viableRoomsAt(record, i));

  // Forward pass: which rooms are reachable from a consistent past.
  let reachable: Set<RoomId> = new Set(viable[0] ?? []);
  const forward: Set<RoomId>[] = [new Set(reachable)];

  for (let i = 1; i < nights; i++) {
    const next = new Set<RoomId>();
    for (const room of viable[i]!) {
      for (const prev of reachable) {
        if (distance(house, prev, room) <= MAX_HOPS_PER_NIGHT) { next.add(room); break; }
      }
    }
    forward.push(new Set(next));
    reachable = next;
    if (next.size === 0) {
      return { forcedNight: i + 1, hidingSpace: forward.map((s) => s.size) };
    }
  }

  if ((forward[0]?.size ?? 0) === 0) return { forcedNight: 1, hidingSpace: [0] };

  // Backward pass: drop rooms with no consistent future.
  const hidingSpace = forward.map((s) => s.size);
  for (let i = nights - 2; i >= 0; i--) {
    const survivors = [...forward[i]!].filter((room) =>
      [...forward[i + 1]!].some((nxt) => distance(house, room, nxt) <= MAX_HOPS_PER_NIGHT));
    forward[i] = new Set(survivors);
    hidingSpace[i] = survivors.length;
  }

  return { forcedNight: null, hidingSpace };
}
```

Two details that matter:

- Import only `distance`, `doorsOf` and `roomsWithin` from `../rules/map.js`. `isBedroom` and
  `floorOf` are not used here — leave them out rather than carrying dead imports.
- **`hidingSpace` must always have one entry per night played.** The early return on a forced
  contradiction produces a short array, which breaks Task 19's per-night metric. Pad it before
  returning, in both exit paths:

```ts
  const padded = (xs: number[]): number[] =>
    xs.concat(Array<number>(Math.max(0, nights - xs.length)).fill(0));
```

and wrap every `hidingSpace` value in `padded(...)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/analysis/safeLies.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/analysis/safeLies.ts src/analysis/safeLies.test.ts
git commit -m "feat: policy-independent safe-lie solver"
```

---

### Task 17: Sighting reports and the Hush's second half

**Files:**
- Modify: `src/rules/state.ts` (add to the `PublicEvent` union and `NightRecord`)
- Modify: `src/rules/night.ts` (`runMorning`)
- Modify: `src/analysis/safeLies.ts` (`viableRoomsAt`)
- Test: `src/rules/reporting.test.ts`

**Interfaces:**
- Produces: `PublicEvent` gains `{ t: 'reported'; player: PlayerId; room: RoomId; named: PlayerId[]; others: number; lit: boolean }`. `NightRecord` gains `reporters: PlayerId[]`.

**Why this task exists.** Tasks 15 and 16 have a hole. §4 says a Hushed child loses *"reporting
anything you personally saw"* — but the solver reads `n.sightings` for every player, Hushed or not,
so it treats testimony that could never have been given as public fact. That inflates the signal
available to the children, in exactly the direction that would make the design look healthier than
it is. It also leaves the villain bot (Task 18) unable to reason about what testimony exists.

Under R15 every child who *can* report, does, truthfully and without an utterance budget. So the
fix is to make reports explicit events and have the solver read only those.

- [ ] **Step 1: Write the failing test**

`src/rules/reporting.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from './config.js';
import { playGame } from './game.js';
import { randomBot } from '../bots/random.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, randomBot]));
const play = (seed: number, over = {}) => playGame(makeConfig(over), seed, bots);

describe('sighting reports', () => {
  it('lists every unhushed child as a reporter', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = play(seed);
      for (const night of g.nights) {
        for (const p of ROSTER) {
          const claimed = night.claims[p] !== null;
          expect(night.reporters.includes(p)).toBe(claimed);
        }
      }
    }
  });

  it('emits one report event per reporter', () => {
    const g = play(4);
    for (const night of g.nights) {
      const reports = night.events.filter((e) => e.t === 'reported');
      expect(reports).toHaveLength(night.reporters.length);
    }
  });

  it('reports match the reporter\'s true sighting', () => {
    const g = play(4);
    for (const night of g.nights) {
      for (const e of night.events) {
        if (e.t !== 'reported') continue;
        expect(e.room).toBe(night.sightings[e.player]!.room);
        expect(e.named).toEqual(night.sightings[e.player]!.named);
      }
    }
  });

  it('lets a hushed child neither claim nor report', () => {
    const g = play(9);
    const hushed = new Set<string>();
    for (const night of g.nights) {
      for (const p of hushed) {
        expect(night.claims[p]).toBeNull();
        expect(night.reporters).not.toContain(p);
      }
      for (const e of night.events) {
        if (e.t === 'theft') hushed.add(e.victim);
        if (e.t === 'selfSnuff') hushed.add(g.villain);
      }
    }
  });
});

describe('the solver reads only reportable testimony', () => {
  it('still never refutes the truth once hushed witnesses are excluded', async () => {
    const { solve } = await import('../analysis/safeLies.js');
    for (let seed = 0; seed < 100; seed++) {
      expect(solve(play(seed)).forcedNight).toBeNull();
    }
  });

  it('gives the villain more room once witnesses go silent', async () => {
    const { solve } = await import('../analysis/safeLies.js');
    let widened = 0;
    for (let seed = 0; seed < 60; seed++) {
      const space = solve(play(seed)).hidingSpace;
      if (space.length > 2 && space[space.length - 1]! >= space[1]!) widened++;
    }
    expect(widened).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rules/reporting.test.ts`
Expected: FAIL — `night.reporters` is undefined.

- [ ] **Step 3: Extend the state types**

In `src/rules/state.ts`, add to the `PublicEvent` union:
```ts
  | { t: 'reported'; player: PlayerId; room: RoomId; named: PlayerId[];
      others: number; lit: boolean }
```

And add to `NightRecord`:
```ts
  /** Who was able to give testimony this morning. The Hush removes people from here. */
  reporters: PlayerId[];
```

- [ ] **Step 4: Emit reports in the morning**

In `src/rules/night.ts`, change `runMorning`'s signature and body so it uses the midnight sightings
it is already handed. Replace the `_midnight` parameter with `midnight`, add `reporters` to the
return type, and inside the per-player loop:

```ts
  const reporters: PlayerId[] = [];
  for (const p of state.config.roster) {
    const speaks = canClaim(state, p);
    claims[p] = speaks ? actions[p]!.claim : null;
    if (speaks) {
      const s = midnight.sightings[p]!;
      reporters.push(p);
      events.push({
        t: 'reported', player: p, room: s.room, named: s.named,
        others: s.others, lit: s.lit,
      });
    }
    events.push(...applyItemUses(state, actions[p]!.itemUses));
  }
```

and return `{ events, claims, reporters }`.

In `src/rules/game.ts`, add `reporters: morning.reporters` to the `state.history.push({...})` call.

**`reporters` is now required on `NightRecord`, so two hand-built literals stop compiling.** Add
`reporters: []` to the `s.history.push({...})` calls in `src/rules/itemEffects.test.ts` — both the
Keyhole test and the empty-room test. Nothing else constructs a `NightRecord` by hand.

- [ ] **Step 5: Make the solver read reports, not truth**

In `src/analysis/safeLies.ts`, inside `viableRoomsAt`, replace both witness loops with loops over
the night's `reported` events:

```ts
  const reports = n.events.filter(
    (e): e is Extract<typeof e, { t: 'reported' }> => e.t === 'reported',
  ).filter((e) => e.player !== villain);

  const refuted = new Set<RoomId>();
  for (const r of reports) {
    if (!r.lit) continue;
    if (r.named.includes(villain)) return [truth];
    refuted.add(r.room);
  }

  for (const r of reports) {
    if (r.lit) continue;
    const claimants = record.config.roster.filter((q) => n.claims[q] === r.room).length;
    if (claimants >= r.others + 1) refuted.add(r.room);
  }
```

Delete the now-unused `innocents` binding from the witness section (it is still needed inside
`publicOdditiesAllow`).

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS. Task 16's `safeLies.test.ts` referenced `n.sightings` directly for its own
assertions — those still hold, because a reporter's report equals their sighting. If the
"collapses the hiding space to one when the villain is fully witnessed" test now fails on a seed
where the witness was Hushed, tighten that test to skip Hushed witnesses.

- [ ] **Step 7: Commit**

```bash
git add src/rules/state.ts src/rules/night.ts src/rules/game.ts src/analysis/safeLies.ts src/rules/reporting.test.ts
git commit -m "feat: sighting reports as public events, silenced by the Hush"
```

---

### Task 18: Heuristic bots

**Files:**
- Create: `src/bots/heuristic.ts`
- Test: `src/bots/heuristic.test.ts`

**Interfaces:**
- Consumes: `Knowledge`, `Bot`, map helpers.
- Produces: `heuristicBot: Bot`, `suspicionFrom(k: Knowledge): Record<PlayerId, number>`.

The children fetch items, stay home sometimes for the Grip, and aim Calls using trail namings as
suspicion. The villain walks to the nearest lit bedroom it can reach, dodges a Call aimed at itself,
and **claims from its own reconstruction of the viable set** — which makes it the strongest liar the
information available to it permits, without anyone writing a lying AI.

- [ ] **Step 1: Write the failing test**

`src/bots/heuristic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeRng } from '../rules/rng.js';
import { makeConfig, ROSTER } from '../rules/config.js';
import { createGame } from '../rules/state.js';
import { isLegalPath } from '../rules/map.js';
import { playGame } from '../rules/game.js';
import { heuristicBot, suspicionFrom } from './heuristic.js';
import type { Knowledge } from './types.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));
const knowledge = (over: Partial<Knowledge> = {}): Knowledge => {
  const s = createGame(makeConfig(), makeRng(1));
  return {
    me: 'bell', isVillain: false, night: 3, position: 'bed_bell', held: [],
    lit: { ...s.lit }, publicEvents: [], mySightings: [], claims: [],
    activeCall: null, config: s.config, ...over,
  };
};

describe('legality', () => {
  it('only ever submits legal paths, villain or not', () => {
    for (const isVillain of [false, true]) {
      for (let i = 0; i < 100; i++) {
        const k = knowledge({ isVillain, me: isVillain ? 'moss' : 'bell',
          position: isVillain ? 'bed_moss' : 'bed_bell' });
        const rng = makeRng(i);
        expect(isLegalPath(k.config.house, k.position, heuristicBot.dusk(k, rng).path)).toBe(true);
        expect(isLegalPath(k.config.house, k.position, heuristicBot.midnight(k, rng).path)).toBe(true);
      }
    }
  });
});

describe('suspicion', () => {
  it('rises for a child the trail has named', () => {
    const k = knowledge({ publicEvents: [
      { t: 'trail', player: 'pike', room: 'bed_bell' },
      { t: 'trail', player: 'pike', room: 'bed_clem' },
      { t: 'trail', player: 'clem', room: 'bed_bell' },
    ] });
    const s = suspicionFrom(k);
    expect(s['pike']!).toBeGreaterThan(s['clem']!);
    expect(s['pike']!).toBeGreaterThan(s['wren'] ?? 0);
  });

  it('never suspects yourself', () => {
    const k = knowledge({ me: 'pike', publicEvents: [{ t: 'trail', player: 'pike', room: 'bed_bell' }] });
    expect(suspicionFrom(k)['pike']).toBe(0);
  });
});

describe('the villain', () => {
  // From the kitchen the reachable bedrooms are bed_bell and bed_pike (via
  // west_hall) and bed_clem (via east_hall). Adjacent dead ends are not reachable.
  it('dodges a Call aimed at itself', () => {
    const k = knowledge({
      isVillain: true, me: 'moss', position: 'kitchen',
      activeCall: { caller: 'bell', target: 'moss', room: 'bed_bell', selfNominated: false },
    });
    for (let i = 0; i < 50; i++) {
      expect(heuristicBot.midnight(k, makeRng(i)).path[1]).not.toBe('bed_bell');
    }
  });

  it('walks into someone else\'s lit bedroom when it can reach one', () => {
    const k = knowledge({ isVillain: true, me: 'moss', position: 'kitchen' });
    for (let i = 0; i < 20; i++) {
      expect(['bed_bell', 'bed_pike', 'bed_clem'])
        .toContain(heuristicBot.midnight(k, makeRng(i)).path[1]);
    }
  });
});

describe('whole games', () => {
  it('produces Calls that actually go live at least sometimes', () => {
    let live = 0;
    for (let seed = 0; seed < 120; seed++) {
      for (const night of playGame(makeConfig(), seed, bots).nights) {
        for (const e of night.events) {
          if (e.t === 'callResolved' && e.outcome !== 'fizzled') live++;
        }
      }
    }
    expect(live).toBeGreaterThan(0);
  });

  it('terminates for every seed', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(playGame(makeConfig(), seed, bots).outcome.winner).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/bots/heuristic.test.ts`
Expected: FAIL — cannot resolve `./heuristic.js`.

- [ ] **Step 3: Write the implementation**

`src/bots/heuristic.ts`:
```ts
import type { Rng } from '../rules/rng.js';
import type { PlayerId, Path, RoomId } from '../rules/types.js';
import type { DuskAction, MidnightAction, MorningAction } from '../rules/night.js';
import { distance, isBedroom, legalPaths, ownerOf } from '../rules/map.js';
import type { Bot, Knowledge } from './types.js';

/** Trail namings are the only people-facts the house produces, so they drive suspicion. */
export function suspicionFrom(k: Knowledge): Record<PlayerId, number> {
  const score: Record<PlayerId, number> = {};
  for (const p of k.config.roster) score[p] = 0;

  for (const e of k.publicEvents) {
    if (e.t === 'trail') score[e.player] = (score[e.player] ?? 0) + 1;
    if (e.t === 'eyesOpen') score[e.player] = (score[e.player] ?? 0) + 2;
    if (e.t === 'callResolved' && e.outcome === 'cleared') score[e.target] = -100;
  }

  score[k.me] = 0;
  return score;
}

const looseItemRooms = (k: Knowledge): RoomId[] => {
  const here = new Map<RoomId, number>();
  for (const e of k.publicEvents) {
    if (e.t === 'itemSpawned') here.set(e.room, (here.get(e.room) ?? 0) + 1);
    if (e.t === 'itemTaken') here.set(e.room, (here.get(e.room) ?? 0) - 1);
  }
  return [...here.entries()].filter(([, n]) => n > 0).map(([r]) => r);
};

const litBedrooms = (k: Knowledge): RoomId[] =>
  Object.keys(k.config.house.rooms)
    .filter((r) => isBedroom(k.config.house, r) && k.lit[r] === true);

/** Pick the legal path whose destination scores best; ties broken by the rng. */
function bestPath(k: Knowledge, rng: Rng, score: (dest: RoomId) => number): Path {
  const paths = legalPaths(k.config.house, k.position);
  let best = -Infinity;
  let pool: Path[] = [];
  for (const p of paths) {
    const v = score(p[1]);
    if (v > best) { best = v; pool = [p]; }
    else if (v === best) pool.push(p);
  }
  return rng.pick(pool);
}

export const heuristicBot: Bot = {
  dusk(k: Knowledge, rng: Rng): DuskAction {
    const wantItem = k.held.length < k.config.carryCapacity ||
      (k.me === 'moss' && k.held.length < k.config.mossCarryCapacity);
    const targets = wantItem ? looseItemRooms(k) : [];

    const path = bestPath(k, rng, (dest) => {
      if (targets.includes(dest)) return 10;
      if (targets.length === 0) return 0;
      return -Math.min(...targets.map((t) => distance(k.config.house, dest, t)));
    });
    return { path, pickUp: true };
  },

  midnight(k: Knowledge, rng: Rng): MidnightAction {
    const call = k.activeCall;

    if (k.isVillain) {
      const forbidden = call && call.target === k.me ? call.room : null;
      const myBed = `bed_${k.me}`;
      const path = bestPath(k, rng, (dest) => {
        if (dest === forbidden) return -100;
        if (!isBedroom(k.config.house, dest) || k.lit[dest] !== true) return 0;
        return ownerOf(k.config.house, dest) === k.me ? 1 : 20;
      });
      return { path, joinCall: false, snuffOwn: path[1] === myBed && k.night > 1 };
    }

    // A child with an item joins a Call on the child they suspect most.
    const suspicion = suspicionFrom(k);
    const willJoin = call !== null && k.held.length > 0 &&
      (suspicion[call.target] ?? 0) >= Math.max(0, ...Object.values(suspicion)) &&
      (suspicion[call.target] ?? 0) > 0;

    if (willJoin && call) {
      const reaching = legalPaths(k.config.house, k.position).filter((p) => p[1] === call.room);
      if (reaching.length > 0) {
        return { path: rng.pick(reaching), joinCall: true, snuffOwn: false };
      }
    }

    // Otherwise go home — the Grip makes staying in your own bed profitable.
    const myBed = `bed_${k.me}`;
    return {
      path: bestPath(k, rng, (dest) => (dest === myBed ? 5 : 0)),
      joinCall: false,
      snuffOwn: false,
    };
  },

  morning(k: Knowledge, rng: Rng): MorningAction {
    if (!k.isVillain) {
      const suspicion = suspicionFrom(k);
      const ranked = k.config.roster
        .filter((p) => p !== k.me)
        .sort((a, b) => (suspicion[b] ?? 0) - (suspicion[a] ?? 0));
      const top = ranked[0];
      const rooms = litBedrooms(k);

      const call = top && (suspicion[top] ?? 0) > 0 && rooms.length > 0 && k.held.length > 0
        ? { caller: k.me, target: top, room: rng.pick(rooms), selfNominated: false }
        : null;

      return { claim: k.position, call, itemUses: [] };
    }

    return { claim: villainClaim(k, rng), call: null, itemUses: [] };
  },
};

/**
 * The villain's lie, reconstructed from what the house has said and what the
 * children have reported. Any room not refuted is fair game; the truth is always
 * in the set, so this never becomes an illegal claim.
 */
function villainClaim(k: Knowledge, rng: Rng): RoomId {
  const nightEvents = k.publicEvents;
  const refuted = new Set<RoomId>();

  for (const e of nightEvents) {
    if (e.t !== 'reported' || e.player === k.me) continue;
    if (e.lit && e.named.includes(k.me)) return k.position;
    if (e.lit) refuted.add(e.room);
  }

  const candidates = Object.keys(k.config.house.rooms)
    .filter((r) => !refuted.has(r))
    .filter((r) => distance(k.config.house, k.position, r) <= 4);

  return candidates.length > 0 ? rng.pick(candidates.sort()) : k.position;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/bots/heuristic.test.ts`
Expected: PASS, 7 tests. If "Calls that actually go live" returns zero, that is **not** a test to
weaken — it is the first real finding, and it means §12 Q2 has come back "no". Record it and
continue; Task 20's sweep will quantify it.

- [ ] **Step 5: Commit**

```bash
git add src/bots/heuristic.ts src/bots/heuristic.test.ts
git commit -m "feat: heuristic bots with trail-driven suspicion and a viable-set liar"
```

---

### Task 19: Metrics

**Files:**
- Create: `src/analysis/metrics.ts`
- Test: `src/analysis/metrics.test.ts`

**Interfaces:**
- Consumes: `GameRecord`, `solve`.
- Produces:
  - `interface GameMetrics { winner; how; nights; forcedNight: number | null; hidingSpace: number[]; trailNamings: number; trailHits: number; callsPosted: number; callsLive: number; callsCaught: number; thefts: number; wastedNights: number; markings: number; meanItemHolders: number; encounterRate: number }`
  - `measure(record: GameRecord): GameMetrics`

- [ ] **Step 1: Write the failing test**

`src/analysis/metrics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { heuristicBot } from '../bots/heuristic.js';
import { measure } from './metrics.js';

const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));
const play = (seed: number) => playGame(makeConfig(), seed, bots);

describe('measure', () => {
  it('counts trail hits as a subset of trail namings', () => {
    for (let seed = 0; seed < 60; seed++) {
      const m = measure(play(seed));
      expect(m.trailHits).toBeLessThanOrEqual(m.trailNamings);
      expect(m.trailHits).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts live Calls as a subset of posted Calls, and caught as a subset of live', () => {
    for (let seed = 0; seed < 60; seed++) {
      const m = measure(play(seed));
      expect(m.callsLive).toBeLessThanOrEqual(m.callsPosted);
      expect(m.callsCaught).toBeLessThanOrEqual(m.callsLive);
    }
  });

  it('reports one hiding-space entry per night played', () => {
    const g = play(3);
    expect(measure(g).hidingSpace).toHaveLength(g.nights.length);
  });

  it('never reports more thefts than active nights', () => {
    const c = makeConfig();
    for (let seed = 0; seed < 60; seed++) {
      expect(measure(play(seed)).thefts).toBeLessThanOrEqual(c.activeNights);
    }
  });

  it('agrees with the recorded outcome', () => {
    const g = play(8);
    const m = measure(g);
    expect(m.winner).toBe(g.outcome.winner);
    expect(m.how).toBe(g.outcome.how);
    expect(m.nights).toBe(g.nights.length);
  });

  it('reports an encounter rate between 0 and 1', () => {
    for (let seed = 0; seed < 40; seed++) {
      const r = measure(play(seed)).encounterRate;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analysis/metrics.test.ts`
Expected: FAIL — cannot resolve `./metrics.js`.

- [ ] **Step 3: Write the implementation**

`src/analysis/metrics.ts`:
```ts
import type { GameRecord } from '../rules/game.js';
import type { RoomId } from '../rules/types.js';
import { solve } from './safeLies.js';

export interface GameMetrics {
  winner: 'children' | 'oddsocks';
  how: 'caught' | 'survived' | 'lightsOut';
  nights: number;
  forcedNight: number | null;
  hidingSpace: number[];
  trailNamings: number;
  trailHits: number;
  callsPosted: number;
  callsLive: number;
  callsCaught: number;
  thefts: number;
  /** Active nights the villain spent on neither a theft nor a self-snuff. */
  markings: number;
  meanItemHolders: number;
  encounterRate: number;
}

export function measure(record: GameRecord): GameMetrics {
  const { forcedNight, hidingSpace } = solve(record);

  let trailNamings = 0, trailHits = 0;
  let callsPosted = 0, callsLive = 0, callsCaught = 0;
  let thefts = 0;
  let holderTotal = 0;

  let sharedRooms = 0, roomSlots = 0;

  for (const night of record.nights) {
    const held = new Set<string>();
    for (const e of night.events) {
      switch (e.t) {
        case 'trail':
          trailNamings++;
          if (e.player === record.villain) trailHits++;
          break;
        case 'callPosted': callsPosted++; break;
        case 'callResolved':
          if (e.outcome !== 'fizzled') callsLive++;
          if (e.outcome === 'caught') callsCaught++;
          break;
        case 'theft': thefts++; break;
        case 'itemTaken': held.add(e.player); break;
        default: break;
      }
    }
    holderTotal += held.size;

    const occupancy = new Map<RoomId, number>();
    for (const room of Object.values(night.midnightPositions)) {
      occupancy.set(room, (occupancy.get(room) ?? 0) + 1);
    }
    roomSlots += Object.keys(record.config.house.rooms).length;
    for (const n of occupancy.values()) if (n >= 2) sharedRooms++;
  }

  const activeNights = Math.max(0, record.nights.length - 1);
  // A marking is an active night the villain spent without a theft or a self-snuff.
  const selfSnuffs = record.nights
    .filter((n) => n.events.some((e) => e.t === 'selfSnuff')).length;
  const markings = Math.max(0, activeNights - thefts - selfSnuffs);

  return {
    winner: record.outcome.winner,
    how: record.outcome.how,
    nights: record.nights.length,
    forcedNight,
    hidingSpace,
    trailNamings,
    trailHits,
    callsPosted,
    callsLive,
    callsCaught,
    thefts,
    markings,
    meanItemHolders: record.nights.length > 0 ? holderTotal / record.nights.length : 0,
    encounterRate: roomSlots > 0 ? sharedRooms / roomSlots : 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/analysis/metrics.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/analysis/metrics.ts src/analysis/metrics.test.ts
git commit -m "feat: per-game metric extraction"
```

---

### Task 20: The sweep runner, the report, and the baseline

**Files:**
- Create: `src/analysis/sweep.ts`, `src/analysis/report.ts`, `src/cli/sweep.ts`
- Create: `docs/findings/2026-07-26-baseline.md`
- Test: `src/analysis/sweep.test.ts`

**Interfaces:**
- Consumes: `playGame`, `measure`, `makeConfig`.
- Produces:
  - `interface SweepCell { label: string; overrides: Partial<GameConfig>; games: number }`
  - `interface SweepResult { label: string; games: number; villainWinRate: number; caughtRate: number; survivedRate: number; neverForcedRate: number; medianForcedNight: number | null; meanHidingSpace: number; trailAccuracy: number; callsPostedPerGame: number; callsLivePerGame: number; meanItemHolders: number; encounterRate: number }`
  - `runSweep(cells: SweepCell[], seedBase?: number): SweepResult[]`
  - `formatTable(results: SweepResult[]): string`
  - `BASELINE_CELLS: SweepCell[]`

- [ ] **Step 1: Write the failing test**

`src/analysis/sweep.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runSweep, BASELINE_CELLS } from './sweep.js';
import { formatTable } from './report.js';

describe('runSweep', () => {
  it('returns one result per cell', () => {
    const cells = [
      { label: 'a', overrides: {}, games: 20 },
      { label: 'b', overrides: { trailRadius: 2 }, games: 20 },
    ];
    const r = runSweep(cells, 1);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.label)).toEqual(['a', 'b']);
    expect(r[0]!.games).toBe(20);
  });

  it('reports rates that sum to one across the three outcomes', () => {
    const [r] = runSweep([{ label: 'x', overrides: {}, games: 60 }], 5);
    expect(r!.caughtRate + r!.survivedRate + r!.villainWinRate).toBeCloseTo(1, 6);
  });

  it('is deterministic for the same seed base', () => {
    const cell = [{ label: 'x', overrides: {}, games: 40 }];
    expect(JSON.stringify(runSweep(cell, 9))).toBe(JSON.stringify(runSweep(cell, 9)));
  });

  it('ships a baseline matrix that covers the open questions', () => {
    const labels = BASELINE_CELLS.map((c) => c.label);
    expect(labels).toContain('baseline');
    expect(labels.some((l) => l.includes('hush'))).toBe(true);
    expect(labels.some((l) => l.includes('marking'))).toBe(true);
    expect(labels.some((l) => l.includes('trail'))).toBe(true);
  });
});

describe('formatTable', () => {
  it('renders a header and one row per result', () => {
    const out = formatTable(runSweep([
      { label: 'a', overrides: {}, games: 10 },
      { label: 'b', overrides: {}, games: 10 },
    ], 2));
    const lines = out.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(out).toContain('trailAcc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/analysis/sweep.test.ts`
Expected: FAIL — cannot resolve `./sweep.js`.

- [ ] **Step 3: Write the sweep runner**

`src/analysis/sweep.ts`:
```ts
import type { GameConfig } from '../rules/config.js';
import { makeConfig, ROSTER } from '../rules/config.js';
import { playGame } from '../rules/game.js';
import { heuristicBot } from '../bots/heuristic.js';
import { measure, type GameMetrics } from './metrics.js';

export interface SweepCell {
  label: string;
  overrides: Partial<GameConfig>;
  games: number;
}

export interface SweepResult {
  label: string;
  games: number;
  villainWinRate: number;
  caughtRate: number;
  survivedRate: number;
  neverForcedRate: number;
  medianForcedNight: number | null;
  meanHidingSpace: number;
  trailAccuracy: number;
  callsPostedPerGame: number;
  callsLivePerGame: number;
  meanItemHolders: number;
  encounterRate: number;
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export function runSweep(cells: readonly SweepCell[], seedBase = 0): SweepResult[] {
  const bots = Object.fromEntries(ROSTER.map((p) => [p, heuristicBot]));

  return cells.map((cell) => {
    const config = makeConfig(cell.overrides);
    const all: GameMetrics[] = [];
    for (let i = 0; i < cell.games; i++) {
      all.push(measure(playGame(config, seedBase + i, bots)));
    }

    const namings = all.reduce((n, m) => n + m.trailNamings, 0);
    const hits = all.reduce((n, m) => n + m.trailHits, 0);
    const forced = all.map((m) => m.forcedNight).filter((n): n is number => n !== null);

    return {
      label: cell.label,
      games: cell.games,
      villainWinRate: all.filter((m) => m.winner === 'oddsocks').length / cell.games,
      caughtRate: all.filter((m) => m.how === 'caught').length / cell.games,
      survivedRate: all.filter((m) => m.how === 'survived').length / cell.games,
      neverForcedRate: all.filter((m) => m.forcedNight === null).length / cell.games,
      medianForcedNight: median(forced),
      meanHidingSpace: mean(all.flatMap((m) => m.hidingSpace)),
      trailAccuracy: namings > 0 ? hits / namings : 0,
      callsPostedPerGame: mean(all.map((m) => m.callsPosted)),
      callsLivePerGame: mean(all.map((m) => m.callsLive)),
      meanItemHolders: mean(all.map((m) => m.meanItemHolders)),
      encounterRate: mean(all.map((m) => m.encounterRate)),
    };
  });
}

const N = 2000;

/** The matrix that answers the spec's six open questions. */
export const BASELINE_CELLS: SweepCell[] = [
  { label: 'baseline', overrides: {}, games: N },

  // Rung 1: does the core night loop work without items or oddities?
  { label: 'core-only', games: N,
    overrides: { layers: { items: false, oddities: false, marking: false } } },
  { label: 'core+items', games: N,
    overrides: { layers: { items: true, oddities: false, marking: false } } },

  // The Hush question — the one that could change the design.
  { label: 'hush-oneNight', overrides: { hushMode: 'oneNight' }, games: N },
  { label: 'hush-none', overrides: { hushMode: 'none' }, games: N },
  { label: 'hush-silent-freeSnuff',
    overrides: { hushMode: 'silent', selfSnuffCostsNight: false }, games: N },

  // Is marking dominant now that a Call needs only two hands?
  { label: 'marking-off', games: N,
    overrides: { layers: { items: true, oddities: true, marking: false } } },

  // Trail signal.
  { label: 'trail-radius-0', overrides: { trailRadius: 0 }, games: N },
  { label: 'trail-radius-2', overrides: { trailRadius: 2 }, games: N },

  // Can a Call ever assemble?
  { label: 'call-hands-3', overrides: { callHandsRequired: 3 }, games: N },
  { label: 'items-on-map-2', overrides: { itemsOnMap: 2 }, games: N },
  { label: 'items-on-map-4', overrides: { itemsOnMap: 4 }, games: N },
];
```

- [ ] **Step 4: Write the report formatter and the CLI**

`src/analysis/report.ts`:
```ts
import type { SweepResult } from './sweep.js';

const COLUMNS: { key: keyof SweepResult; head: string; width: number }[] = [
  { key: 'label', head: 'config', width: 24 },
  { key: 'villainWinRate', head: 'villain', width: 8 },
  { key: 'caughtRate', head: 'caught', width: 8 },
  { key: 'survivedRate', head: 'survived', width: 9 },
  { key: 'neverForcedRate', head: 'neverFrc', width: 9 },
  { key: 'medianForcedNight', head: 'medFrc', width: 7 },
  { key: 'meanHidingSpace', head: 'hiding', width: 7 },
  { key: 'trailAccuracy', head: 'trailAcc', width: 9 },
  { key: 'callsPostedPerGame', head: 'posted', width: 7 },
  { key: 'callsLivePerGame', head: 'live', width: 6 },
  { key: 'meanItemHolders', head: 'holders', width: 8 },
  { key: 'encounterRate', head: 'encntr', width: 7 },
];

const cell = (value: unknown, width: number): string => {
  const text = value === null ? '—'
    : typeof value === 'number' ? (Number.isInteger(value) ? String(value) : value.toFixed(3))
    : String(value);
  return text.padEnd(width).slice(0, width);
};

export function formatTable(results: readonly SweepResult[]): string {
  const head = COLUMNS.map((c) => c.head.padEnd(c.width)).join(' ');
  const rule = COLUMNS.map((c) => '─'.repeat(c.width)).join(' ');
  const rows = results.map((r) => COLUMNS.map((c) => cell(r[c.key], c.width)).join(' '));
  return [head, rule, ...rows].join('\n') + '\n';
}
```

`src/cli/sweep.ts`:
```ts
import { runSweep, BASELINE_CELLS } from '../analysis/sweep.js';
import { formatTable } from '../analysis/report.js';

const started = Date.now();
const results = runSweep(BASELINE_CELLS, 0);
process.stdout.write(formatTable(results));
process.stdout.write(`\n${BASELINE_CELLS.length} configs in ${Date.now() - started}ms\n`);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: PASS across every suite.

- [ ] **Step 6: Run the baseline sweep and write down what it says**

Run: `npm run sweep`

Create `docs/findings/2026-07-26-baseline.md` with the table pasted verbatim, then answer each of
the spec's six questions in one or two sentences with the number that settles it:

1. Can Odd Socks always find a safe lie? → `neverForcedRate` and `medianForcedNight`.
2. Does the trail identify anyone? → `trailAcc` against the 1/6 you would get by guessing.
3. Can a Call ever assemble two hands? → `live` versus `posted`, and `holders`.
4. Does dodging cost the villain the game? → `villain` in `baseline` versus `call-hands-3`.
5. Does marking dominate? → `baseline` versus `marking-off`.
6. What are the side win rates, and by which route? → `villain` / `caught` / `survived`.

Then state which layers earned their place, comparing `core-only`, `core+items` and `baseline`. Any
layer that moves no metric is a candidate for the complexity cut before humans ever see it.

Flag explicitly, in the document, that **`encntr` is bot-dependent and should not be trusted** —
heuristic bots do not cluster, follow or camp the way people do.

- [ ] **Step 7: Commit**

```bash
git add src/analysis/sweep.ts src/analysis/report.ts src/analysis/sweep.test.ts src/cli/sweep.ts docs/findings/2026-07-26-baseline.md
git commit -m "feat: config sweep runner, report table, and baseline findings"
```

---

## After the plan

The engine is done when the baseline findings document exists and every suite is green. What
happens next depends on what the numbers say, and that decision belongs to a fresh conversation
with the findings in hand — not to this plan.

The two most likely outcomes, both of which are useful:

- **The villain is never forced into a contradiction.** Then the evidence engine needs another
  people-fact source before any human plays, and the trail alone is not enough.
- **Calls never assemble.** Then §12 Q2 has come back "no", and the Call needs either a cheaper
  join cost or more items in circulation.

The hotseat build described in the spec's §10 comes after this, not alongside it.

