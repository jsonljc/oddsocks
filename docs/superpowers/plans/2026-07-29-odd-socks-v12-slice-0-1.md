# ODD SOCKS v12 — Slices 0–1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a solo-playable haunted house at night, plus a house report and claim board driven by a hand-authored match log — everything one person can evaluate without a second human.

**Architecture:** A deterministic, headless, fixed-timestep simulation in `core/` that knows nothing about rendering, audio or networking, emitting a typed event stream. Two pure functions read that stream: an identity-stripped projection feeding the house report, and a claim board. PixiJS renders the simulation but decides nothing. This shape exists so slice 2b's authoritative server can run the same core unchanged.

**Tech Stack:** TypeScript 5.6 (strict), Vite 6, PixiJS 8, Vitest 2, Node 20+.

**Spec:** `docs/superpowers/specs/2026-07-29-odd-socks-v12-prototype-design.md`
**Rules:** `docs/rules-v12.2.md` — **authoritative.**

> ## ⚠️ Rules changed mid-execution, 2026-07-30. Read this before any task.
>
> Tasks 1 and 2 were built against **v12.0**, which is superseded twice over: by `rules-v12.1.md`
> (a full rewrite — 16 sections, not 32, entirely different numbering) and then by
> `rules-v12.2.md` (v12.1 plus three measured corrections). **Every `§` reference in this plan
> below this notice that is not marked `v12.2 §` is a v12.0 reference and may be stale.** The
> tasks that needed changing have been revised in place and say so.
>
> What this cost: **Task 2's house is superseded.** It built a 10-room ring with two exits
> everywhere, which is precisely the defect v12.1 §15 names — *"'No more than two doors' secretly
> meant the whole house was a straight line or a loop, with no branching anywhere."* **Task 2R
> replaces it.** `geometry.ts` and `house.ts` from Task 2 survive unchanged; only the house data
> and the exit ceiling move.
>
> **§14's crowd rule is known broken and parked** — the economy pass measured it as a *villain*
> ability. Nothing in slices 0–1 depends on it: slice 0 has no flames, and slice 1 reads them from
> a hand-authored log. Do not implement a flame cost for crowding. Do render the report line.

## Global Constraints

Every task's requirements implicitly include this section.

- **Determinism is required from the first tick.** Fixed timestep of exactly `1/30` s. No `Math.random()`, no `Date.now()`, no wall-clock reads anywhere in `core/` or `log/`. Same seed plus same input sequence must produce a byte-identical event stream. Retrofitting this is expensive and slice 2b's server depends on it.
- **Layer boundary.** `core/` and `log/` must not import from `render/`, `audio/`, `app/` or `scripted/`. Enforced by a test, not by review. `core/ ↔ log/` is permitted.
- **No room has more than three doors**, counting doorways and stairs (**v12.2 §3**). Inverted from v12.0's two-exit rule, which forced the whole house into a line or a loop and deleted the point of hidden movement. The Bind now constrains itself instead: **v12.2 §11** allows it *"only in a room with exactly two doors"* — so the house must always contain one, including after rooms start sealing on Night Four (**v12.2 §13**). `validateHouse` owns that invariant.
- **A sock created mid-night must be findable and deliverable inside the same ninety seconds** (**v12.2 §6**, retrieval latency pinned to zero). No sock mechanics exist in slices 0–1, but nothing built here may make same-night delivery impossible — it is the difference between 0 and 227 villain lines that deny the children an accusation.
- **`houseReport` must be structurally unable to see player identities**, except the one field rules §13.1 grants it: which children did not return. Enforced by the projection's type, not by discipline.
- **The scripted stalker never produces a number.** No metrics, no counters, no win-rate API. It is set dressing for solo feel-testing (spec §9.1).
- **No economy simulator** for rules §32 Q2/Q3/Q4 (spec §9.2). Out of scope entirely.
- TypeScript `strict: true`. All new code has tests unless explicitly noted as unverifiable-without-a-human.
- Work on branch `v12`. Commit at the end of every task. **Every commit message ends with the repo's trailer**, which the per-task `git commit` commands below omit for brevity:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

## File Structure

```
v12/
  package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html
  src/
    core/
      rng.ts         seeded deterministic RNG
      geometry.ts    Vec2/Rect, containment, door-span crossing
      house.ts       House/Room/Door types, lookups, validation
      light.ts       ambient by night, light at a point, visibility
      events.ts      MatchEvent union — what core emits
      movement.ts    per-tick integration + room transfer
      lantern.ts     carry/place/snuff/relight state machine
      take.ts        rules §12.1 conditions, warning, completion
      sim.ts         the tick loop; owns state; drains events
    house/hollow.ts  the eight-room house, as data
    log/
      project.ts     identity-stripping projection
      report.ts      renders rules §13.1
      board.ts       claim board + contradiction detection
      fixture.ts     hand-authored six-night match log
    render/
      stage.ts       Pixi app, camera
      rooms.ts       rooms, doors, furniture
      lighting.ts    light mask geometry + draw
      actors.ts      children, silhouettes, nametags
    audio/sounds.ts  event → sound mapping
    scripted/stalker.ts
    app/
      input.ts, main.ts
      scenes/night.ts, scenes/morning.ts
  test/
```

---

## Task 0: The tester track (no code, runs in parallel)

**This is the only work in this plan that can move the constraint in spec §2.** Start it on day one and let it run alongside every other task. It has no test cycle.

**Files:**
- Create: `docs/findings/2026-07-29-tester-track.md`

- [ ] **Step 1: Write the tracking document**

Create `docs/findings/2026-07-29-tester-track.md` with three sections: `## Channels contacted` (date, channel, what was posted, response), `## Committed testers` (name/handle, tier they satisfy), `## Gate status`.

- [ ] **Step 2: Contact channels**

Post in playtest-swap Discords, r/playmygame, r/IndieDev playtest threads, and any personal group chat. Record each in the document.

- [ ] **Step 3: Record gate status**

Gate A is met at **2–3 humans confirmed for a scheduled session, twice**. Gate B at **6**. Write the current status plainly, including "not met" if that is the truth.

- [ ] **Step 4: Commit**

```bash
git add docs/findings/2026-07-29-tester-track.md
git commit -m "docs: open the tester track, the only work that moves the constraint"
```

---

## Task 1: Scaffold and deterministic RNG

**Files:**
- Create: `v12/package.json`, `v12/tsconfig.json`, `v12/vite.config.ts`, `v12/vitest.config.ts`, `v12/index.html`
- Create: `v12/src/core/rng.ts`
- Test: `v12/test/rng.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `makeRng(seed: number): Rng` where `interface Rng { (): number; int(maxExclusive: number): number; pick<T>(xs: readonly T[]): T }`

- [ ] **Step 1: Create the project scaffold**

`v12/package.json`:

```json
{
  "name": "odd-socks-v12",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit && vitest run"
  },
  "dependencies": { "pixi.js": "^8.6.0" },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

`v12/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src", "test"]
}
```

`v12/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { globals: true, environment: 'node' } });
```

`v12/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
export default defineConfig({ server: { open: true } });
```

`v12/index.html`:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>The Odd Socks</title>
    <style>html,body{margin:0;height:100%;background:#0b0a10;overflow:hidden}</style>
  </head>
  <body><script type="module" src="/src/app/main.ts"></script></body>
</html>
```

Then run `cd v12 && npm install`.

- [ ] **Step 2: Write the failing test**

`v12/test/rng.test.ts`:

```ts
import { makeRng } from '../src/core/rng';

describe('makeRng', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = makeRng(1234), b = makeRng(1234);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = makeRng(1234), b = makeRng(1235);
    expect(Array.from({ length: 50 }, () => a()))
      .not.toEqual(Array.from({ length: 50 }, () => b()));
  });

  it('stays in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() stays in range and pick() is stable per seed', () => {
    expect(makeRng(9).int(5)).toBe(makeRng(9).int(5));
    const xs = ['a', 'b', 'c'] as const;
    expect(makeRng(3).pick(xs)).toBe(makeRng(3).pick(xs));
    for (let i = 0; i < 200; i++) {
      const v = makeRng(i).int(4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/rng.test.ts`
Expected: FAIL — cannot resolve `../src/core/rng`.

- [ ] **Step 4: Implement**

`v12/src/core/rng.ts`:

```ts
export interface Rng {
  (): number;
  int(maxExclusive: number): number;
  pick<T>(xs: readonly T[]): T;
}

/** mulberry32. Chosen because it is 4 lines, has no state we must serialise
 *  beyond one uint32, and is reproducible across engines — all three matter
 *  when slice 2b's server has to replay a client's stream. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  rng.pick = <T,>(xs: readonly T[]): T => {
    const v = xs[rng.int(xs.length)];
    if (v === undefined) throw new Error('pick() on an empty array');
    return v;
  };
  return rng;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS, 4 tests. `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add v12/
git commit -m "feat(v12): scaffold the client and pin determinism at the RNG"
```

---

## Task 2: Geometry, the house, and the two structural guards

> ### ⛔ PARTLY SUPERSEDED — build Task 2R instead of this task's Steps 2, 5 (house data) and 6
>
> **Done and kept:** `src/core/geometry.ts`, `src/core/house.ts`'s lookups, and
> `test/boundaries.test.ts`. Those stand and need no rework.
>
> **Superseded:** the `HOLLOW` data below and the two-exit ceiling. It was built against v12.0.
> v12.1 §15 names that ceiling as a defect, and this task's own test caught a second problem in
> the data as originally written (`library` and `playroom` had three exits each). **The door
> IDs in the code block below no longer exist.** Do not copy them.
>
> Read **Task 2R** for the house that ships.

**Files:**
- Create: `v12/src/core/geometry.ts`, `v12/src/core/house.ts`, `v12/src/house/hollow.ts`
- Test: `v12/test/geometry.test.ts`, `v12/test/house.test.ts`, `v12/test/boundaries.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface Vec2 { x: number; y: number }`, `interface Rect { x: number; y: number; w: number; h: number }`
  - `clampInside(p: Vec2, radius: number, r: Rect): Vec2`
  - `pointInRect(p: Vec2, r: Rect): boolean`
  - `type RoomId = string`, `type DoorId = string`
  - `interface Door { id: DoorId; a: RoomId; b: RoomId; at: Vec2; span: number; kind: 'doorway' | 'stair' }`
  - `interface Room { id: RoomId; name: string; floor: number; bounds: Rect; centralObject: string }`
  - `interface House { rooms: Room[]; doors: Door[] }`
  - `roomById(h: House, id: RoomId): Room`, `exitsOf(h: House, id: RoomId): Door[]`
  - `validateHouse(h: House): string[]` — returns violations, empty when sound
  - `HOLLOW: House`

- [ ] **Step 1: Write the failing geometry test**

`v12/test/geometry.test.ts`:

```ts
import { clampInside, pointInRect } from '../src/core/geometry';

const room = { x: 0, y: 0, w: 100, h: 80 };

describe('clampInside', () => {
  it('leaves an interior point untouched', () => {
    expect(clampInside({ x: 50, y: 40 }, 5, room)).toEqual({ x: 50, y: 40 });
  });

  it('pulls a point back inside by the radius on each axis', () => {
    expect(clampInside({ x: -20, y: 40 }, 5, room)).toEqual({ x: 5, y: 40 });
    expect(clampInside({ x: 200, y: 40 }, 5, room)).toEqual({ x: 95, y: 40 });
    expect(clampInside({ x: 50, y: -3 }, 5, room)).toEqual({ x: 50, y: 5 });
    expect(clampInside({ x: 50, y: 999 }, 5, room)).toEqual({ x: 50, y: 75 });
  });
});

describe('pointInRect', () => {
  it('is inclusive of the boundary', () => {
    expect(pointInRect({ x: 0, y: 0 }, room)).toBe(true);
    expect(pointInRect({ x: 100, y: 80 }, room)).toBe(true);
    expect(pointInRect({ x: 101, y: 40 }, room)).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing house test**

`v12/test/house.test.ts`:

```ts
import { validateHouse, exitsOf, roomById } from '../src/core/house';
import { HOLLOW } from '../src/house/hollow';

describe('HOLLOW', () => {
  it('has ten rooms: eight active plus the Shared Bedroom and the Hearth Room', () => {
    expect(HOLLOW.rooms).toHaveLength(10);
    expect(HOLLOW.rooms.map(r => r.id)).toContain('shared_bedroom');
    expect(HOLLOW.rooms.map(r => r.id)).toContain('hearth');
  });

  it('spans exactly two floors', () => {
    expect(new Set(HOLLOW.rooms.map(r => r.floor))).toEqual(new Set([0, 1]));
  });

  it('has exactly two stair connections', () => {
    expect(HOLLOW.doors.filter(d => d.kind === 'stair')).toHaveLength(2);
  });

  // rules §6.1 — a hard constraint, because §16.3's Bind requires sealing every exit
  it('gives no room more than two exits', () => {
    for (const room of HOLLOW.rooms) {
      expect(exitsOf(HOLLOW, room.id).length).toBeLessThanOrEqual(2);
    }
  });

  it('is fully connected — every room reachable from the Shared Bedroom', () => {
    const seen = new Set<string>(['shared_bedroom']);
    const queue = ['shared_bedroom'];
    while (queue.length) {
      const id = queue.shift()!;
      for (const d of exitsOf(HOLLOW, id)) {
        const other = d.a === id ? d.b : d.a;
        if (!seen.has(other)) { seen.add(other); queue.push(other); }
      }
    }
    expect(seen.size).toBe(HOLLOW.rooms.length);
  });

  it('validates clean', () => {
    expect(validateHouse(HOLLOW)).toEqual([]);
  });

  it('reports a violation when a room is given a third exit', () => {
    const broken = {
      ...HOLLOW,
      doors: [...HOLLOW.doors,
        { id: 'x1', a: 'nursery', b: 'attic', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
        { id: 'x2', a: 'nursery', b: 'cellar', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const }],
    };
    expect(validateHouse(broken).join(' ')).toMatch(/nursery.*exits/i);
  });

  it('roomById throws on an unknown id rather than returning undefined', () => {
    expect(() => roomById(HOLLOW, 'no_such_room')).toThrow();
  });
});
```

- [ ] **Step 3: Write the failing layer-boundary test**

This is the structural guard from Global Constraints. `v12/test/boundaries.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package is "type": "module", so __dirname does not exist. Derive it.
const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? filesUnder(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const FORBIDDEN = ['render', 'audio', 'app', 'scripted'];

describe('layer boundaries', () => {
  // core/ and log/ run on the server in slice 2b. If a browser import ever
  // reaches them the authoritative model stops being portable, silently.
  it.each(['src/core', 'src/log', 'src/house'])('%s imports no browser layer', dir => {
    for (const file of filesUnder(join(TEST_DIR, '..', dir))) {
      const src = readFileSync(file, 'utf8');
      for (const layer of FORBIDDEN) {
        expect(src).not.toMatch(new RegExp(`from ['"][^'"]*${layer}/`));
      }
    }
  });

  it.each(['src/core', 'src/log'])('%s reads no wall clock and no global random', dir => {
    for (const file of filesUnder(join(TEST_DIR, '..', dir))) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/Math\.random\(/);
      expect(src).not.toMatch(/Date\.now\(|performance\.now\(/);
    }
  });
});
```

Note `src/log` and `src/house` will not exist yet — create empty `src/log/.gitkeep` is not enough for `filesUnder`, so create `src/log/index.ts` containing `export {};` in step 5 to keep the test honest from the start.

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd v12 && npx vitest run`
Expected: FAIL — modules unresolved.

- [ ] **Step 5: Implement**

`v12/src/core/geometry.ts`:

```ts
export interface Vec2 { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** Keep a circle of `radius` inside `r`. Rooms are boxes you are inside of,
 *  so containment is the operation — not the usual push-out-of-an-obstacle. */
export function clampInside(p: Vec2, radius: number, r: Rect): Vec2 {
  return {
    x: Math.min(Math.max(p.x, r.x + radius), r.x + r.w - radius),
    y: Math.min(Math.max(p.y, r.y + radius), r.y + r.h - radius),
  };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
```

`v12/src/core/house.ts`:

```ts
import type { Rect, Vec2 } from './geometry';

export type RoomId = string;
export type DoorId = string;

export interface Room {
  id: RoomId; name: string; floor: number; bounds: Rect; centralObject: string;
}
export interface Door {
  id: DoorId; a: RoomId; b: RoomId; at: Vec2; span: number;
  kind: 'doorway' | 'stair';
}
export interface House { rooms: Room[]; doors: Door[] }

export function roomById(h: House, id: RoomId): Room {
  const r = h.rooms.find(x => x.id === id);
  if (!r) throw new Error(`unknown room: ${id}`);
  return r;
}

export function exitsOf(h: House, id: RoomId): Door[] {
  return h.doors.filter(d => d.a === id || d.b === id);
}

export function otherSide(d: Door, from: RoomId): RoomId {
  return d.a === from ? d.b : d.a;
}

/** rules §6.1 is a hard constraint, not a preference: §16.3's Bind requires
 *  sealing every exit, so a three-exit room would be untrappable. */
export function validateHouse(h: House): string[] {
  const problems: string[] = [];
  for (const room of h.rooms) {
    const n = exitsOf(h, room.id).length;
    if (n > 2) problems.push(`room ${room.id} has ${n} exits, maximum is 2 (rules §6.1)`);
    if (n === 0) problems.push(`room ${room.id} has no exits`);
  }
  for (const d of h.doors) {
    if (!h.rooms.some(r => r.id === d.a)) problems.push(`door ${d.id} references unknown room ${d.a}`);
    if (!h.rooms.some(r => r.id === d.b)) problems.push(`door ${d.id} references unknown room ${d.b}`);
  }
  return problems;
}
```

`v12/src/house/hollow.ts` — ten rooms across two floors, each with at most two exits, laid out as a chain with the Shared Bedroom and Hearth on the ground floor:

```ts
import type { House } from '../core/house';

const W = 260, H = 200, GAP = 40;
const cell = (col: number, row: number) =>
  ({ x: col * (W + GAP), y: row * (H + GAP), w: W, h: H });

/** Floor 0: bedroom — hearth — kitchen — library — cellar
 *  Floor 1: nursery — music_room — playroom — bathroom — attic
 *  Stairs join library↔playroom and cellar↔attic, giving a loop with no
 *  room exceeding two exits. */
export const HOLLOW: House = {
  rooms: [
    { id: 'shared_bedroom', name: 'Shared Bedroom', floor: 0, bounds: cell(0, 1), centralObject: 'six beds' },
    { id: 'hearth',         name: 'Hearth Room',    floor: 0, bounds: cell(1, 1), centralObject: 'the five flames' },
    { id: 'kitchen',        name: 'Kitchen',        floor: 0, bounds: cell(2, 1), centralObject: 'a long table' },
    { id: 'library',        name: 'Library',        floor: 0, bounds: cell(3, 1), centralObject: 'a reading chair' },
    { id: 'cellar',         name: 'Cellar',         floor: 0, bounds: cell(4, 1), centralObject: 'a coal chute' },
    { id: 'nursery',        name: 'Nursery',        floor: 1, bounds: cell(0, 0), centralObject: 'a rocking horse' },
    { id: 'music_room',     name: 'Music Room',     floor: 1, bounds: cell(1, 0), centralObject: 'an upright piano' },
    { id: 'playroom',       name: 'Playroom',       floor: 1, bounds: cell(2, 0), centralObject: 'a toy chest' },
    { id: 'bathroom',       name: 'Bathroom',       floor: 1, bounds: cell(3, 0), centralObject: 'a claw-foot bath' },
    { id: 'attic',          name: 'Attic',          floor: 1, bounds: cell(4, 0), centralObject: 'a dust-sheeted mirror' },
  ],
  doors: [
    { id: 'd_bed_hearth',  a: 'shared_bedroom', b: 'hearth',      at: { x: 1 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_hearth_kitchen',  a: 'hearth',         b: 'kitchen',     at: { x: 2 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_hearth_kitchen',     a: 'kitchen',        b: 'library',     at: { x: 3 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_cellar_library',  a: 'library',        b: 'cellar',      at: { x: 4 * (W + GAP) - GAP / 2, y: 1 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_nursery_music',   a: 'nursery',        b: 'music_room',  at: { x: 1 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_music_playroom',  a: 'music_room',     b: 'playroom',    at: { x: 2 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_play_bath',   a: 'playroom',       b: 'bathroom',    at: { x: 3 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 'd_attic_playroom',  a: 'bathroom',       b: 'attic',       at: { x: 4 * (W + GAP) - GAP / 2, y: 0 * (H + GAP) + H / 2 }, span: 60, kind: 'doorway' },
    { id: 's_lib_play',    a: 'library',        b: 'playroom',    at: { x: 3 * (W + GAP) + W / 2,   y: 1 * (H + GAP) - GAP / 2 }, span: 60, kind: 'stair' },
    { id: 's_cellar_attic',a: 'cellar',         b: 'attic',       at: { x: 4 * (W + GAP) + W / 2,   y: 1 * (H + GAP) - GAP / 2 }, span: 60, kind: 'stair' },
  ],
};
```

Also create `v12/src/log/index.ts` containing `export {};` so the boundary test has a directory to scan from the start.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS. If the exit-count test fails, the house data is wrong — fix the data, never the constraint.

- [ ] **Step 7: Commit**

```bash
git add v12/
git commit -m "feat(v12): the house, with §6.1's two-exit rule enforced by test"
```

---

## Task 2R: Rebuild the house for v12.2

**Supersedes Task 2's house data and exit ceiling.** `src/core/geometry.ts` and `src/core/house.ts`'s
lookups from Task 2 survive unchanged — only `validateHouse`'s rules and `src/house/hollow.ts` move.

Task 2 built a 10-room ring with two doors everywhere. v12.1 §15 names that as a defect: *"'No more
than two doors' secretly meant the whole house was a straight line or a loop, with no branching
anywhere. That deletes the point of hidden movement."*

**Files:**
- Modify: `v12/src/core/house.ts` (House type gains `sealOrder`; `validateHouse` rewritten)
- Replace: `v12/src/house/hollow.ts`
- Modify: `v12/test/house.test.ts`

**Interfaces:**
- Consumes: `Rect`, `Vec2` from `core/geometry`
- Produces (changed): `interface House { rooms: Room[]; doors: Door[]; sealOrder: RoomId[] }`,
  `MAX_DOORS = 3`, `BIND_DOORS = 2`, `doorCount(h, id): number`, `bindEligible(h): Room[]`,
  `houseAfterSealing(h, count): House`, `validateHouse(h): string[]`
- Unchanged: `roomById`, `exitsOf`, `otherSide`, `Room`, `Door`

### The four invariants `validateHouse` must own

The third and fourth are new and are the reason this task exists as more than a data swap.

1. **No room exceeds three doors** (v12.2 §3).
2. **No room has zero doors**, and the house is connected.
3. **At least one two-door room exists** — v12.2 §11 allows the Bind *"only in a room with exactly
   two doors."* A house with none is unwinnable for the children.
4. **Invariant 3 survives sealing.** v12.2 §13 starts closing peripheral rooms on **Night Four**,
   not just during the Last Night. So after each room in `sealOrder` closes, there must still be a
   two-door room, still no zero-door room, still a connected house, and the Hearth must never be in
   `sealOrder` (v12.2 §11: *"the fireplace room never seals"*).

- [ ] **Step 1: Write the failing test**

Replace `v12/test/house.test.ts` entirely:

```ts
import {
  validateHouse, exitsOf, roomById, doorCount, bindEligible,
  houseAfterSealing, MAX_DOORS, BIND_DOORS,
} from '../src/core/house';
import { HOLLOW } from '../src/house/hollow';

describe('HOLLOW shape', () => {
  // v12.2 §3 — ten rooms, plus the bedroom you start in and the fireplace room
  it('has twelve rooms: ten plus the Shared Bedroom and the Hearth', () => {
    expect(HOLLOW.rooms).toHaveLength(12);
    const ids = HOLLOW.rooms.map(r => r.id);
    expect(ids).toContain('shared_bedroom');
    expect(ids).toContain('hearth');
  });

  it('spans exactly two floors, six rooms each', () => {
    expect(HOLLOW.rooms.filter(r => r.floor === 0)).toHaveLength(6);
    expect(HOLLOW.rooms.filter(r => r.floor === 1)).toHaveLength(6);
  });

  it('joins the floors with stairs', () => {
    expect(HOLLOW.doors.filter(d => d.kind === 'stair').length).toBeGreaterThanOrEqual(2);
  });
});

describe('v12.2 §3 — the door ceiling', () => {
  it('gives no room more than three doors', () => {
    for (const room of HOLLOW.rooms) {
      expect(doorCount(HOLLOW, room.id), room.id).toBeLessThanOrEqual(MAX_DOORS);
    }
  });

  it('gives every room at least one door', () => {
    for (const room of HOLLOW.rooms) {
      expect(doorCount(HOLLOW, room.id), room.id).toBeGreaterThan(0);
    }
  });

  // This is the whole reason the ceiling moved from two to three. A house where
  // every room has two doors is a line or a loop, and hidden movement is pointless.
  it('actually branches — at least three rooms have three doors', () => {
    const hubs = HOLLOW.rooms.filter(r => doorCount(HOLLOW, r.id) === 3);
    expect(hubs.length).toBeGreaterThanOrEqual(3);
  });

  it('is not a single cycle — it has more doors than a ring of twelve would', () => {
    expect(HOLLOW.doors.length).toBeGreaterThan(HOLLOW.rooms.length);
  });
});

describe('v12.2 §11 — the Bind needs a two-door room', () => {
  it('has at least one', () => {
    expect(bindEligible(HOLLOW).length).toBeGreaterThan(0);
    for (const r of bindEligible(HOLLOW)) expect(doorCount(HOLLOW, r.id)).toBe(BIND_DOORS);
  });

  // v12.2 §13 seals peripheral rooms from Night Four. The children's only win
  // condition must not be sealed away by the house itself.
  it('still has one after every scheduled sealing', () => {
    for (let n = 0; n <= HOLLOW.sealOrder.length; n++) {
      expect(bindEligible(houseAfterSealing(HOLLOW, n)).length, `after ${n} seals`)
        .toBeGreaterThan(0);
    }
  });

  it('never seals the Hearth', () => {
    expect(HOLLOW.sealOrder).not.toContain('hearth');
  });

  it('leaves no room doorless and the house connected after every sealing', () => {
    for (let n = 0; n <= HOLLOW.sealOrder.length; n++) {
      const h = houseAfterSealing(HOLLOW, n);
      for (const room of h.rooms) {
        expect(doorCount(h, room.id), `${room.id} after ${n} seals`).toBeGreaterThan(0);
      }
      const seen = new Set([h.rooms[0]!.id]);
      const queue = [h.rooms[0]!.id];
      while (queue.length) {
        const id = queue.shift()!;
        for (const d of exitsOf(h, id)) {
          const other = d.a === id ? d.b : d.a;
          if (!seen.has(other)) { seen.add(other); queue.push(other); }
        }
      }
      expect(seen.size, `connected after ${n} seals`).toBe(h.rooms.length);
    }
  });
});

describe('validateHouse', () => {
  it('passes HOLLOW clean', () => {
    expect(validateHouse(HOLLOW)).toEqual([]);
  });

  it('rejects a fourth door on a room', () => {
    const broken = { ...HOLLOW, doors: [...HOLLOW.doors,
      { id: 'x1', a: 'nursery', b: 'cellar', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
      { id: 'x2', a: 'nursery', b: 'library', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const }] };
    expect(validateHouse(broken).join(' ')).toMatch(/nursery.*doors/i);
  });

  it('rejects a house with no two-door room', () => {
    const ring = {
      rooms: HOLLOW.rooms.slice(0, 3),
      doors: [
        { id: 'a', a: 'shared_bedroom', b: 'hearth', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
        { id: 'b', a: 'hearth', b: 'kitchen', at: { x: 0, y: 0 }, span: 20, kind: 'doorway' as const },
      ],
      sealOrder: [],
    };
    // bedroom=1, hearth=2, kitchen=1 -> hearth IS two-door, so this one passes that check.
    // Strip the hearth's second door to remove every two-door room:
    const noBind = { ...ring, doors: [ring.doors[0]!] };
    expect(validateHouse(noBind).join(' ')).toMatch(/two-door|Bind/i);
  });

  it('rejects sealing the Hearth', () => {
    expect(validateHouse({ ...HOLLOW, sealOrder: ['hearth'] }).join(' ')).toMatch(/hearth/i);
  });

  it('rejects a seal schedule that strands a room', () => {
    // Sealing every neighbour of the Attic would leave it doorless.
    const attic = exitsOf(HOLLOW, 'attic').map(d => (d.a === 'attic' ? d.b : d.a));
    expect(validateHouse({ ...HOLLOW, sealOrder: attic }).join(' ')).toMatch(/no doors|doorless/i);
  });

  it('roomById throws on an unknown id rather than returning undefined', () => {
    expect(() => roomById(HOLLOW, 'no_such_room')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/house.test.ts`
Expected: FAIL — `doorCount`, `bindEligible`, `houseAfterSealing`, `MAX_DOORS`, `BIND_DOORS` and `sealOrder` do not exist, and `HOLLOW` has ten rooms.

- [ ] **Step 3: Rewrite the house rules**

In `v12/src/core/house.ts`, add `sealOrder: RoomId[]` to `House`, and replace `validateHouse` with:

```ts
/** v12.2 §3 — a room may have up to three doors. v12.0's two-door ceiling forced
 *  the whole house into a line or a loop, which deletes the point of hidden
 *  movement (v12.1 §15). */
export const MAX_DOORS = 3;

/** v12.2 §11 — the Bind works "only in a room with exactly two doors". */
export const BIND_DOORS = 2;

export function doorCount(h: House, id: RoomId): number {
  return exitsOf(h, id).length;
}

export function bindEligible(h: House): Room[] {
  return h.rooms.filter(r => doorCount(h, r.id) === BIND_DOORS);
}

/** v12.2 §13 — peripheral rooms start closing on Night Four. Returns the house
 *  as it stands after the first `count` entries of `sealOrder` have closed. */
export function houseAfterSealing(h: House, count: number): House {
  const sealed = new Set(h.sealOrder.slice(0, count));
  return {
    rooms: h.rooms.filter(r => !sealed.has(r.id)),
    doors: h.doors.filter(d => !sealed.has(d.a) && !sealed.has(d.b)),
    sealOrder: h.sealOrder.slice(count),
  };
}

function connected(h: House): boolean {
  const first = h.rooms[0];
  if (!first) return true;
  const seen = new Set([first.id]);
  const queue = [first.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const d of exitsOf(h, id)) {
      const other = otherSide(d, id);
      if (!seen.has(other)) { seen.add(other); queue.push(other); }
    }
  }
  return seen.size === h.rooms.length;
}

export function validateHouse(h: House): string[] {
  const problems: string[] = [];

  for (const d of h.doors) {
    if (!h.rooms.some(r => r.id === d.a)) problems.push(`door ${d.id} references unknown room ${d.a}`);
    if (!h.rooms.some(r => r.id === d.b)) problems.push(`door ${d.id} references unknown room ${d.b}`);
  }
  if (h.sealOrder.includes('hearth')) {
    problems.push('sealOrder contains hearth — the fireplace room never seals (v12.2 §11)');
  }
  for (const id of h.sealOrder) {
    if (!h.rooms.some(r => r.id === id)) problems.push(`sealOrder references unknown room ${id}`);
  }

  // Check the ceiling, the floor, connectivity and Bind-eligibility at every
  // stage of the collapse — not just at the start. A house that is legal on
  // Night One and unwinnable on Night Six is the failure this guards.
  for (let n = 0; n <= h.sealOrder.length; n++) {
    const stage = houseAfterSealing(h, n);
    const when = n === 0 ? 'as built' : `after ${n} seal(s)`;
    for (const room of stage.rooms) {
      const count = doorCount(stage, room.id);
      if (count > MAX_DOORS) {
        problems.push(`room ${room.id} has ${count} doors ${when}, maximum is ${MAX_DOORS} (v12.2 §3)`);
      }
      if (count === 0) problems.push(`room ${room.id} has no doors ${when}`);
    }
    if (bindEligible(stage).length === 0) {
      problems.push(`no two-door room ${when} — the Bind would be impossible (v12.2 §11)`);
    }
    if (!connected(stage)) problems.push(`house is not connected ${when}`);
  }

  return problems;
}
```

- [ ] **Step 4: Replace the house**

Replace `v12/src/house/hollow.ts` entirely. Two 3×2 grids stacked so the floors touch, which is what lets a stair sit on a shared edge like any other door:

```ts
import type { House } from '../core/house';

const W = 260, H = 200, GAP = 40;

/** World rows 0–1 are the upper floor, 2–3 the ground floor. Stacking them so
 *  row 1 touches row 2 is what lets a stair sit on a shared edge and be walked
 *  through like any other door. */
const cell = (col: number, worldRow: number) =>
  ({ x: col * (W + GAP), y: worldRow * (H + GAP), w: W, h: H });

/** Door on the vertical edge between (col-1,row) and (col,row). */
const vEdge = (col: number, worldRow: number) =>
  ({ x: col * (W + GAP) - GAP / 2, y: worldRow * (H + GAP) + H / 2 });

/** Door on the horizontal edge between (col,row-1) and (col,row). */
const hEdge = (col: number, worldRow: number) =>
  ({ x: col * (W + GAP) + W / 2, y: worldRow * (H + GAP) - GAP / 2 });

/**
 *  Upper floor        Ground floor
 *  nursery music bath shared_bedroom hearth kitchen
 *  attic  play  study cellar        library conservatory
 *
 *  Branching, not a ring: hearth, library, playroom, music_room and the two
 *  stair-heads are three-door hubs, while nursery, bathroom, cellar and
 *  conservatory stay two-door and Bind-eligible.
 */
export const HOLLOW: House = {
  rooms: [
    { id: 'nursery',       name: 'Nursery',      floor: 1, bounds: cell(0, 0), centralObject: 'a rocking horse' },
    { id: 'music_room',    name: 'Music Room',   floor: 1, bounds: cell(1, 0), centralObject: 'an upright piano' },
    { id: 'bathroom',      name: 'Bathroom',     floor: 1, bounds: cell(2, 0), centralObject: 'a claw-foot bath' },
    { id: 'attic',         name: 'Attic',        floor: 1, bounds: cell(0, 1), centralObject: 'a dust-sheeted mirror' },
    { id: 'playroom',      name: 'Playroom',     floor: 1, bounds: cell(1, 1), centralObject: 'a toy chest' },
    { id: 'study',         name: 'Study',        floor: 1, bounds: cell(2, 1), centralObject: 'a writing desk' },
    { id: 'shared_bedroom',name: 'Shared Bedroom',floor: 0, bounds: cell(0, 2), centralObject: 'six beds' },
    { id: 'hearth',        name: 'Hearth Room',  floor: 0, bounds: cell(1, 2), centralObject: 'the five flames' },
    { id: 'kitchen',       name: 'Kitchen',      floor: 0, bounds: cell(2, 2), centralObject: 'a long table' },
    { id: 'cellar',        name: 'Cellar',       floor: 0, bounds: cell(0, 3), centralObject: 'a coal chute' },
    { id: 'library',       name: 'Library',      floor: 0, bounds: cell(1, 3), centralObject: 'a reading chair' },
    { id: 'conservatory',  name: 'Conservatory', floor: 0, bounds: cell(2, 3), centralObject: 'a dead fern' },
  ],
  doors: [
    // Upper floor
    { id: 'd_nursery_music',   a: 'nursery',    b: 'music_room',   at: vEdge(1, 0), span: 60, kind: 'doorway' },
    { id: 'd_music_bathroom',  a: 'music_room', b: 'bathroom',     at: vEdge(2, 0), span: 60, kind: 'doorway' },
    { id: 'd_attic_playroom',  a: 'attic',      b: 'playroom',     at: vEdge(1, 1), span: 60, kind: 'doorway' },
    { id: 'd_playroom_study',  a: 'playroom',   b: 'study',        at: vEdge(2, 1), span: 60, kind: 'doorway' },
    { id: 'd_nursery_attic',   a: 'nursery',    b: 'attic',        at: hEdge(0, 1), span: 60, kind: 'doorway' },
    { id: 'd_music_playroom',  a: 'music_room', b: 'playroom',     at: hEdge(1, 1), span: 60, kind: 'doorway' },
    { id: 'd_bathroom_study',  a: 'bathroom',   b: 'study',        at: hEdge(2, 1), span: 60, kind: 'doorway' },
    // Ground floor
    { id: 'd_bed_hearth',      a: 'shared_bedroom', b: 'hearth',       at: vEdge(1, 2), span: 60, kind: 'doorway' },
    { id: 'd_hearth_kitchen',  a: 'hearth',         b: 'kitchen',      at: vEdge(2, 2), span: 60, kind: 'doorway' },
    { id: 'd_cellar_library',  a: 'cellar',         b: 'library',      at: vEdge(1, 3), span: 60, kind: 'doorway' },
    { id: 'd_library_consv',   a: 'library',        b: 'conservatory', at: vEdge(2, 3), span: 60, kind: 'doorway' },
    { id: 'd_bed_cellar',      a: 'shared_bedroom', b: 'cellar',       at: hEdge(0, 3), span: 60, kind: 'doorway' },
    { id: 'd_hearth_library',  a: 'hearth',         b: 'library',      at: hEdge(1, 3), span: 60, kind: 'doorway' },
    { id: 'd_kitchen_consv',   a: 'kitchen',        b: 'conservatory', at: hEdge(2, 3), span: 60, kind: 'doorway' },
    // Stairs — on the shared edge between world rows 1 and 2
    { id: 's_attic_bedroom',   a: 'attic', b: 'shared_bedroom', at: hEdge(0, 2), span: 60, kind: 'stair' },
    { id: 's_study_kitchen',   a: 'study', b: 'kitchen',        at: hEdge(2, 2), span: 60, kind: 'stair' },
  ],
  /** v12.2 §13 — peripheral rooms close from Night Four. Chosen so that every
   *  stage keeps a two-door room, strands nobody, and never touches the Hearth. */
  sealOrder: ['bathroom', 'conservatory', 'nursery'],
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS. If a door-count assertion fails, **fix the house data, never the invariant** — the ceiling and the Bind-eligibility rule both come from the rules document.

- [ ] **Step 6: Commit**

```bash
git add v12/
git commit -m "feat(v12): rebuild the house for v12.2 — three doors, and branching

Task 2 built the ring v12.1 §15 names as a defect. Twelve rooms on two
3x2 grids, four three-door hubs, and validateHouse now owns the invariant
that a two-door Bind room survives every stage of the Night-Four collapse.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The event stream

**Files:**
- Create: `v12/src/core/events.ts`
- Test: `v12/test/events.test.ts`

**Interfaces:**
- Consumes: `RoomId`, `DoorId` from `core/house`
- Produces: `type ActorId = string`, `type LanternId = string`, `type SockId = string`, `type MatchEvent` (discriminated union on `kind`), `interface EventSink { emit(e: MatchEvent): void; drain(): MatchEvent[] }`, `makeSink(): EventSink`

Slice 0 emits a **provisional** stream; Task 11 pins the schema. Determinism is required from the first tick regardless.

- [ ] **Step 1: Write the failing test**

`v12/test/events.test.ts`:

```ts
import { makeSink, type MatchEvent } from '../src/core/events';

describe('EventSink', () => {
  it('drains in emission order and empties', () => {
    const sink = makeSink();
    sink.emit({ kind: 'move.enter', tick: 1, night: 1, actor: 'pike', room: 'kitchen', via: 'd_hearth_kitchen' });
    sink.emit({ kind: 'take.warn',  tick: 5, night: 2, actor: 'wren', victim: 'pike', room: 'kitchen' });
    const out = sink.drain();
    expect(out.map(e => e.kind)).toEqual(['move.enter', 'take.warn']);
    expect(sink.drain()).toEqual([]);
  });

  it('narrows on kind', () => {
    const e: MatchEvent = { kind: 'flame.out', tick: 9, night: 3, reason: 'take', remaining: 4 };
    if (e.kind === 'flame.out') expect(e.remaining).toBe(4);
    else throw new Error('narrowing failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/events.test.ts`
Expected: FAIL — cannot resolve `../src/core/events`.

- [ ] **Step 3: Implement**

`v12/src/core/events.ts`:

```ts
import type { DoorId, RoomId } from './house';

export type ActorId = string;
export type LanternId = string;
export type SockId = string;

/** v12.2 §2's flame list. `crowd` is named here but **not implemented anywhere in
 *  slices 0–1** — v12.2 §14 is parked as a known defect (the economy pass measured
 *  it as a villain ability). The log needs the reason so a hand-authored fixture can
 *  express it; no code may burn a flame for crowding. */
export type FlameReason = 'take' | 'snuff' | 'wrong-call' | 'crowd';
export type SoundKind = 'take' | 'snuff' | 'slip' | 'shed';

interface Base { tick: number; night: number }

export type MatchEvent =
  | (Base & { kind: 'move.enter'; actor: ActorId; room: RoomId; via: DoorId })
  | (Base & { kind: 'door.toggle'; actor: ActorId; door: DoorId; open: boolean })
  | (Base & { kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight';
              actor: ActorId; lantern: LanternId; room: RoomId; watching?: DoorId })
  | (Base & { kind: 'take.warn' | 'take.complete'; actor: ActorId; victim: ActorId; room: RoomId })
  | (Base & { kind: 'sock.spawn'; sock: SockId; room: RoomId; source: 'take' | 'snuff' | 'shed' })
  | (Base & { kind: 'sock.pickup' | 'sock.drop' | 'sock.secure';
              actor: ActorId; sock: SockId; room: RoomId })
  | (Base & { kind: 'flame.out'; reason: FlameReason; remaining: number })
  | (Base & { kind: 'sound'; floor: number; sound: SoundKind; room: RoomId })
  // rules §9 — "footsteps and movement remain perceptible" in deep darkness.
  // This is the channel that keeps a dark house navigable and populated, and
  // it is the only way one player learns another exists through a wall.
  | (Base & { kind: 'step'; actor: ActorId; room: RoomId; floor: number; hurried: boolean });

export interface EventSink { emit(e: MatchEvent): void; drain(): MatchEvent[] }

export function makeSink(): EventSink {
  let buffer: MatchEvent[] = [];
  return {
    emit(e) { buffer.push(e); },
    drain() { const out = buffer; buffer = []; return out; },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): the event stream core emits, provisional until slice 1"
```

---

## Task 4: The light model

**Files:**
- Create: `v12/src/core/light.ts`
- Test: `v12/test/light.test.ts`

**Interfaces:**
- Consumes: `Vec2`, `dist` from `core/geometry`; `House`, `RoomId` from `core/house`; `makeRng` from `core/rng`
- Produces:
  - `LIT_AMBIENT_BY_NIGHT`, `DARK_AMBIENT_BY_NIGHT`, `DARK_ROOM_COUNT_BY_NIGHT` (all `readonly number[]`), `ALWAYS_LIT: readonly RoomId[]`, `DARK_ENOUGH_FOR_TAKE`, `IDENTIFY_THRESHOLD`, `LANTERN_RADIUS`, `CARRIED_LANTERN_RADIUS`
  - `interface LightSource { room: RoomId; at: Vec2; radius: number }`
  - `darkRoomsFor(house: House, night: number, seed: number): Set<RoomId>`
  - `ambientFor(night: number, room: RoomId, dark: ReadonlySet<RoomId>): number`
  - `lightAt(night: number, room: RoomId, p: Vec2, sources: readonly LightSource[], dark: ReadonlySet<RoomId>): number`
  - `type Visibility = 'identified' | 'silhouette' | 'unseen'`
  - `visibilityAt(level: number): Visibility`

**Downstream note for later tasks:** `lightAt` takes a fifth argument. `Sim` (Task 5) owns the night's dark set and exposes it as `sim.darkRooms`; `canTake` (Task 7), `appearanceOf` (Task 10) and `drawLighting` (Task 9) all pass it through.

- [ ] **Step 1: Write the failing test**

`v12/test/light.test.ts`:

```ts
import {
  LIT_AMBIENT_BY_NIGHT, DARK_AMBIENT_BY_NIGHT, DARK_ROOM_COUNT_BY_NIGHT, ALWAYS_LIT,
  ambientFor, darkRoomsFor, lightAt, visibilityAt,
  DARK_ENOUGH_FOR_TAKE, IDENTIFY_THRESHOLD, LANTERN_RADIUS,
} from '../src/core/light';
import { HOLLOW } from '../src/house/hollow';

const SEED = 4242;
const dark = (night: number) => darkRoomsFor(HOLLOW, night, SEED);

describe('darkRoomsFor', () => {
  it('is deterministic for a seed and grows with the night', () => {
    expect([...dark(3)].sort()).toEqual([...darkRoomsFor(HOLLOW, 3, SEED)].sort());
    for (let n = 2; n <= 6; n++) {
      expect(dark(n).size, `night ${n}`).toBeGreaterThanOrEqual(dark(n - 1).size);
    }
  });

  // Nested, so the house is learnable rather than re-rolled every night.
  it('never re-lights a room that was dark the night before', () => {
    for (let n = 2; n <= 6; n++) {
      for (const room of dark(n - 1)) expect(dark(n).has(room), `${room} n${n}`).toBe(true);
    }
  });

  it('never darkens the Hearth — it is on fire', () => {
    for (let n = 1; n <= 6; n++) {
      for (const lit of ALWAYS_LIT) expect(dark(n).has(lit), `n${n}`).toBe(false);
    }
  });

  it('matches the scheduled count', () => {
    for (let n = 1; n <= 6; n++) {
      expect(dark(n).size, `night ${n}`).toBe(DARK_ROOM_COUNT_BY_NIGHT[n - 1]);
    }
  });

  it('varies between matches', () => {
    expect([...darkRoomsFor(HOLLOW, 3, 1)].sort())
      .not.toEqual([...darkRoomsFor(HOLLOW, 3, 2)].sort());
  });
});

// THE REGRESSION THAT MATTERS. The first version of this file used one global
// ambient per night, which made every room too bright to grab in on nights 2
// and 3 — so the game could not start until Night Four, against v12.2 §13,
// which bans the grab on Night One ONLY. These two tests pin that per night.
describe('the house is playable on every night it should be', () => {
  it('offers a grabbable room on every night from two onward', () => {
    for (let n = 2; n <= 6; n++) {
      const rooms = HOLLOW.rooms.filter(r => dark(n).has(r.id));
      expect(rooms.length, `night ${n} has no dark room`).toBeGreaterThan(0);
      const level = lightAt(n, rooms[0]!.id, { x: 0, y: 0 }, [], dark(n));
      expect(level, `night ${n} dark room is too bright to grab in`)
        .toBeLessThan(DARK_ENOUGH_FOR_TAKE);
    }
  });

  it('keeps at least one room where you can still see faces, every night', () => {
    for (let n = 1; n <= 6; n++) {
      const litRooms = HOLLOW.rooms.filter(r => !dark(n).has(r.id));
      expect(litRooms.length, `night ${n}`).toBeGreaterThan(0);
      const level = lightAt(n, litRooms[0]!.id, { x: 0, y: 0 }, [], dark(n));
      expect(level, `night ${n} lit room hides faces`).toBeGreaterThanOrEqual(IDENTIFY_THRESHOLD);
    }
  });
});

describe('ambientFor', () => {
  it('separates lit from dark, and both curves fall with the night', () => {
    for (let n = 2; n <= 6; n++) {
      expect(LIT_AMBIENT_BY_NIGHT[n - 1]!).toBeLessThanOrEqual(LIT_AMBIENT_BY_NIGHT[n - 2]!);
      expect(DARK_AMBIENT_BY_NIGHT[n - 1]!).toBeLessThanOrEqual(DARK_AMBIENT_BY_NIGHT[n - 2]!);
    }
    expect(Math.max(...DARK_AMBIENT_BY_NIGHT)).toBeLessThan(DARK_ENOUGH_FOR_TAKE);
    expect(Math.min(...LIT_AMBIENT_BY_NIGHT)).toBeGreaterThanOrEqual(IDENTIFY_THRESHOLD);
  });

  it('clamps out-of-range and fractional nights rather than returning undefined', () => {
    const none = new Set<string>();
    expect(ambientFor(0, 'kitchen', none)).toBe(LIT_AMBIENT_BY_NIGHT[0]);
    expect(ambientFor(99, 'kitchen', none)).toBe(LIT_AMBIENT_BY_NIGHT[5]);
    expect(Number.isFinite(ambientFor(2.5, 'kitchen', none))).toBe(true);
  });
});

describe('lightAt', () => {
  const lantern = { room: 'kitchen', at: { x: 100, y: 100 }, radius: LANTERN_RADIUS };
  const allDark = new Set(HOLLOW.rooms.map(r => r.id));

  it('is ambient with no sources', () => {
    expect(lightAt(6, 'kitchen', { x: 0, y: 0 }, [], allDark))
      .toBe(ambientFor(6, 'kitchen', allDark));
  });

  it('is full at a lantern and ambient beyond its radius', () => {
    expect(lightAt(6, 'kitchen', { x: 100, y: 100 }, [lantern], allDark)).toBe(1);
    expect(lightAt(6, 'kitchen', { x: 100 + LANTERN_RADIUS + 1, y: 100 }, [lantern], allDark))
      .toBe(ambientFor(6, 'kitchen', allDark));
  });

  it('does not leak between rooms', () => {
    expect(lightAt(6, 'library', { x: 100, y: 100 }, [lantern], allDark))
      .toBe(ambientFor(6, 'library', allDark));
  });

  it('falls off with distance inside the radius', () => {
    const near = lightAt(6, 'kitchen', { x: 130, y: 100 }, [lantern], allDark);
    const far  = lightAt(6, 'kitchen', { x: 190, y: 100 }, [lantern], allDark);
    expect(near).toBeGreaterThan(far);
  });

  // v12.2 §5 — a placed lantern "stops the Odd Sock grabbing anyone inside the light"
  it('lifts a dark room above the grab threshold where the lantern reaches', () => {
    expect(lightAt(6, 'kitchen', { x: 110, y: 100 }, [lantern], allDark))
      .toBeGreaterThanOrEqual(DARK_ENOUGH_FOR_TAKE);
  });
});

describe('visibilityAt', () => {
  // v12.2 §4 — in the dark names vanish and outlines blur, but you can still
  // hear footsteps. So darkness degrades to a silhouette, never to nothing.
  it('identifies in light, silhouettes in the dark, and never blinds at any ambient', () => {
    expect(visibilityAt(1)).toBe('identified');
    expect(visibilityAt(IDENTIFY_THRESHOLD)).toBe('identified');
    expect(visibilityAt(IDENTIFY_THRESHOLD - 0.01)).toBe('silhouette');
    for (const a of DARK_AMBIENT_BY_NIGHT) expect(visibilityAt(a)).toBe('silhouette');
    expect(visibilityAt(0)).toBe('unseen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/light.test.ts`
Expected: FAIL — cannot resolve `../src/core/light`.

- [ ] **Step 3: Implement**

`v12/src/core/light.ts`:

```ts
import { dist, type Vec2 } from './geometry';
import type { House, RoomId } from './house';
import { makeRng } from './rng';

/** v12.2 §13 — "Faint light almost everywhere," then progressively less of it.
 *
 *  **Ambient is per room, not per night.** A single global floor cannot express
 *  "almost", and the first version of this file proved why: with one number a
 *  night, no point in the house could ever be darker than that night's floor, so
 *  no grab was possible until Night Four and the game could not start. v12.2 §13
 *  bans the grab on Night One *only*.
 *
 *  So a room is either faintly lit — you can see faces — or dark, where you
 *  cannot and where you can be taken. What escalates is HOW MANY rooms are dark
 *  and how dark they get. */
export const LIT_AMBIENT_BY_NIGHT  = [0.60, 0.55, 0.52, 0.50, 0.48, 0.46] as const;
export const DARK_AMBIENT_BY_NIGHT = [0.20, 0.16, 0.13, 0.10, 0.08, 0.06] as const;

/** Of twelve rooms. The Hearth is never dark — it is literally on fire — so
 *  eleven is the ceiling. */
export const DARK_ROOM_COUNT_BY_NIGHT = [3, 5, 7, 9, 11, 11] as const;

export const IDENTIFY_THRESHOLD = 0.45;
export const DARK_ENOUGH_FOR_TAKE = 0.25;
export const LANTERN_RADIUS = 120;
export const CARRIED_LANTERN_RADIUS = 45;

export const ALWAYS_LIT: readonly RoomId[] = ['hearth'];

export interface LightSource { room: RoomId; at: Vec2; radius: number }

function atNight<T>(table: readonly T[], night: number): T {
  return table[Math.min(Math.max(Math.round(night) - 1, 0), table.length - 1)]!;
}

/** Which rooms are dark on a given night. Deterministic from the match seed, and
 *  **nested** — a room dark on night n is still dark on n+1 — so the house is
 *  learnable rather than re-rolled nightly. */
export function darkRoomsFor(house: House, night: number, seed: number): Set<RoomId> {
  const candidates = house.rooms
    .map(r => r.id)
    .filter(id => !ALWAYS_LIT.includes(id));

  // Shuffle once per match, then take a prefix that only grows with the night.
  const rng = makeRng(seed);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const count = Math.min(atNight(DARK_ROOM_COUNT_BY_NIGHT, night), candidates.length);
  return new Set(candidates.slice(0, count));
}

export function ambientFor(night: number, room: RoomId, dark: ReadonlySet<RoomId>): number {
  return dark.has(room)
    ? atNight(DARK_AMBIENT_BY_NIGHT, night)
    : atNight(LIT_AMBIENT_BY_NIGHT, night);
}

/** Light is room-scoped. v12.2 §5 says a placed lantern lights *its room*, and
 *  rooms are boxes, so a source never reaches past its own. That is also what
 *  makes the render-side mask cheap. */
export function lightAt(
  night: number, room: RoomId, p: Vec2,
  sources: readonly LightSource[], dark: ReadonlySet<RoomId>,
): number {
  let level = ambientFor(night, room, dark);
  for (const s of sources) {
    if (s.room !== room) continue;
    const d = dist(s.at, p);
    if (d >= s.radius) continue;
    level = Math.max(level, 1 - (d / s.radius) ** 2);
  }
  return Math.min(level, 1);
}

export type Visibility = 'identified' | 'silhouette' | 'unseen';

/** rules §9: in deep darkness names disappear and colours desaturate, but
 *  "footsteps and movement remain perceptible" — so darkness must degrade to
 *  a silhouette, not to nothing. 'unseen' is for a light level of zero only,
 *  which the ambient floor never reaches. */
export function visibilityAt(level: number): Visibility {
  if (level >= IDENTIFY_THRESHOLD) return 'identified';
  if (level > 0) return 'silhouette';
  return 'unseen';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): the light model, with §18's escalation as numbers"
```

---

## Task 5: The simulation tick, movement and room transfer

**Files:**
- Create: `v12/src/core/movement.ts`, `v12/src/core/sim.ts`
- Test: `v12/test/movement.test.ts`, `v12/test/sim.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4
- Produces:
  - `const TICK_HZ = 30`, `const DT = 1 / 30`
  - `interface Input { moveX: number; moveY: number; run: boolean }` (each axis clamped to −1..1)
  - `interface Actor { id: ActorId; room: RoomId; at: Vec2; alive: boolean; carrying: 'none' | 'lantern' | 'sock' }`
  - `interface SimState { tick: number; night: number; actors: Actor[]; lanterns: Lantern[] }`
  - `interface Lantern { id: LanternId; state: { kind: 'held'; by: ActorId } | { kind: 'placed'; room: RoomId; at: Vec2; watching: DoorId; lit: boolean } }`
  - `createSim(house: House, seed: number, actorIds: ActorId[]): Sim`
  - `class Sim { readonly state: SimState; step(inputs: Map<ActorId, Input>): void; drain(): MatchEvent[]; lightSources(): LightSource[] }`
  - `ACTOR_RADIUS`, `WALK_SPEED`, `RUN_SPEED`, `CARRY_SLOWDOWN`

- [ ] **Step 1: Write the failing movement test**

`v12/test/movement.test.ts`:

```ts
import { stepPosition } from '../src/core/movement';
import { HOLLOW } from '../src/house/hollow';
import { roomById } from '../src/core/house';

const kitchen = roomById(HOLLOW, 'kitchen');

describe('stepPosition', () => {
  it('moves freely inside a room', () => {
    const from = { x: kitchen.bounds.x + 100, y: kitchen.bounds.y + 100 };
    const r = stepPosition(HOLLOW, 'kitchen', from, { x: 10, y: 0 });
    expect(r.room).toBe('kitchen');
    expect(r.at.x).toBeCloseTo(from.x + 10);
  });

  it('is stopped by a wall away from any door', () => {
    const from = { x: kitchen.bounds.x + 10, y: kitchen.bounds.y + 10 };
    const r = stepPosition(HOLLOW, 'kitchen', from, { x: -500, y: 0 });
    expect(r.room).toBe('kitchen');
    expect(r.at.x).toBeGreaterThanOrEqual(kitchen.bounds.x);
  });

  it('transfers to the neighbouring room when crossing a door span', () => {
    const door = HOLLOW.doors.find(d => d.id === 'd_hearth_kitchen')!;
    const from = { x: door.at.x - 20, y: door.at.y };
    const r = stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 });
    expect(r.room).toBe('kitchen');
    expect(r.crossed).toBe('d_hearth_kitchen');
  });

  it('does not transfer when crossing the same wall outside the door span', () => {
    const door = HOLLOW.doors.find(d => d.id === 'd_hearth_kitchen')!;
    const from = { x: door.at.x - 20, y: door.at.y + door.span };
    const r = stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 });
    expect(r.room).toBe('hearth');
    expect(r.crossed).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing determinism test**

This is spec §4 acceptance criterion 5. `v12/test/sim.test.ts`:

```ts
import { createSim, type Input } from '../src/core/sim';
import { HOLLOW } from '../src/house/hollow';
import { makeRng } from '../src/core/rng';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function run(seed: number, ticks: number) {
  const sim = createSim(HOLLOW, seed, IDS);
  const rng = makeRng(seed ^ 0xabcdef);
  const events = [];
  for (let t = 0; t < ticks; t++) {
    const inputs = new Map<string, Input>();
    for (const id of IDS) {
      inputs.set(id, { moveX: rng() * 2 - 1, moveY: rng() * 2 - 1, run: rng() > 0.8 });
    }
    sim.step(inputs);
    events.push(...sim.drain());
  }
  return events;
}

describe('determinism', () => {
  it('produces a byte-identical event stream for the same seed and inputs', () => {
    expect(JSON.stringify(run(1234, 600))).toBe(JSON.stringify(run(1234, 600)));
  });

  it('diverges for a different seed', () => {
    expect(JSON.stringify(run(1234, 600))).not.toBe(JSON.stringify(run(1235, 600)));
  });
});

describe('sim', () => {
  it('starts every actor in a distinct room — rules §8', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const rooms = sim.state.actors.map(a => a.room);
    expect(new Set(rooms).size).toBe(IDS.length);
  });

  it('advances one tick at a time', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.step(new Map());
    expect(sim.state.tick).toBe(1);
  });

  // rules §9 — footsteps and movement remain perceptible
  it('emits footsteps while moving and none while still', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const walker = sim.state.actors[0]!;
    for (let i = 0; i < 60; i++) {
      sim.step(new Map([[walker.id, { moveX: 1, moveY: 0, run: false }]]));
    }
    const walking = sim.drain().filter(e => e.kind === 'step');
    expect(walking.length).toBeGreaterThan(0);
    expect(walking.every(e => e.kind === 'step' && !e.hurried)).toBe(true);

    for (let i = 0; i < 60; i++) sim.step(new Map());
    expect(sim.drain().filter(e => e.kind === 'step')).toHaveLength(0);
  });

  it('emits footsteps more often when running than when walking', () => {
    const count = (run: boolean) => {
      const sim = createSim(HOLLOW, 42, IDS);
      const id = sim.state.actors[0]!.id;
      for (let i = 0; i < 120; i++) sim.step(new Map([[id, { moveX: 1, moveY: 0, run }]]));
      return sim.drain().filter(e => e.kind === 'step').length;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });

  it('emits move.enter when an actor changes room', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const walker = sim.state.actors[0]!;
    for (let i = 0; i < 600; i++) {
      sim.step(new Map([[walker.id, { moveX: 1, moveY: 0, run: true }]]));
    }
    const enters = sim.drain().filter(e => e.kind === 'move.enter');
    expect(enters.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd v12 && npx vitest run test/movement.test.ts test/sim.test.ts`
Expected: FAIL — modules unresolved.

- [ ] **Step 4: Implement movement**

`v12/src/core/movement.ts`:

```ts
import { clampInside, pointInRect, type Rect, type Vec2 } from './geometry';
import { otherSide, roomById, type DoorId, type House, type RoomId } from './house';

export const ACTOR_RADIUS = 14;

export interface StepResult { room: RoomId; at: Vec2; crossed: DoorId | null }

function inset(r: Rect, radius: number): Rect {
  return { x: r.x + radius, y: r.y + radius, w: r.w - 2 * radius, h: r.h - 2 * radius };
}

/** Rooms are boxes; doors are gaps of `span` centred on `door.at`. If the
 *  desired position leaves the room and lies within a door's span, transfer.
 *  Otherwise clamp. Deliberately simpler than a navmesh — the house is twelve
 *  rectangles and nothing here needs pathfinding.
 *
 *  Two things make "leaves the room" and "within a door's span" trickier than
 *  they look. Both were found by building this and watching nobody move.
 *
 *  1. **"Leaves the room" must mean leaves the ACTOR_RADIUS-shrunk box**, not
 *     the raw rectangle. Checking the raw rect makes any desired position
 *     between (wall − ACTOR_RADIUS) and the wall read as "still inside", and
 *     `clampInside` puts it straight back to (wall − ACTOR_RADIUS). A walk or
 *     run tick moves less than ACTOR_RADIUS, so that is a permanent fixed
 *     point: **nobody could reach a door at any speed, in any room.**
 *
 *  2. **A door's span cannot be checked symmetrically on both axes.** `door.at`
 *     sits in the gap *between* two rooms, so on exactly one axis it lies
 *     outside this room's bounds — the through-wall axis. Requiring proximity
 *     to `door.at` on that axis too is stricter than it looks: ACTOR_RADIUS
 *     plus half the inter-room gap already exceeds half the span, so a legally
 *     clamped position can never satisfy it and only a run-speed overshoot
 *     happens to. Walking into the same door would soft-lock. So the
 *     through-wall axis gets a **direction** test — has the actor passed the
 *     inset edge on the side this door is on? — not a proximity test. */
export function stepPosition(
  house: House, room: RoomId, from: Vec2, delta: Vec2,
  closed: ReadonlySet<DoorId> = new Set(),
): StepResult {
  const bounds = roomById(house, room).bounds;
  const desired = { x: from.x + delta.x, y: from.y + delta.y };
  const inner = inset(bounds, ACTOR_RADIUS);

  if (pointInRect(desired, inner)) {
    return { room, at: clampInside(desired, ACTOR_RADIUS, bounds), crossed: null };
  }

  for (const door of house.doors) {
    if (door.a !== room && door.b !== room) continue;
    if (closed.has(door.id)) continue;   // a closed door is a wall

    const throughX = door.at.x < bounds.x || door.at.x > bounds.x + bounds.w;
    const half = door.span / 2;
    const alongOk = throughX
      ? Math.abs(desired.y - door.at.y) <= half
      : Math.abs(desired.x - door.at.x) <= half;
    if (!alongOk) continue;

    const passedThrough = throughX
      ? (door.at.x < bounds.x ? desired.x < inner.x : desired.x > inner.x + inner.w)
      : (door.at.y < bounds.y ? desired.y < inner.y : desired.y > inner.y + inner.h);
    if (!passedThrough) continue;

    const to = otherSide(door, room);
    const toBounds = roomById(house, to).bounds;
    return {
      room: to,
      at: clampInside(desired, ACTOR_RADIUS, toBounds),
      crossed: door.id,
    };
  }

  return { room, at: clampInside(desired, ACTOR_RADIUS, bounds), crossed: null };
}
```

- [ ] **Step 5: Implement the sim**

`v12/src/core/sim.ts`:

```ts
import { makeSink, type ActorId, type EventSink, type LanternId, type MatchEvent } from './events';
import type { Vec2 } from './geometry';
import { roomById, type DoorId, type House, type RoomId } from './house';
import { CARRIED_LANTERN_RADIUS, LANTERN_RADIUS, darkRoomsFor, type LightSource } from './light';
import { ACTOR_RADIUS, stepPosition } from './movement';
import { makeRng } from './rng';

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;

export const WALK_SPEED = 110;      // px/s
export const RUN_SPEED = 190;
export const CARRY_SLOWDOWN = 0.8;  // rules §10.1 — carrying a lantern is slower

// rules §9/§20 — a moving player emits a footstep on this cadence. Running is
// faster and therefore louder in frequency, which is how a listener tells
// hurried movement from careful movement without being told.
export const WALK_STEP_TICKS = 18;
export const RUN_STEP_TICKS = 11;

export interface Input { moveX: number; moveY: number; run: boolean }

export interface Actor {
  id: ActorId; room: RoomId; at: Vec2; alive: boolean;
  carrying: 'none' | 'lantern' | 'sock';
  stepCooldown: number;
}

export type LanternState =
  | { kind: 'held'; by: ActorId }
  | { kind: 'placed'; room: RoomId; at: Vec2; watching: DoorId; lit: boolean };

export interface Lantern { id: LanternId; state: LanternState }

export interface SimState {
  tick: number; night: number; actors: Actor[]; lanterns: Lantern[];
}

export class Sim {
  readonly state: SimState;
  private readonly sink: EventSink = makeSink();

  constructor(readonly house: House, private readonly seed: number, actorIds: ActorId[]) {
    const rng = makeRng(seed);
    // rules §8: six different starting rooms, one player each, randomised.
    const pool = this.house.rooms.filter(r => r.id !== 'hearth').map(r => r.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    this.state = {
      tick: 0,
      night: 1,
      actors: actorIds.map((id, i) => {
        const room = pool[i]!;
        const b = roomById(this.house, room).bounds;
        return {
          id, room, alive: true, carrying: 'none' as const, stepCooldown: 0,
          at: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
        };
      }),
      lanterns: [
        { id: 'lantern_a', state: { kind: 'placed', room: 'shared_bedroom', at: { x: 0, y: 0 }, watching: 'd_bed_hearth', lit: true } },
        { id: 'lantern_b', state: { kind: 'placed', room: 'hearth', at: { x: 0, y: 0 }, watching: 'd_hearth_kitchen', lit: true } },
      ],
    };
    // Park the starting lanterns at their room centres.
    for (const l of this.state.lanterns) {
      if (l.state.kind !== 'placed') continue;
      const b = roomById(this.house, l.state.room).bounds;
      l.state.at = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }
  }

  step(inputs: Map<ActorId, Input>): void {
    this.state.tick++;
    for (const actor of this.state.actors) {
      if (!actor.alive) continue;
      const input = inputs.get(actor.id);
      if (!input) continue;

      const len = Math.hypot(input.moveX, input.moveY);
      if (len === 0) continue;
      let speed = input.run ? RUN_SPEED : WALK_SPEED;
      if (actor.carrying === 'lantern') speed *= CARRY_SLOWDOWN;

      const delta = {
        x: (input.moveX / len) * speed * DT,
        y: (input.moveY / len) * speed * DT,
      };
      const result = stepPosition(this.house, actor.room, actor.at, delta);
      actor.at = result.at;
      if (result.crossed) {
        actor.room = result.room;
        this.sink.emit({
          kind: 'move.enter', tick: this.state.tick, night: this.state.night,
          actor: actor.id, room: result.room, via: result.crossed,
        });
      }

      // rules §9 — footsteps remain perceptible however dark it gets. This is
      // the only channel by which a player learns someone is in the next room.
      if (actor.stepCooldown > 0) actor.stepCooldown--;
      if (actor.stepCooldown === 0) {
        actor.stepCooldown = input.run ? RUN_STEP_TICKS : WALK_STEP_TICKS;
        this.sink.emit({
          kind: 'step', tick: this.state.tick, night: this.state.night,
          actor: actor.id, room: actor.room,
          floor: roomById(this.house, actor.room).floor, hurried: input.run,
        });
      }
    }
  }

  /** v12.2 §13 — which rooms are dark tonight. A getter rather than a field
   *  because both the scene and the tests set `state.night` directly, and a
   *  cached set would silently go stale the moment they did. `darkRoomsFor` is
   *  deterministic from (house, night, seed), so this stays replay-safe. */
  get darkRooms(): ReadonlySet<RoomId> {
    return darkRoomsFor(this.house, this.state.night, this.seed);
  }

  lightSources(): LightSource[] {
    const out: LightSource[] = [];
    for (const l of this.state.lanterns) {
      if (l.state.kind === 'placed') {
        if (l.state.lit) out.push({ room: l.state.room, at: l.state.at, radius: LANTERN_RADIUS });
      } else {
        const holderId = l.state.by;
        const holder = this.state.actors.find(a => a.id === holderId);
        if (holder?.alive) {
          out.push({ room: holder.room, at: holder.at, radius: CARRIED_LANTERN_RADIUS });
        }
      }
    }
    return out;
  }

  drain(): MatchEvent[] { return this.sink.drain(); }
}

export function createSim(house: House, seed: number, actorIds: ActorId[]): Sim {
  return new Sim(house, seed, actorIds);
}

export { ACTOR_RADIUS };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS. The determinism test is the load-bearing one — if it fails, stop and find the nondeterminism before continuing. Everything after this depends on it.

- [ ] **Step 7: Commit**

```bash
git add v12/
git commit -m "feat(v12): the deterministic tick, movement and room transfer"
```

---

## Task 5A: Doors that close, and hiding

Spec §4 lists "open and close doors" and "hide briefly behind furniture" in slice 0's scope, and rules §9 grants both to every player. A closed door is the cheapest tactic in the game and the only thing that makes the Take's warning window survivable in an open-plan house.

**Files:**
- Modify: `v12/src/core/movement.ts` (block closed doors), `v12/src/core/sim.ts` (door state, hiding)
- Test: `v12/test/doors.test.ts`

**Interfaces:**
- Consumes: `stepPosition`, `Sim`, `Actor`
- Produces:
  - `stepPosition(house, room, from, delta, closed: ReadonlySet<DoorId>): StepResult` — **note the added fifth parameter**
  - On `SimState`: `closedDoors: Set<DoorId>`
  - On `Actor`: `hiddenUntilTick: number` (0 when not hiding)
  - `const HIDE_TICKS = 60` (2 s)
  - On `Sim`: `toggleDoor(actorId, doorId): { ok: boolean; reason?: string }`, `beginHide(actorId): { ok: boolean; reason?: string }`, `isHidden(actorId): boolean`

- [ ] **Step 1: Write the failing test**

`v12/test/doors.test.ts`:

```ts
import { createSim, HIDE_TICKS } from '../src/core/sim';
import { stepPosition } from '../src/core/movement';
import { HOLLOW } from '../src/house/hollow';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

describe('closed doors', () => {
  it('blocks a crossing that would otherwise succeed', () => {
    const door = HOLLOW.doors.find(d => d.id === 'd_hearth_kitchen')!;
    const from = { x: door.at.x - 20, y: door.at.y };
    expect(stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 }, new Set()).room).toBe('kitchen');
    expect(stepPosition(HOLLOW, 'hearth', from, { x: 60, y: 0 }, new Set(['d_hearth_kitchen'])).room)
      .toBe('hearth');
  });
});

describe('toggleDoor', () => {
  it('closes and reopens a door of the room you are standing in, and emits both', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    const actor = sim.state.actors[0]!;
    actor.room = 'kitchen';
    expect(sim.toggleDoor(actor.id, 'd_hearth_kitchen').ok).toBe(true);
    expect(sim.state.closedDoors.has('d_hearth_kitchen')).toBe(true);
    expect(sim.toggleDoor(actor.id, 'd_hearth_kitchen').ok).toBe(true);
    expect(sim.state.closedDoors.has('d_hearth_kitchen')).toBe(false);
    const kinds = sim.drain().filter(e => e.kind === 'door.toggle');
    expect(kinds).toHaveLength(2);
    // Check the payload, not just the count — a hardcoded or inverted `open`
    // would otherwise ship silently.
    expect(kinds.map(e => e.kind === 'door.toggle' && e.open)).toEqual([false, true]);
  });

  it('refuses a door that is not an exit of your room', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.state.actors[0]!.room = 'kitchen';
    expect(sim.toggleDoor(sim.state.actors[0]!.id, 'd_attic_playroom').ok).toBe(false);
  });
});

describe('hiding', () => {
  // v12.2 §4 — hide BRIEFLY. Pin the duration, not just the fact that it ends:
  // asserting only "true now, false after HIDE_TICKS" passes unchanged if the
  // duration is silently changed to 1 tick, and the duration is the one numeric
  // guarantee this task introduces.
  it('lasts exactly HIDE_TICKS', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.beginHide('pike');
    expect(sim.isHidden('pike')).toBe(true);
    for (let i = 0; i < HIDE_TICKS - 1; i++) sim.step(new Map());
    expect(sim.isHidden('pike'), 'should still be hidden one tick short').toBe(true);
    sim.step(new Map());
    expect(sim.isHidden('pike'), 'should be out of hiding on the last tick').toBe(false);
  });

  it('refuses to hide while carrying anything', () => {
    const sim = createSim(HOLLOW, 42, IDS);
    sim.state.actors.find(a => a.id === 'pike')!.carrying = 'lantern';
    expect(sim.beginHide('pike').ok).toBe(false);
  });
});
```

**Hiding's effect on the Take is deliberately not here.** `take.ts` does not exist until Task 7, and a task that imports a module three tasks ahead of itself cannot run. Task 7 owns that half.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/doors.test.ts`
Expected: FAIL — `stepPosition` accepts four arguments, and `toggleDoor` / `beginHide` / `isHidden` / `HIDE_TICKS` do not exist.

- [ ] **Step 3: Confirm the closed-door parameter is already in movement**

Task 5 shipped `stepPosition` with the fifth parameter and its guard already in place:

```ts
export function stepPosition(
  house: House, room: RoomId, from: Vec2, delta: Vec2,
  closed: ReadonlySet<DoorId> = new Set(),
): StepResult {
```

and inside the door loop, immediately after `if (door.a !== room && door.b !== room) continue;`:

```ts
    if (closed.has(door.id)) continue;   // a closed door is a wall
```

**Verify both are present and change nothing if so.** The default empty set is what keeps Task 5's own tests passing. This step exists to confirm, not to re-apply.

- [ ] **Step 4: Add door state and hiding to Sim**

In `v12/src/core/sim.ts`:

Add `export const HIDE_TICKS = 60;` beside the other constants.

Add `hiddenUntilTick: number;` to `Actor`, and `closedDoors: Set<DoorId>;` to `SimState`.

In the constructor, initialise `hiddenUntilTick: 0` on every actor and `closedDoors: new Set()` on the state.

In `step`, pass the closed set through: `stepPosition(this.house, actor.room, actor.at, delta, this.state.closedDoors)`.

Add three methods to `Sim`:

```ts
  isHidden(id: ActorId): boolean {
    const a = this.state.actors.find(x => x.id === id);
    return !!a && a.hiddenUntilTick > this.state.tick;
  }

  /** rules §9 — hide BRIEFLY behind furniture. Brief is the whole point: it
   *  buys you the length of a Take's warning window and nothing more. */
  beginHide(id: ActorId): { ok: boolean; reason?: string } {
    const a = this.state.actors.find(x => x.id === id);
    if (!a?.alive) return { ok: false, reason: 'no such living actor' };
    if (a.carrying !== 'none') return { ok: false, reason: 'carrying something' };
    a.hiddenUntilTick = this.state.tick + HIDE_TICKS;
    return { ok: true };
  }

  toggleDoor(actorId: ActorId, doorId: DoorId): { ok: boolean; reason?: string } {
    const a = this.state.actors.find(x => x.id === actorId);
    if (!a?.alive) return { ok: false, reason: 'no such living actor' };
    if (!exitsOf(this.house, a.room).some(d => d.id === doorId)) {
      return { ok: false, reason: 'that door is not an exit of this room' };
    }
    const open = this.state.closedDoors.delete(doorId);
    if (!open) this.state.closedDoors.add(doorId);
    this.sink.emit({
      kind: 'door.toggle', tick: this.state.tick, night: this.state.night,
      actor: actorId, door: doorId, open,
    });
    return { ok: true };
  }
```

Add `exitsOf` to the imports from `./house`.

- [ ] **Step 5: Wire the keys**

In `v12/src/app/input.ts` — **do this when Task 11 creates the file, not now** — extend `UiAction` with `'door' | 'hide'`, mapping `KeyF` to `'door'` and `KeyC` to `'hide'`. Note this here so Task 11's implementer does not have to rediscover it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS, including Task 5's original movement tests, which use the defaulted fifth parameter.

- [ ] **Step 7: Commit**

```bash
git add v12/
git commit -m "feat(v12): doors that close, and somewhere to hide"
```

---

## Task 6: Lanterns — carry, place, snuff, relight

**Files:**
- Create: `v12/src/core/lantern.ts`
- Modify: `v12/src/core/sim.ts` (wire the actions into `step`)
- Test: `v12/test/lantern.test.ts`

**Interfaces:**
- Consumes: `Sim`, `Actor`, `Lantern` from `core/sim`
- Produces: `type LanternAction = { kind: 'pickup'; lantern: LanternId } | { kind: 'place'; watching: DoorId } | { kind: 'snuff'; lantern: LanternId } | { kind: 'relight'; lantern: LanternId }`; `applyLanternAction(sim, actorId, action): { ok: boolean; reason?: string }`
- **Does not extend `Input`.** An earlier draft routed lantern actions through `Input.action`, but nothing consumes it: Task 11's scene calls `applyLanternAction` directly, and the established pattern for `toggleDoor` and `beginHide` is a direct method on `Sim`. Dead API surface — YAGNI.

- [ ] **Step 1: Write the failing test**

`v12/test/lantern.test.ts`:

```ts
import { createSim } from '../src/core/sim';
import { applyLanternAction } from '../src/core/lantern';
import { HOLLOW } from '../src/house/hollow';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function simWithActorAt(room: string) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.actors[0]!.room = room;
  const b = HOLLOW.rooms.find(r => r.id === room)!.bounds;
  sim.state.actors[0]!.at = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  return sim;
}

describe('lantern actions', () => {
  it('picks up a placed lantern in the same room', () => {
    const sim = simWithActorAt('shared_bedroom');
    const r = applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' });
    expect(r.ok).toBe(true);
    expect(sim.state.lanterns[0]!.state).toEqual({ kind: 'held', by: 'bell' });
    expect(sim.state.actors[0]!.carrying).toBe('lantern');
  });

  it('refuses to pick up a lantern in another room', () => {
    const sim = simWithActorAt('attic');
    expect(applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' }).ok).toBe(false);
  });

  // rules §11.4 — you cannot hold a lantern while carrying a sock
  it('refuses to pick up a lantern while carrying a sock', () => {
    const sim = simWithActorAt('shared_bedroom');
    sim.state.actors[0]!.carrying = 'sock';
    const r = applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/sock/i);
  });

  // v12.2 §5 — a placed lantern "watches one doorway of your choosing".
  //
  // NOTE the setup. `lantern_a` starts placed in the Shared Bedroom, so the
  // actor must be THERE to pick it up. An earlier version of these two tests
  // put the actor in the kitchen, where the pickup silently failed — which
  // made the positive test fail outright and the negative one below pass for
  // entirely the wrong reason. Carry the lantern to the room you mean to test.
  it('places a lantern watching a chosen door and emits the choice', () => {
    const sim = simWithActorAt('shared_bedroom');
    expect(applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' }).ok).toBe(true);
    const r = applyLanternAction(sim, 'bell', { kind: 'place', watching: 'd_bed_hearth' });
    expect(r.ok).toBe(true);
    const placed = sim.state.lanterns[0]!.state;
    expect(placed).toMatchObject({
      kind: 'placed', room: 'shared_bedroom', watching: 'd_bed_hearth', lit: true,
    });
    expect(sim.drain().some(e => e.kind === 'lantern.place' && e.watching === 'd_bed_hearth')).toBe(true);
  });

  it('refuses to watch a door that is not an exit of the room', () => {
    const sim = simWithActorAt('shared_bedroom');
    expect(applyLanternAction(sim, 'bell', { kind: 'pickup', lantern: 'lantern_a' }).ok).toBe(true);
    const r = applyLanternAction(sim, 'bell', { kind: 'place', watching: 'd_attic_playroom' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not an exit/i);
  });

  it('snuffing unlights a placed lantern and relighting restores it', () => {
    const sim = simWithActorAt('shared_bedroom');
    expect(applyLanternAction(sim, 'bell', { kind: 'snuff', lantern: 'lantern_a' }).ok).toBe(true);
    expect(sim.lightSources().some(s => s.room === 'shared_bedroom')).toBe(false);
    expect(applyLanternAction(sim, 'bell', { kind: 'relight', lantern: 'lantern_a' }).ok).toBe(true);
    expect(sim.lightSources().some(s => s.room === 'shared_bedroom')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/lantern.test.ts`
Expected: FAIL — cannot resolve `../src/core/lantern`.

- [ ] **Step 3: Implement**

`v12/src/core/lantern.ts`:

```ts
import type { ActorId, LanternId } from './events';
import { exitsOf, type DoorId } from './house';
import type { Sim } from './sim';

export type LanternAction =
  | { kind: 'pickup'; lantern: LanternId }
  | { kind: 'place'; watching: DoorId }
  | { kind: 'snuff'; lantern: LanternId }
  | { kind: 'relight'; lantern: LanternId };

export interface ActionResult { ok: boolean; reason?: string }

export function applyLanternAction(
  sim: Sim, actorId: ActorId, action: LanternAction,
): ActionResult {
  const actor = sim.state.actors.find(a => a.id === actorId);
  if (!actor?.alive) return { ok: false, reason: 'no such living actor' };
  const emit = (kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight',
                lantern: LanternId, watching?: DoorId) =>
    sim.emitLantern(kind, actorId, lantern, actor.room, watching);

  switch (action.kind) {
    case 'pickup': {
      // rules §11.4 — you cannot hold a lantern while carrying a sock
      if (actor.carrying === 'sock') return { ok: false, reason: 'carrying a sock' };
      if (actor.carrying === 'lantern') return { ok: false, reason: 'already carrying a lantern' };
      const l = sim.state.lanterns.find(x => x.id === action.lantern);
      if (!l) return { ok: false, reason: 'no such lantern' };
      if (l.state.kind !== 'placed') return { ok: false, reason: 'lantern is held' };
      if (l.state.room !== actor.room) return { ok: false, reason: 'lantern is elsewhere' };
      l.state = { kind: 'held', by: actorId };
      actor.carrying = 'lantern';
      emit('lantern.carry', l.id);
      return { ok: true };
    }
    case 'place': {
      const l = sim.state.lanterns.find(
        x => x.state.kind === 'held' && x.state.by === actorId);
      if (!l) return { ok: false, reason: 'not carrying a lantern' };
      // rules §10.2 — the watched doorway must be one of this room's exits
      if (!exitsOf(sim.house, actor.room).some(d => d.id === action.watching)) {
        return { ok: false, reason: 'that door is not an exit of this room' };
      }
      l.state = {
        kind: 'placed', room: actor.room, at: { ...actor.at },
        watching: action.watching, lit: true,
      };
      actor.carrying = 'none';
      emit('lantern.place', l.id, action.watching);
      return { ok: true };
    }
    case 'snuff':
    case 'relight': {
      const l = sim.state.lanterns.find(x => x.id === action.lantern);
      if (!l) return { ok: false, reason: 'no such lantern' };
      if (l.state.kind !== 'placed') return { ok: false, reason: 'lantern is held' };
      if (l.state.room !== actor.room) return { ok: false, reason: 'lantern is elsewhere' };
      l.state.lit = action.kind === 'relight';
      emit(action.kind === 'snuff' ? 'lantern.snuff' : 'lantern.relight', l.id);
      return { ok: true };
    }
  }
}
```

- [ ] **Step 4: Expose what the action module needs from Sim**

`house` is already `readonly` on `Sim` (Task 5), so the action module can read it. Add this method to `Sim` in `v12/src/core/sim.ts` — it is the only door the action modules get into the event sink:

```ts
  emitLantern(
    kind: 'lantern.carry' | 'lantern.place' | 'lantern.snuff' | 'lantern.relight',
    actor: ActorId, lantern: LanternId, room: RoomId, watching?: DoorId,
  ): void {
    this.sink.emit({ kind, tick: this.state.tick, night: this.state.night, actor, lantern, room, watching });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add v12/
git commit -m "feat(v12): lanterns, and §10.2's one watched doorway"
```

---

## Task 7: The Take

**Files:**
- Create: `v12/src/core/take.ts`
- Test: `v12/test/take.test.ts`

**Interfaces:**
- Consumes: `Sim`, `Actor`; `lightAt`, `DARK_ENOUGH_FOR_TAKE`, `LANTERN_RADIUS` from `core/light`; `dist` from `core/geometry`
- Produces:
  - `const CONTACT_RADIUS = 40`, `const INTERVENE_RADIUS = 200`, `const TAKE_TICKS = 90` (3 s, per v12.2 §7's "about three seconds of contact"), `const WARN_AT_TICKS = 30` (1 s of warning)
  - `type TakeBlock = 'too-lit' | 'lantern-protected' | 'witness' | 'out-of-contact' | 'night-one' | 'carrying'`
  - `canTake(sim: Sim, taker: ActorId, victim: ActorId): { ok: true } | { ok: false; reason: TakeBlock }`
  - `class TakeAttempt { tick(sim: Sim): 'warned' | 'progressing' | 'broken' | 'complete' }`
  - `beginTake(taker: ActorId, victim: ActorId): TakeAttempt`

- [ ] **Step 1: Write the failing test**

`v12/test/take.test.ts`:

```ts
import { createSim } from '../src/core/sim';
import { applyLanternAction } from '../src/core/lantern';
import { canTake, beginTake, TAKE_TICKS, WARN_AT_TICKS } from '../src/core/take';
import { dist } from '../src/core/geometry';
import { exitsOf } from '../src/core/house';
import { HOLLOW } from '../src/house/hollow';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function pairInDarkRoom(night = 6) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.night = night;
  const b = HOLLOW.rooms.find(r => r.id === 'attic')!.bounds;
  const spot = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  for (const id of ['wren', 'pike']) {
    const a = sim.state.actors.find(x => x.id === id)!;
    a.room = 'attic';
    a.at = { ...spot };
  }
  // Move everyone else far away so they cannot intervene.
  for (const a of sim.state.actors) {
    if (a.id === 'wren' || a.id === 'pike') continue;
    a.room = 'shared_bedroom';
    const c = HOLLOW.rooms.find(r => r.id === 'shared_bedroom')!.bounds;
    a.at = { x: c.x + 20, y: c.y + 20 };
  }
  return sim;
}

describe('canTake', () => {
  it('allows a Take in a dark room with contact and no witness', () => {
    expect(canTake(pairInDarkRoom(), 'wren', 'pike')).toEqual({ ok: true });
  });

  // rules §8 — no Take is possible on Night One
  it('refuses on night one', () => {
    const r = canTake(pairInDarkRoom(1), 'wren', 'pike');
    expect(r).toEqual({ ok: false, reason: 'night-one' });
  });

  // rules §12.1 — available when the room is dark enough
  it('refuses in a lit room', () => {
    const r = canTake(pairInDarkRoom(2), 'wren', 'pike');
    expect(r).toEqual({ ok: false, reason: 'too-lit' });
  });

  // rules §10.2 — a placed lantern prevents Takes inside its radius
  it('refuses inside a placed lantern radius', () => {
    const sim = pairInDarkRoom();
    const wren = sim.state.actors.find(a => a.id === 'wren')!;
    wren.carrying = 'none';
    sim.state.lanterns[0]!.state = {
      kind: 'placed', room: 'attic', at: { ...wren.at }, watching: 'd_attic_playroom', lit: true,
    };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'lantern-protected' });
  });

  // rules §12.1 — no second living child close enough to intervene
  it('refuses when a third living child is close enough to intervene', () => {
    const sim = pairInDarkRoom();
    const witness = sim.state.actors.find(a => a.id === 'clem')!;
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    witness.room = 'attic';
    witness.at = { x: victim.at.x + 30, y: victim.at.y };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'witness' });
  });

  it('refuses out of contact range', () => {
    const sim = pairInDarkRoom();
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    victim.at = { x: victim.at.x + 400, y: victim.at.y };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'out-of-contact' });
  });

  // rules §11.4 — carrying a sock blocks your special action
  it('refuses while the taker carries a sock', () => {
    const sim = pairInDarkRoom();
    sim.state.actors.find(a => a.id === 'wren')!.carrying = 'sock';
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'carrying' });
  });

  // rules §9 — hiding is granted to every player, and Task 5A built it.
  // Its effect on the Take lives here because canTake lives here.
  it('refuses against a hidden victim', () => {
    const sim = pairInDarkRoom();
    expect(canTake(sim, 'wren', 'pike').ok).toBe(true);
    sim.beginHide('pike');
    expect(canTake(sim, 'wren', 'pike').ok).toBe(false);
  });

  // A hidden child must not also count as the witness that protects someone
  // else — otherwise hiding is strictly better than standing guard, and
  // rules §19's anti-turtling inverts.
  it('does not let a hidden child count as an intervening witness', () => {
    const sim = pairInDarkRoom();
    const clem = sim.state.actors.find(a => a.id === 'clem')!;
    const pike = sim.state.actors.find(a => a.id === 'pike')!;
    clem.room = 'attic';
    clem.at = { x: pike.at.x + 30, y: pike.at.y };
    expect(canTake(sim, 'wren', 'pike')).toEqual({ ok: false, reason: 'witness' });
    sim.beginHide('clem');
    expect(canTake(sim, 'wren', 'pike').ok).toBe(true);
  });
});

describe('TakeAttempt', () => {
  // rules §12.1 — a Take is not instant; the target gets a brief warning
  it('warns before it completes', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    const results: string[] = [];
    for (let i = 0; i < TAKE_TICKS + 2; i++) results.push(attempt.tick(sim));
    expect(results[WARN_AT_TICKS - 1]).toBe('warned');
    expect(results[TAKE_TICKS - 1]).toBe('complete');
    expect(sim.drain().some(e => e.kind === 'take.warn')).toBe(true);
  });

  it('breaks when the victim reaches lantern light', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    for (let i = 0; i < WARN_AT_TICKS + 2; i++) attempt.tick(sim);
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    sim.state.lanterns[0]!.state = {
      kind: 'placed', room: 'attic', at: { ...victim.at }, watching: 'd_attic_playroom', lit: true,
    };
    expect(attempt.tick(sim)).toBe('broken');
  });

  it('kills the victim and emits take.complete exactly once', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    for (let i = 0; i < TAKE_TICKS + 5; i++) attempt.tick(sim);
    expect(sim.state.actors.find(a => a.id === 'pike')!.alive).toBe(false);
    expect(sim.drain().filter(e => e.kind === 'take.complete')).toHaveLength(1);
  });

  // v12.2 §4 — "While the Odd Sock is grabbing you, they move slower than you do.
  // So running actually works." Without this the warning window is decoration.
  it('slows the grabber for the whole attempt, warning tick included', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    for (let i = 0; i < WARN_AT_TICKS + 1; i++) attempt.tick(sim);
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(true);
  });

  it('lets a fleeing target outpace a grab in progress', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    attempt.tick(sim);
    const before = dist(
      sim.state.actors.find(a => a.id === 'wren')!.at,
      sim.state.actors.find(a => a.id === 'pike')!.at);
    for (let i = 0; i < 20; i++) {
      sim.step(new Map([
        ['pike', { moveX: 1, moveY: 0, run: true }],
        ['wren', { moveX: 1, moveY: 0, run: true }],
      ]));
      attempt.tick(sim);
    }
    const after = dist(
      sim.state.actors.find(a => a.id === 'wren')!.at,
      sim.state.actors.find(a => a.id === 'pike')!.at);
    expect(after).toBeGreaterThan(before);
  });

  // v12.2 §4 — "Reaching lantern light saves you." Saves, not delays. This is
  // the test that proves escaping is not merely a pause.
  it('stays broken once broken, even if the interruption goes away', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    for (let i = 0; i < TAKE_TICKS - 1; i++) attempt.tick(sim);

    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    const lantern = sim.state.lanterns[0]!;
    lantern.state = {
      kind: 'placed', room: victim.room, at: { ...victim.at },
      watching: exitsOf(HOLLOW, victim.room)[0]!.id, lit: true,
    };
    expect(attempt.tick(sim)).toBe('broken');

    // The light goes out again. The grab must NOT pick up where it left off.
    (lantern.state as { lit: boolean }).lit = false;
    expect(attempt.tick(sim)).toBe('broken');
    expect(victim.alive).toBe(true);

    // A fresh attempt has to serve the full duration over again.
    const second = beginTake('wren', 'pike');
    for (let i = 0; i < TAKE_TICKS - 1; i++) {
      expect(second.tick(sim)).not.toBe('complete');
    }
    expect(second.tick(sim)).toBe('complete');
  });

  it('clears the penalty when the attempt breaks', () => {
    const sim = pairInDarkRoom();
    const attempt = beginTake('wren', 'pike');
    attempt.tick(sim);
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(true);
    const victim = sim.state.actors.find(a => a.id === 'pike')!;
    sim.state.lanterns[0]!.state = {
      kind: 'placed', room: 'attic', at: { ...victim.at }, watching: 'd_attic_playroom', lit: true,
    };
    expect(attempt.tick(sim)).toBe('broken');
    expect(sim.state.actors.find(a => a.id === 'wren')!.grabbing).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/take.test.ts`
Expected: FAIL — cannot resolve `../src/core/take`.

- [ ] **Step 3: Implement**

`v12/src/core/take.ts`:

```ts
import type { ActorId } from './events';
import { dist } from './geometry';
import { DARK_ENOUGH_FOR_TAKE, LANTERN_RADIUS, lightAt } from './light';
import type { Sim } from './sim';

export const CONTACT_RADIUS = 40;
export const INTERVENE_RADIUS = 200;

// v12.2 §7 — "about three seconds of contact". v12.0 left the duration unstated
// and this plan had guessed 1.5 s.
export const TAKE_TICKS = 90;      // 3 s at 30 Hz
export const WARN_AT_TICKS = 30;   // 1 s of warning before it lands

export type TakeBlock =
  | 'too-lit' | 'lantern-protected' | 'witness'
  | 'out-of-contact' | 'night-one' | 'carrying';

export type TakeCheck = { ok: true } | { ok: false; reason: TakeBlock };

export function canTake(sim: Sim, takerId: ActorId, victimId: ActorId): TakeCheck {
  // rules §8 — no Take is possible on Night One. The victim would have no
  // information with which to have chosen differently.
  if (sim.state.night <= 1) return { ok: false, reason: 'night-one' };

  const taker = sim.state.actors.find(a => a.id === takerId);
  const victim = sim.state.actors.find(a => a.id === victimId);
  if (!taker?.alive || !victim?.alive) return { ok: false, reason: 'out-of-contact' };

  // rules §11.4 — carrying a sock blocks your special action
  if (taker.carrying === 'sock') return { ok: false, reason: 'carrying' };

  // rules §9 — a hidden child is not there to be taken. Hiding was built in
  // Task 5A; this is the half of it that needed canTake to exist first.
  if (sim.isHidden(victimId)) return { ok: false, reason: 'out-of-contact' };

  if (taker.room !== victim.room) return { ok: false, reason: 'out-of-contact' };
  if (dist(taker.at, victim.at) > CONTACT_RADIUS) return { ok: false, reason: 'out-of-contact' };

  // rules §10.2 — a placed lantern prevents Takes inside its radius. Checked
  // before ambient so the two blocks stay distinguishable to the caller: the
  // UI needs to say WHICH rule stopped you, or the rule cannot be learned.
  for (const l of sim.state.lanterns) {
    if (l.state.kind !== 'placed' || !l.state.lit) continue;
    if (l.state.room !== victim.room) continue;
    if (dist(l.state.at, victim.at) < LANTERN_RADIUS) {
      return { ok: false, reason: 'lantern-protected' };
    }
  }

  const level = lightAt(
    sim.state.night, victim.room, victim.at, sim.lightSources(), sim.darkRooms);
  if (level >= DARK_ENOUGH_FOR_TAKE) return { ok: false, reason: 'too-lit' };

  // rules §12.1 — no second living child close enough to intervene. A hidden
  // child does not qualify: if hiding both saved you and protected everyone
  // near you, it would strictly dominate standing guard.
  const witness = sim.state.actors.some(a =>
    a.alive && a.id !== takerId && a.id !== victimId && !sim.isHidden(a.id)
    && a.room === victim.room && dist(a.at, victim.at) <= INTERVENE_RADIUS);
  if (witness) return { ok: false, reason: 'witness' };

  return { ok: true };
}

export type TakeTick = 'warned' | 'progressing' | 'broken' | 'complete';

export class TakeAttempt {
  private elapsed = 0;
  private done = false;
  private broken = false;
  constructor(readonly taker: ActorId, readonly victim: ActorId) {}

  tick(sim: Sim): TakeTick {
    if (this.done) return 'complete';

    // v12.2 §4 — "Reaching lantern light SAVES you. So does someone else
    // walking in." Once broken, an attempt is dead and stays dead; the taker
    // must call beginTake() again and start the three seconds over.
    //
    // Without this latch the escape only PAUSES the grab: `elapsed` survives,
    // so a victim who reaches light on tick 89 and loses it again is taken on
    // the very next tick of contact — one tick instead of ninety. Escaping
    // would leave you worse off than never having been noticed, which inverts
    // the rule. Measured before this latch existed: baseline completed on tick
    // 90; escape-then-return completed on the tick after the escape.
    if (this.broken) return 'broken';

    const check = canTake(sim, this.taker, this.victim);
    if (!check.ok) {
      this.broken = true;
      sim.setGrabbing(this.taker, false);
      return 'broken';
    }

    // v12.2 §4 — "While the Odd Sock is grabbing you, they move slower than you
    // do. So running actually works." The penalty must be live for the whole
    // attempt, including the warning tick, or the warning buys the victim
    // nothing. Set before the early returns below, cleared on every exit.
    sim.setGrabbing(this.taker, true);

    this.elapsed++;
    const victim = sim.state.actors.find(a => a.id === this.victim)!;

    if (this.elapsed === WARN_AT_TICKS) {
      sim.emitTake('take.warn', this.taker, this.victim, victim.room);
      return 'warned';
    }
    if (this.elapsed >= TAKE_TICKS) {
      victim.alive = false;
      this.done = true;
      sim.setGrabbing(this.taker, false);
      sim.emitTake('take.complete', this.taker, this.victim, victim.room);
      // v12.2 §7 — a muffled noise is heard on that floor
      sim.emitSound('take', victim.room);
      return 'complete';
    }
    return 'progressing';
  }
}

export function beginTake(taker: ActorId, victim: ActorId): TakeAttempt {
  return new TakeAttempt(taker, victim);
}
```

- [ ] **Step 4: Make the grabber slower, and add the emit doors to Sim**

In `v12/src/core/sim.ts`, add the constant beside the other speeds:

```ts
/** v12.2 §4 — the grabber moves slower than their target for the whole attempt.
 *  This is what makes the warning window mean something: a target with somewhere
 *  to run can outpace a grab in progress. */
export const GRAB_SPEED_PENALTY = 0.55;
```

Add `grabbing: boolean;` to `Actor`, initialised `false` in the constructor. In `step`, apply it alongside the carry slowdown:

```ts
      if (actor.carrying === 'lantern') speed *= CARRY_SLOWDOWN;
      if (actor.grabbing) speed *= GRAB_SPEED_PENALTY;
```

Then add these three methods to `Sim`:

```ts
  setGrabbing(id: ActorId, on: boolean): void {
    const a = this.state.actors.find(x => x.id === id);
    if (a) a.grabbing = on;
  }


```ts
  emitTake(kind: 'take.warn' | 'take.complete', actor: ActorId, victim: ActorId, room: RoomId): void {
    this.sink.emit({ kind, tick: this.state.tick, night: this.state.night, actor, victim, room });
  }

  emitSound(sound: 'take' | 'snuff' | 'slip' | 'shed', room: RoomId): void {
    this.sink.emit({
      kind: 'sound', tick: this.state.tick, night: this.state.night,
      floor: roomById(this.house, room).floor, sound, room,
    });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add v12/
git commit -m "feat(v12): the Take, with every §12.1 condition under test"
```

---

## Task 8: The scripted stalker

**Files:**
- Create: `v12/src/scripted/stalker.ts`
- Test: `v12/test/stalker.test.ts`

**Interfaces:**
- Consumes: `Sim`, `Input`, `House`, `makeRng`, `beginTake`, `canTake`
- Produces: `createStalker(house: House, id: ActorId, seed: number): Stalker` with `Stalker { nextInput(sim: Sim): Input; tickBehaviour(sim: Sim): void }`

**Constraint (spec §9.1):** this is a scripted actor, not a policy bot. It exposes **no counters, no metrics, no win-rate API**. If a future task wants a number out of it, that is the signal to stop and read spec §9.1 first.

- [ ] **Step 1: Write the failing test**

`v12/test/stalker.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSim } from '../src/core/sim';
import { createStalker } from '../src/scripted/stalker';
import { HOLLOW } from '../src/house/hollow';

// "type": "module" — no __dirname.
const STALKER_SRC = fileURLToPath(new URL('../src/scripted/stalker.ts', import.meta.url));

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function walk(seed: number, ticks: number) {
  const sim = createSim(HOLLOW, 99, IDS);
  const stalker = createStalker(HOLLOW, 'wren', seed);
  const path: string[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step(new Map([['wren', stalker.nextInput(sim)]]));
    stalker.tickBehaviour(sim);
    path.push(sim.state.actors.find(a => a.id === 'wren')!.room);
  }
  return path;
}

describe('scripted stalker', () => {
  it('follows an identical path for the same seed', () => {
    expect(walk(7, 900)).toEqual(walk(7, 900));
  });

  it('follows a different path for a different seed', () => {
    expect(walk(7, 900)).not.toEqual(walk(8, 900));
  });

  it('actually leaves its starting room', () => {
    expect(new Set(walk(7, 900)).size).toBeGreaterThan(1);
  });

  // spec §9.1 — a scripted actor, never a measurement instrument
  it('exposes no metrics surface', () => {
    const src = readFileSync(STALKER_SRC, 'utf8');
    expect(src).not.toMatch(/winRate|stats|metrics|counter|tally/i);
    const stalker = createStalker(HOLLOW, 'wren', 7);
    expect(Object.keys(stalker).sort()).toEqual(['nextInput', 'tickBehaviour']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/stalker.test.ts`
Expected: FAIL — cannot resolve `../src/scripted/stalker`.

- [ ] **Step 3: Implement**

`v12/src/scripted/stalker.ts`:

```ts
import type { ActorId } from '../core/events';
import { exitsOf, otherSide, roomById, type House, type RoomId } from '../core/house';
import { makeRng } from '../core/rng';
import type { Input, Sim } from '../core/sim';
import { beginTake, canTake, type TakeAttempt } from '../core/take';

export interface Stalker {
  nextInput(sim: Sim): Input;
  tickBehaviour(sim: Sim): void;
}

/** SPEC §9.1: this is a scripted actor and it never produces a number.
 *  It walks a seeded route and attempts a Take when the rules already allow
 *  one. It does not evaluate, score, adapt, or report. If you find yourself
 *  wanting a win rate out of it, that is the signal to read spec §9.1 —
 *  bot defects have mimicked rules defects three times in this repository. */
export function createStalker(house: House, id: ActorId, seed: number): Stalker {
  const rng = makeRng(seed);
  let route: RoomId[] = [];
  let attempt: TakeAttempt | null = null;

  function extendRoute(from: RoomId): void {
    let here = from;
    for (let i = 0; i < 8; i++) {
      const exits = exitsOf(house, here);
      const door = rng.pick(exits);
      here = otherSide(door, here);
      route.push(here);
    }
  }

  return {
    nextInput(sim: Sim): Input {
      const self = sim.state.actors.find(a => a.id === id);
      if (!self?.alive) return { moveX: 0, moveY: 0, run: false };
      if (route.length === 0) extendRoute(self.room);

      const target = route[0]!;
      if (self.room === target) { route.shift(); }

      const next = route[0];
      if (!next) return { moveX: 0, moveY: 0, run: false };

      // Steer toward the door that leads to the next room on the route. If no
      // such door exists the route is stale, so drop it and re-plan next tick.
      const door = exitsOf(house, self.room).find(d => otherSide(d, self.room) === next);
      if (!door) { route = []; return { moveX: 0, moveY: 0, run: false }; }

      const dx = door.at.x - self.at.x, dy = door.at.y - self.at.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return { moveX: 0, moveY: 0, run: false };
      return { moveX: dx / len, moveY: dy / len, run: false };
    },

    tickBehaviour(sim: Sim): void {
      if (attempt) {
        const r = attempt.tick(sim);
        if (r === 'complete' || r === 'broken') attempt = null;
        return;
      }
      const self = sim.state.actors.find(a => a.id === id);
      if (!self?.alive) return;
      for (const other of sim.state.actors) {
        if (other.id === id || !other.alive) continue;
        if (canTake(sim, id, other.id).ok) { attempt = beginTake(id, other.id); return; }
      }
    },
  };
}
```

Also remove the now-unused `roomById` import if the linter flags it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): a scripted stalker that never produces a number"
```

---

## Task 9: The render layer — stage, rooms and the light mask

**Files:**
- Create: `v12/src/render/stage.ts`, `v12/src/render/rooms.ts`, `v12/src/render/lighting.ts`
- Test: `v12/test/lighting.test.ts`

**Interfaces:**
- Consumes: `House`, `Room`, `RoomId`, `SimState`, `LightSource`, `ambientFor`
- Produces:
  - `createStage(el: HTMLElement): Promise<Stage>` where `Stage { app: Application; world: Container; centreOn(p: Vec2): void }`
  - `drawRooms(world: Container, house: House): void`
  - `maskCirclesFor(sources: readonly LightSource[], house: House): MaskCircle[]` where `interface MaskCircle { x: number; y: number; r: number }`
  - `overlayAlphaFor(night: number, room: RoomId, dark: ReadonlySet<RoomId>): number`
  - `drawLighting(layer: Graphics, house: House, night: number, sources: readonly LightSource[], dark: ReadonlySet<RoomId>): void`

The mask **geometry** is a pure function and is tested. The Pixi draw call is not — it is verified by eye in Task 12.

- [ ] **Step 1: Write the failing test**

`v12/test/lighting.test.ts`:

```ts
import { maskCirclesFor, overlayAlphaFor } from '../src/render/lighting';
import { HOLLOW } from '../src/house/hollow';
import { LANTERN_RADIUS } from '../src/core/light';

describe('maskCirclesFor', () => {
  it('produces one circle per source, positioned at the source', () => {
    const circles = maskCirclesFor(
      [{ room: 'kitchen', at: { x: 10, y: 20 }, radius: LANTERN_RADIUS }], HOLLOW);
    expect(circles).toEqual([{ x: 10, y: 20, r: LANTERN_RADIUS }]);
  });

  it('drops sources in rooms the house does not have', () => {
    expect(maskCirclesFor(
      [{ room: 'no_such_room', at: { x: 0, y: 0 }, radius: 50 }], HOLLOW)).toEqual([]);
  });

  it('is empty with no sources', () => {
    expect(maskCirclesFor([], HOLLOW)).toEqual([]);
  });
});

describe('overlayAlphaFor', () => {
  const none = new Set<string>();
  const allDark = new Set(HOLLOW.rooms.map(r => r.id));

  // v12.2 §3 — dark rooms hide who you are; they NEVER hide where the doors
  // are. An alpha of 1 would hide the doors.
  it('never fully blacks out, even in a dark room on night six', () => {
    for (let n = 1; n <= 6; n++) {
      expect(overlayAlphaFor(n, 'kitchen', allDark)).toBeLessThan(1);
      expect(overlayAlphaFor(n, 'kitchen', allDark)).toBeGreaterThanOrEqual(0);
    }
  });

  it('darkens monotonically across the nights', () => {
    for (let n = 2; n <= 6; n++) {
      expect(overlayAlphaFor(n, 'kitchen', allDark))
        .toBeGreaterThanOrEqual(overlayAlphaFor(n - 1, 'kitchen', allDark));
    }
  });

  // The reason it is per room: a player must be able to tell a dark room from
  // a lit one through a doorway, or the escalation is invisible.
  it('makes a dark room visibly darker than a lit one on the same night', () => {
    expect(overlayAlphaFor(4, 'kitchen', allDark))
      .toBeGreaterThan(overlayAlphaFor(4, 'kitchen', none));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/lighting.test.ts`
Expected: FAIL — cannot resolve `../src/render/lighting`.

- [ ] **Step 3: Implement lighting**

`v12/src/render/lighting.ts`:

```ts
import { Graphics } from 'pixi.js';
import { ambientFor, type LightSource } from '../core/light';
import type { House, RoomId } from '../core/house';

export interface MaskCircle { x: number; y: number; r: number }

export function maskCirclesFor(
  sources: readonly LightSource[], house: House,
): MaskCircle[] {
  return sources
    .filter(s => house.rooms.some(r => r.id === s.room))
    .map(s => ({ x: s.at.x, y: s.at.y, r: s.radius }));
}

/** rules §6.2: darkness may conceal identity and detail, but must NEVER
 *  obscure navigation. So the overlay is capped well below opaque — the
 *  room silhouette and its exits stay legible at every night. */
const MAX_OVERLAY = 0.92;

/** Per room, because darkness is per room (v12.2 §13's "almost everywhere").
 *  A dark room and a faintly lit one must look different from a doorway — that
 *  readability is the whole point of slice 0. */
export function overlayAlphaFor(
  night: number, room: RoomId, dark: ReadonlySet<RoomId>,
): number {
  return Math.min((1 - ambientFor(night, room, dark)) * MAX_OVERLAY, MAX_OVERLAY);
}

export function drawLighting(
  layer: Graphics, house: House, night: number,
  sources: readonly LightSource[], dark: ReadonlySet<RoomId>,
): void {
  layer.clear();
  for (const room of house.rooms) {
    layer.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    layer.fill({ color: 0x05040a, alpha: overlayAlphaFor(night, room.id, dark) });
  }

  // Warm pools punched back out of the dark — rules §21's "warm pools of
  // lantern light against cold muted surroundings".
  for (const c of maskCirclesFor(sources, house)) {
    for (let i = 3; i >= 1; i--) {
      layer.circle(c.x, c.y, (c.r / 3) * i);
      layer.fill({ color: 0xffd9a0, alpha: 0.10 * (4 - i) });
    }
  }
}
```

- [ ] **Step 4: Implement stage and rooms**

`v12/src/render/stage.ts`:

```ts
import { Application, Container } from 'pixi.js';
import type { Vec2 } from '../core/geometry';

export interface Stage { app: Application; world: Container; centreOn(p: Vec2): void }

export async function createStage(el: HTMLElement): Promise<Stage> {
  const app = new Application();
  await app.init({ background: 0x0b0a10, resizeTo: window, antialias: true });
  el.appendChild(app.canvas);
  const world = new Container();
  app.stage.addChild(world);
  return {
    app, world,
    centreOn(p) {
      world.x = app.screen.width / 2 - p.x;
      world.y = app.screen.height / 2 - p.y;
    },
  };
}
```

`v12/src/render/rooms.ts`:

```ts
import { Container, Graphics, Text } from 'pixi.js';
import type { House } from '../core/house';

/** rules §6.2: every room needs a distinctive silhouette, clearly visible
 *  exits and one recognisable central object. Placeholder art, real geometry. */
export function drawRooms(world: Container, house: House): void {
  const floor = new Graphics();
  for (const room of house.rooms) {
    floor.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    floor.fill({ color: 0x2a2434 });
    floor.rect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);
    floor.stroke({ color: 0x4a3f57, width: 3 });
  }
  world.addChild(floor);

  const doors = new Graphics();
  for (const d of house.doors) {
    doors.rect(d.at.x - d.span / 2, d.at.y - d.span / 2, d.span, d.span);
    doors.fill({ color: d.kind === 'stair' ? 0x6b5a3e : 0x3d3348 });
  }
  world.addChild(doors);

  for (const room of house.rooms) {
    const label = new Text({
      text: `${room.name}\n${room.centralObject}`,
      style: { fill: 0x8a7f9a, fontSize: 16, align: 'center' },
    });
    label.x = room.bounds.x + 12;
    label.y = room.bounds.y + 12;
    world.addChild(label);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add v12/
git commit -m "feat(v12): the stage, the rooms, and a darkness that never blinds"
```

---

## Task 10: Actor rendering and identity in darkness

**Files:**
- Create: `v12/src/render/actors.ts`
- Test: `v12/test/actors-visibility.test.ts`

**Interfaces:**
- Consumes: `visibilityAt`, `lightAt` from `core/light`; `SimState`, `Sim`
- Produces:
  - `interface ActorAppearance { visibility: Visibility; showName: boolean; saturation: number; alpha: number }`
  - `appearanceOf(sim: Sim, observerId: ActorId, targetId: ActorId): ActorAppearance`
  - `drawActors(layer: Graphics, nameLayer: Container, sim: Sim, observerId: ActorId): void`

**The render layer decides nothing.** `appearanceOf` reads `core`'s `visibilityAt`; it does not re-derive a threshold.

- [ ] **Step 1: Write the failing test**

`v12/test/actors-visibility.test.ts`:

```ts
import { appearanceOf } from '../src/render/actors';
import { createSim } from '../src/core/sim';
import { HOLLOW } from '../src/house/hollow';

const IDS = ['bell', 'pike', 'clem', 'wren', 'sparrow', 'moss'];

function twoInRoom(night: number, lit: boolean) {
  const sim = createSim(HOLLOW, 42, IDS);
  sim.state.night = night;
  const b = HOLLOW.rooms.find(r => r.id === 'attic')!.bounds;
  const spot = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  for (const id of ['bell', 'pike']) {
    const a = sim.state.actors.find(x => x.id === id)!;
    a.room = 'attic'; a.at = { ...spot };
  }
  sim.state.lanterns[0]!.state = lit
    ? { kind: 'placed', room: 'attic', at: { ...spot }, watching: 'd_attic_playroom', lit: true }
    : { kind: 'placed', room: 'shared_bedroom', at: { x: 0, y: 0 }, watching: 'd_bed_hearth', lit: false };
  sim.state.lanterns[1]!.state = { kind: 'placed', room: 'shared_bedroom', at: { x: 0, y: 0 }, watching: 'd_bed_hearth', lit: false };
  return sim;
}

describe('appearanceOf', () => {
  // rules §9 — in deep darkness names disappear and colours desaturate
  it('hides the name and desaturates in an unlit room on night six', () => {
    const a = appearanceOf(twoInRoom(6, false), 'bell', 'pike');
    expect(a.visibility).toBe('silhouette');
    expect(a.showName).toBe(false);
    expect(a.saturation).toBeLessThan(0.5);
  });

  it('shows the name inside lantern light', () => {
    const a = appearanceOf(twoInRoom(6, true), 'bell', 'pike');
    expect(a.visibility).toBe('identified');
    expect(a.showName).toBe(true);
  });

  it('shows the name on night one, before the house darkens', () => {
    expect(appearanceOf(twoInRoom(1, false), 'bell', 'pike').showName).toBe(true);
  });

  // rules §9 — footsteps and movement remain perceptible: a silhouette must
  // still be drawn, never fully transparent
  it('keeps a silhouette visible rather than erasing it', () => {
    expect(appearanceOf(twoInRoom(6, false), 'bell', 'pike').alpha).toBeGreaterThan(0);
  });

  it('reports a target in another room as unseen', () => {
    const sim = twoInRoom(6, false);
    sim.state.actors.find(a => a.id === 'pike')!.room = 'cellar';
    expect(appearanceOf(sim, 'bell', 'pike').visibility).toBe('unseen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/actors-visibility.test.ts`
Expected: FAIL — cannot resolve `../src/render/actors`.

- [ ] **Step 3: Implement**

`v12/src/render/actors.ts`:

```ts
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

/** rules §9: in deep darkness names disappear, pyjama colours desaturate and
 *  silhouettes partially obscure — but footsteps and movement remain
 *  perceptible. The threshold lives in core/light so the server can apply the
 *  same rule authoritatively in slice 2b; this layer only presents it. */
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
    saturation: visibility === 'identified' ? 1 : Math.max(level * 1.2, 0.15),
    alpha: visibility === 'unseen' ? 0 : Math.max(0.45, Math.min(level + 0.45, 1)),
  };
}

function desaturate(colour: number, amount: number): number {
  const r = (colour >> 16) & 0xff, g = (colour >> 8) & 0xff, b = colour & 0xff;
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c: number) => Math.round(grey + (c - grey) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

export function drawActors(
  layer: Graphics, nameLayer: Container, sim: Sim, observerId: ActorId,
): void {
  layer.clear();
  nameLayer.removeChildren();
  for (const actor of sim.state.actors) {
    if (!actor.alive) continue;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): identity dissolves in the dark, decided in core not render"
```

---

## Task 11: Audio, input, and the night scene — slice 0 playable

**Files:**
- Create: `v12/src/audio/sounds.ts`, `v12/src/app/input.ts`, `v12/src/app/scenes/night.ts`, `v12/src/app/main.ts`
- Test: `v12/test/sounds.test.ts`, `v12/test/input.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `soundFor(e: MatchEvent): SoundCue | null` where `type SoundCue = { file: string; volume: number }`
  - `audibleVolume(e: MatchEvent, listenerRoom: RoomId, house: House): number` — the cross-room perception model
  - `playCue(cue: SoundCue, attenuation?: number): void`
  - `createInput(target: Window): { read(): ReadInput; dispose(): void }`
  - `runNightScene(stage: Stage, seed: number, night: number): void`

- [ ] **Step 1: Write the failing sound-mapping test**

`v12/test/sounds.test.ts`:

```ts
import { soundFor, SOUND_FILES, audibleVolume } from '../src/audio/sounds';
import type { MatchEvent } from '../src/core/events';
import { HOLLOW } from '../src/house/hollow';

const SAMPLES: MatchEvent[] = [
  { kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'kitchen', floor: 0, hurried: false },
  { kind: 'move.enter', tick: 1, night: 1, actor: 'bell', room: 'kitchen', via: 'd_hearth_kitchen' },
  { kind: 'lantern.place', tick: 2, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'kitchen', watching: 'd_hearth_kitchen' },
  { kind: 'lantern.snuff', tick: 3, night: 2, actor: 'wren', lantern: 'lantern_a', room: 'kitchen' },
  { kind: 'take.warn', tick: 4, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
  { kind: 'take.complete', tick: 5, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
  { kind: 'sound', tick: 6, night: 2, floor: 1, sound: 'take', room: 'attic' },
];

describe('soundFor', () => {
  // rules §20 — sound carries mechanical information, so every event a player
  // could hear must map to a distinguishable cue
  it('maps every slice-0 event kind to a cue', () => {
    for (const e of SAMPLES) expect(soundFor(e), e.kind).not.toBeNull();
  });

  it('gives the Take and the Snuff distinguishable cues', () => {
    const of = (kind: string) => soundFor(SAMPLES.find(e => e.kind === kind)!)!;
    expect(of('take.complete').file).not.toBe(of('lantern.snuff').file);
  });

  it('references only declared files', () => {
    for (const e of SAMPLES) {
      const cue = soundFor(e);
      if (cue) expect(SOUND_FILES).toContain(cue.file);
    }
  });

  // rules §20 — players must be able to tell hurried movement from careful
  it('makes a hurried footstep louder than a careful one', () => {
    const step = (hurried: boolean): MatchEvent =>
      ({ kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'kitchen', floor: 0, hurried });
    expect(soundFor(step(true))!.volume).toBeGreaterThan(soundFor(step(false))!.volume);
  });
});

describe('audibleVolume', () => {
  const step: MatchEvent =
    { kind: 'step', tick: 0, night: 1, actor: 'bell', room: 'kitchen', floor: 0, hurried: false };

  it('is full in the same room', () => {
    expect(audibleVolume(step, 'kitchen', HOLLOW)).toBe(1);
  });

  // This is what makes the dark house feel occupied: sight stops at the room
  // boundary, so hearing is the only channel that crosses one.
  it('carries into an adjacent room, quieter', () => {
    const v = audibleVolume(step, 'hearth', HOLLOW);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('carries faintly across the same floor', () => {
    const near = audibleVolume(step, 'hearth', HOLLOW);
    const far = audibleVolume(step, 'cellar', HOLLOW);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
  });

  // rules §12.1 — a Take is audible on that floor, not through it
  it('does not carry between floors', () => {
    expect(audibleVolume(step, 'attic', HOLLOW)).toBe(0);
  });
});
```

- [ ] **Step 2: Write the failing input test**

`v12/test/input.test.ts`:

```ts
import { inputFromKeys } from '../src/app/input';

describe('inputFromKeys', () => {
  it('is neutral with nothing held', () => {
    expect(inputFromKeys(new Set())).toMatchObject({ moveX: 0, moveY: 0, run: false });
  });

  it('maps WASD and arrows to the same axes', () => {
    expect(inputFromKeys(new Set(['KeyW'])).moveY).toBe(-1);
    expect(inputFromKeys(new Set(['ArrowUp'])).moveY).toBe(-1);
    expect(inputFromKeys(new Set(['KeyD'])).moveX).toBe(1);
  });

  it('cancels opposing keys instead of drifting', () => {
    expect(inputFromKeys(new Set(['KeyA', 'KeyD'])).moveX).toBe(0);
  });

  it('reads shift as run', () => {
    expect(inputFromKeys(new Set(['ShiftLeft'])).run).toBe(true);
  });

  it('maps the door and hide keys added in Task 5A', () => {
    expect(inputFromKeys(new Set(['KeyF'])).action).toBe('door');
    expect(inputFromKeys(new Set(['KeyC'])).action).toBe('hide');
  });

  it('resolves two action keys the same way every time', () => {
    const held = new Set(['KeyF', 'KeyE']);
    expect(inputFromKeys(held).action).toBe('interact');
    expect(inputFromKeys(held).action).toBe('interact');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd v12 && npx vitest run test/sounds.test.ts test/input.test.ts`
Expected: FAIL — modules unresolved.

- [ ] **Step 4: Implement audio and input**

`v12/src/audio/sounds.ts`:

```ts
import type { MatchEvent } from '../core/events';
import { exitsOf, otherSide, type House, type RoomId } from '../core/house';

export type SoundCue = { file: string; volume: number };

/** rules §20 — players must learn to distinguish these by ear. Placeholder
 *  files for slice 0; the sound language itself is slice 4. */
export const SOUND_FILES = [
  'step.wav', 'door.wav', 'lantern-set.wav', 'lantern-out.wav',
  'lantern-lit.wav', 'breath.wav', 'take.wav', 'muffled.wav',
] as const;

export function soundFor(e: MatchEvent): SoundCue | null {
  switch (e.kind) {
    case 'step':            return { file: 'step.wav', volume: e.hurried ? 0.5 : 0.3 };
    case 'move.enter':      return { file: 'door.wav', volume: 0.5 };
    case 'door.toggle':     return { file: 'door.wav', volume: 0.4 };
    case 'lantern.carry':   return { file: 'lantern-set.wav', volume: 0.3 };
    case 'lantern.place':   return { file: 'lantern-set.wav', volume: 0.6 };
    case 'lantern.snuff':   return { file: 'lantern-out.wav', volume: 0.8 };
    case 'lantern.relight': return { file: 'lantern-lit.wav', volume: 0.6 };
    case 'take.warn':       return { file: 'breath.wav', volume: 0.9 };
    case 'take.complete':   return { file: 'take.wav', volume: 1.0 };
    case 'sound':           return { file: 'muffled.wav', volume: 0.7 };
    default:                return null;
  }
}

/** How loud an event is to a listener standing in `listenerRoom`.
 *
 *  This is the whole cross-room perception model for slice 0, and it is what
 *  makes the dark house feel occupied rather than empty. rules §9 keeps
 *  footsteps perceptible in deep darkness; §12.1 makes a Take audible on its
 *  floor. Sight stops at the room boundary, so hearing is the only channel
 *  that crosses one. */
export function audibleVolume(
  e: MatchEvent, listenerRoom: RoomId, house: House,
): number {
  const room = 'room' in e ? e.room : null;
  if (!room) return 1;
  if (room === listenerRoom) return 1;

  const adjacent = exitsOf(house, listenerRoom)
    .some(d => otherSide(d, listenerRoom) === room);
  if (adjacent) return 0.45;

  // rules §12.1 — a Take is audible on that floor, but not through it.
  const here = house.rooms.find(r => r.id === listenerRoom);
  const there = house.rooms.find(r => r.id === room);
  if (here && there && here.floor === there.floor) return 0.15;
  return 0;
}

export function playCue(cue: SoundCue, attenuation = 1): void {
  const volume = cue.volume * attenuation;
  if (volume <= 0.01) return;
  const a = new Audio(`/sfx/${cue.file}`);
  a.volume = Math.min(volume, 1);
  void a.play().catch(() => { /* autoplay policy; ignored until first input */ });
}
```

`v12/src/app/input.ts`:

```ts
import type { Input } from '../core/sim';

export type UiAction = 'place' | 'pickup' | 'interact' | 'door' | 'hide' | null;
export interface ReadInput extends Input { action: UiAction }

/** Keys are checked in a fixed order so that two held at once resolve the same
 *  way every frame — determinism reaches all the way out to the keyboard. */
export function inputFromKeys(held: ReadonlySet<string>): ReadInput {
  const axis = (neg: string[], pos: string[]) =>
    (pos.some(k => held.has(k)) ? 1 : 0) - (neg.some(k => held.has(k)) ? 1 : 0);
  const action: UiAction =
    held.has('KeyE') ? 'interact' :
    held.has('KeyQ') ? 'place' :
    held.has('KeyF') ? 'door' :
    held.has('KeyC') ? 'hide' : null;
  return {
    moveX: axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
    moveY: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    run: held.has('ShiftLeft') || held.has('ShiftRight'),
    action,
  };
}

export function createInput(target: Window): { read(): ReadInput; dispose(): void } {
  const held = new Set<string>();
  const down = (e: KeyboardEvent) => held.add(e.code);
  const up = (e: KeyboardEvent) => held.delete(e.code);
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return {
    read: () => inputFromKeys(held),
    dispose: () => { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); },
  };
}
```

- [ ] **Step 5: Implement the night scene and entry point**

`v12/src/app/scenes/night.ts`:

```ts
import { Container, Graphics } from 'pixi.js';
import { audibleVolume, playCue, soundFor } from '../../audio/sounds';
import { exitsOf } from '../../core/house';
import { applyLanternAction } from '../../core/lantern';
import { createSim, DT, type Input, type Sim } from '../../core/sim';
import { HOLLOW } from '../../house/hollow';
import { drawActors } from '../../render/actors';
import { drawLighting } from '../../render/lighting';
import { drawRooms } from '../../render/rooms';
import type { Stage } from '../../render/stage';
import { createStalker } from '../../scripted/stalker';
import { createInput, type UiAction } from '../input';

const PLAYER = 'bell';
const STALKER = 'wren';
const IDS = [PLAYER, 'pike', 'clem', STALKER, 'sparrow', 'moss'];

/** The one place the scene translates a keypress into a rule. Every branch
 *  calls a core action that already validates itself, so an illegal press is
 *  a no-op rather than a special case here. */
function dispatch(sim: Sim, room: string, action: UiAction): void {
  switch (action) {
    case 'hide':
      sim.beginHide(PLAYER);
      break;
    case 'door': {
      const door = exitsOf(HOLLOW, room)[0];
      if (door) sim.toggleDoor(PLAYER, door.id);
      break;
    }
    case 'interact': {
      const held = sim.state.lanterns.find(
        l => l.state.kind === 'held' && l.state.by === PLAYER);
      if (held) break;
      const here = sim.state.lanterns.find(
        l => l.state.kind === 'placed' && l.state.room === room);
      if (here) applyLanternAction(sim, PLAYER, { kind: 'pickup', lantern: here.id });
      break;
    }
    case 'place': {
      const door = exitsOf(HOLLOW, room)[0];
      if (door) applyLanternAction(sim, PLAYER, { kind: 'place', watching: door.id });
      break;
    }
    default:
      break;
  }
}

export function runNightScene(stage: Stage, seed: number, night: number): void {
  const sim = createSim(HOLLOW, seed, IDS);
  sim.state.night = night;
  const stalker = createStalker(HOLLOW, STALKER, seed ^ 0x5eed);
  const input = createInput(window);

  drawRooms(stage.world, HOLLOW);
  const lighting = new Graphics();
  const actors = new Graphics();
  const names = new Container();
  stage.world.addChild(lighting, actors, names);

  let accumulator = 0;
  let lastAction: string | null = null;

  stage.app.ticker.add(ticker => {
    accumulator += ticker.deltaMS / 1000;
    while (accumulator >= DT) {
      accumulator -= DT;
      const mine = input.read();

      // Edge-triggered: fire once per press, not once per tick.
      if (mine.action !== lastAction) {
        const me = sim.state.actors.find(a => a.id === PLAYER);
        if (me && mine.action) dispatch(sim, me.room, mine.action);
        lastAction = mine.action;
      }

      const inputs = new Map<string, Input>();
      inputs.set(PLAYER, mine);
      inputs.set(STALKER, stalker.nextInput(sim));
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
```

`v12/src/app/main.ts`:

```ts
import { createStage } from '../render/stage';
import { runNightScene } from './scenes/night';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1234);
const night = Number(params.get('night') ?? 6);

createStage(document.body).then(stage => runNightScene(stage, seed, night));
```

- [ ] **Step 6: Run tests and the app**

Run: `cd v12 && npm test` — expected PASS.
Run: `cd v12 && npm run dev`, open the browser, and walk the house with WASD. Try `?night=1` and `?night=6`.

Controls: **WASD/arrows** move, **Shift** runs, **E** picks up a lantern, **Q** places one, **F** toggles the nearest door, **C** hides.

- [ ] **Step 7: Record the slice 0 acceptance pass**

Create `docs/findings/2026-07-29-slice-0-acceptance.md` and answer each spec §4 criterion in writing, **including the ones that fail**:

1. **Navigation survives.** Traverse all ten rooms and both stairs at `?night=6` without a minimap. Pass/fail.
2. **Identity does not.** Stand at the far corner of a room from another child at `?night=6`, unlit. You must **not** be able to tell which child it is — while the silhouette stays visible. Pass/fail.
   *(Stated in terms of within-room distance deliberately: sight stops at the room boundary, so "three room-widths" would be measuring an actor that is not drawn at all.)*
3. **The house sounds occupied through a wall.** Stand still in one room while another child moves in an adjacent one. You must be able to hear that someone is moving, without being able to tell who. Pass/fail.
4. A placed lantern visibly changes what is knowable about a doorway. Pass/fail.
5. The Take fires, warns, and can be escaped by reaching lantern light. Pass/fail.
6. `npm test` green, including determinism.

Run criterion 2 **in a room that is dark tonight** — darkness is per room now (v12.2 §13), so a faintly lit room hiding nobody's face is correct behaviour, not a failure. If it fails in a dark room, tune `DARK_AMBIENT_BY_NIGHT` and `MAX_OVERLAY`, never the criterion. If criterion 3 fails, the game has no cross-room perception at all, and darkness will read as emptiness rather than threat.

- [ ] **Step 8: Commit**

```bash
git add v12/ docs/findings/2026-07-29-slice-0-acceptance.md
git commit -m "feat(v12): slice 0 — a house you can walk in the dark"
```

---

## Task 12: Pin the match-log schema and the identity-stripping projection

**Slice 1 begins here.**

**Files:**
- Create: `v12/src/log/schema.ts`, `v12/src/log/project.ts`
- Modify: `v12/src/log/index.ts` (re-export)
- Test: `v12/test/project.test.ts`

**Interfaces:**
- Consumes: `MatchEvent`, `ActorId`, `RoomId` from `core`
- Produces:
  - `interface MatchLog { seed: number; house: string; events: MatchEvent[] }`
  - `interface LanternRecord { room: RoomId; crossings: number; outward: number; hurried: boolean; moved: boolean }`
  - `interface HouseProjection { night: number; didNotReturn: ActorId[]; flamesLost: number; flamesRemaining: number; lanternRecords: LanternRecord[]; socksSecured: number; roomsDisturbed: RoomId[]; floorSounds: { floor: number; sound: SoundKind }[]; crowded: boolean }` — **v12.2 §8's list exactly.** `inactivityFloor`, `ghostDisturbances` and `midnightRoom` were cut in v12.1 and must not reappear
  - `type ClaimId = string`; every `Claim` carries `id`, because v12.2 §8's fifth mark type (`deny`) has to point at one
  - `projectForHouse(log: MatchLog, night: number): HouseProjection`

**The projection's type is the enforcement mechanism** for Global Constraint 4. `HouseProjection` carries `ActorId` in exactly one field — `didNotReturn`, which rules §13.1 explicitly grants.

- [ ] **Step 1: Write the failing test**

`v12/test/project.test.ts`:

```ts
import { projectForHouse, type MatchLog } from '../src/log/project';
import type { MatchEvent } from '../src/core/events';

function log(events: MatchEvent[]): MatchLog {
  return { seed: 1, house: 'HOLLOW', events };
}

describe('projectForHouse', () => {
  it('reports who did not return — the one identity §13.1 grants', () => {
    const p = projectForHouse(log([
      { kind: 'take.complete', tick: 10, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
    ]), 2);
    expect(p.didNotReturn).toEqual(['pike']);
  });

  it('never carries the taker', () => {
    const p = projectForHouse(log([
      { kind: 'take.complete', tick: 10, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
    ]), 2);
    expect(JSON.stringify(p)).not.toContain('wren');
  });

  it('reduces lantern traffic to counts and directions, never names', () => {
    const p = projectForHouse(log([
      { kind: 'lantern.place', tick: 1, night: 3, actor: 'bell', lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
      { kind: 'move.enter', tick: 5, night: 3, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },
      { kind: 'move.enter', tick: 8, night: 3, actor: 'moss', room: 'music_room', via: 'd_music_playroom' },
    ]), 3);
    const rec = p.lanternRecords.find(r => r.room === 'music_room')!;
    expect(rec.crossings).toBe(2);
    expect(JSON.stringify(p.lanternRecords)).not.toContain('clem');
    expect(JSON.stringify(p.lanternRecords)).not.toContain('moss');
  });

  it('counts flames lost in that night only', () => {
    const p = projectForHouse(log([
      { kind: 'flame.out', tick: 1, night: 2, reason: 'take', remaining: 4 },
      { kind: 'flame.out', tick: 1, night: 3, reason: 'snuff', remaining: 3 },
    ]), 3);
    expect(p.flamesLost).toBe(1);
    expect(p.flamesRemaining).toBe(3);
  });

  // Flames remaining is a stock and must carry across quiet nights.
  it('carries flames remaining through a night that lost none', () => {
    const l = log([
      { kind: 'flame.out', tick: 1, night: 2, reason: 'take', remaining: 4 },
      { kind: 'flame.out', tick: 1, night: 5, reason: 'snuff', remaining: 3 },
    ]);
    expect(projectForHouse(l, 1).flamesRemaining).toBe(5);
    expect(projectForHouse(l, 2).flamesRemaining).toBe(4);
    expect(projectForHouse(l, 3).flamesRemaining).toBe(4);  // quiet night, still 4
    expect(projectForHouse(l, 4).flamesRemaining).toBe(4);
    expect(projectForHouse(l, 5).flamesRemaining).toBe(3);
    expect(projectForHouse(l, 3).flamesLost).toBe(0);
  });

  // Carried over from Task 3's review: nothing anywhere uses 'crowd' as a value,
  // so neither tsc nor vitest would notice it being deleted from FlameReason —
  // and v12.2 §14's notice is the reason it must stay reachable while staying
  // unimplemented. This is the guard.
  it('still accepts a crowd flame in the log, while no code produces one', () => {
    const p = projectForHouse(log([
      { kind: 'flame.out', tick: 1, night: 5, reason: 'crowd', remaining: 4 },
    ]), 5);
    expect(p.flamesLost).toBe(1);
    expect(p.flamesRemaining).toBe(4);
  });

  it('reports floor-level sounds without the room that made them', () => {
    const p = projectForHouse(log([
      { kind: 'sound', tick: 4, night: 2, floor: 1, sound: 'take', room: 'attic' },
    ]), 2);
    expect(p.floorSounds).toEqual([{ floor: 1, sound: 'take' }]);
    expect(JSON.stringify(p.floorSounds)).not.toContain('attic');
  });

  // v12.2 §8 — "whether the children crowded together", as a bare boolean.
  it('reduces a crowd to a boolean, keeping neither the room nor the names', () => {
    const p = projectForHouse(log(['clem', 'moss', 'sparrow'].map((actor, i) => ({
      kind: 'move.enter' as const, tick: 10 + i, night: 5, actor,
      room: 'library', via: 'd_hearth_library',
    }))), 5);
    expect(p.crowded).toBe(true);
    expect(JSON.stringify(p)).not.toContain('library');
    expect(JSON.stringify(p)).not.toContain('clem');
  });

  it('is not crowded at two', () => {
    const p = projectForHouse(log(['clem', 'moss'].map((actor, i) => ({
      kind: 'move.enter' as const, tick: 10 + i, night: 5, actor,
      room: 'library', via: 'd_hearth_library',
    }))), 5);
    expect(p.crowded).toBe(false);
  });

  // Cut in v12.1: the floor report leaked the villain by elimination, and
  // Midnight was "a beat, not a mechanic". Neither may come back.
  it('carries no inactivity floor and no Midnight room', () => {
    const p = projectForHouse(log([]), 4) as Record<string, unknown>;
    expect(p['inactivityFloor']).toBeUndefined();
    expect(p['midnightRoom']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/project.test.ts`
Expected: FAIL — cannot resolve `../src/log/project`.

- [ ] **Step 3: Implement**

`v12/src/log/schema.ts`:

```ts
import type { ActorId, MatchEvent, SockId } from '../core/events';
import type { RoomId } from '../core/house';

export interface MatchLog { seed: number; house: string; events: MatchEvent[] }

export type ClaimId = string;

/** v12.2 §8 — one mark per living player per morning, permanent and public for
 *  the rest of the game. Five kinds, not four: `deny` is new in v12.1, and §15
 *  gives the reason — the board "had four ways to make a claim and no way to say
 *  'that's not true,' so it couldn't actually hold an argument."
 *
 *  Every claim carries an `id` because `deny` has to point at one. */
interface ClaimBase { id: ClaimId; night: number; by: ActorId }

export type Claim =
  | (ClaimBase & { kind: 'player-room';   subject: ActorId; room: RoomId })
  | (ClaimBase & { kind: 'player-player'; subject: ActorId; object: ActorId })
  | (ClaimBase & { kind: 'player-sock';   subject: ActorId; sock: SockId })
  | (ClaimBase & { kind: 'room-incident'; room: RoomId; incident: string })
  | (ClaimBase & { kind: 'deny';          denies: ClaimId });
```

`v12/src/log/project.ts`:

```ts
import type { ActorId, SoundKind } from '../core/events';
import type { RoomId } from '../core/house';
import type { MatchLog } from './schema';

export type { MatchLog };

export interface LanternRecord {
  room: RoomId; crossings: number; outward: number; hurried: boolean; moved: boolean;
}

/** GLOBAL CONSTRAINT: this type is the enforcement mechanism for rules §13.1's
 *  voice rule. It carries ActorId in exactly ONE field — didNotReturn — which
 *  §13.1 explicitly grants. renderReport() takes only this, so it cannot leak
 *  a name it was never given. Do not add an identity-bearing field here
 *  without re-reading §13.1 and spec §3.3. */
export interface HouseProjection {
  night: number;
  didNotReturn: ActorId[];
  flamesLost: number;
  flamesRemaining: number;
  lanternRecords: LanternRecord[];
  socksSecured: number;
  roomsDisturbed: RoomId[];
  floorSounds: { floor: number; sound: SoundKind }[];
  /** v12.2 §8 — "whether the children crowded together". A boolean, deliberately:
   *  naming the room would leak who was in it, and the count is what §14 prices.
   *  §14 itself is parked, so this reports and costs nothing. */
  crowded: boolean;
}
// Cut in v12.2 and deliberately absent: `inactivityFloor` (§15 cuts the floor
// report — it let a standing group binary-search the villain, one bit a night,
// and could not be computed without leaking who they were), `midnightRoom`
// (Midnight is cut — "a beat, not a mechanic"), and `ghostDisturbances`
// (no longer in §8's report list).

export function projectForHouse(log: MatchLog, night: number): HouseProjection {
  const nightly = log.events.filter(e => e.night === night);

  const didNotReturn: ActorId[] = [];
  const roomsDisturbed = new Set<RoomId>();
  const floorSounds: { floor: number; sound: SoundKind }[] = [];
  const watched = new Map<RoomId, { doors: Set<string>; moved: boolean }>();
  const crossings = new Map<RoomId, number>();
  let flamesLost = 0;
  let socksSecured = 0;

  // Flames are a STOCK; flames lost is a FLOW. What remains carries across
  // nights — computing it from this night's events alone reports five on
  // every quiet night. This repository has made exactly this stock-for-flow
  // substitution before; do not collapse these two loops.
  let flamesRemaining = 5;
  for (const e of log.events) {
    if (e.kind === 'flame.out' && e.night <= night) flamesRemaining = e.remaining;
  }

  for (const e of nightly) {
    switch (e.kind) {
      case 'take.complete':
        didNotReturn.push(e.victim);
        roomsDisturbed.add(e.room);
        break;
      case 'flame.out':
        flamesLost++;
        break;
      case 'sound':
        floorSounds.push({ floor: e.floor, sound: e.sound });
        break;
      case 'sock.secure':
        socksSecured++;
        break;
      case 'lantern.place': {
        const rec = watched.get(e.room) ?? { doors: new Set<string>(), moved: false };
        if (e.watching) rec.doors.add(e.watching);
        watched.set(e.room, rec);
        break;
      }
      case 'lantern.carry': {
        const rec = watched.get(e.room);
        if (rec) rec.moved = true;
        break;
      }
      case 'lantern.snuff':
        roomsDisturbed.add(e.room);
        break;
      default:
        break;
    }
  }

  // rules §10.3 — a lantern reports how many figures crossed its watched
  // doorway. It never reports names, so only the count survives projection.
  for (const e of nightly) {
    if (e.kind !== 'move.enter') continue;
    for (const [room, rec] of watched) {
      if (rec.doors.has(e.via)) crossings.set(room, (crossings.get(room) ?? 0) + 1);
    }
  }

  const lanternRecords: LanternRecord[] = [...watched].map(([room, rec]) => ({
    room,
    crossings: crossings.get(room) ?? 0,
    outward: 0,
    hurried: false,
    moved: rec.moved,
  }));

  // v12.2 §8 — "whether the children crowded together". Three or more bodies
  // ending the night in one room. Reported, never priced: §14 is parked.
  const endedIn = new Map<RoomId, number>();
  for (const e of nightly) {
    if (e.kind !== 'move.enter') continue;
    endedIn.set(e.room, (endedIn.get(e.room) ?? 0) + 1);
  }
  const crowded = [...endedIn.values()].some(n => n >= 3);

  return {
    night,
    didNotReturn,
    flamesLost,
    flamesRemaining,
    lanternRecords,
    socksSecured,
    roomsDisturbed: [...roomsDisturbed],
    floorSounds,
    crowded,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): pin the log, and make §13.1's voice rule a type"
```

---

## Task 13: The house report, and the voice rule under test

**Files:**
- Create: `v12/src/log/report.ts`
- Test: `v12/test/report.test.ts`

**Interfaces:**
- Consumes: `HouseProjection`, `projectForHouse`, `House`
- Produces: `renderReport(p: HouseProjection, house: House): string[]`

- [ ] **Step 1: Write the failing test**

The second test here is the point of the whole task. `v12/test/report.test.ts`:

```ts
import { renderReport } from '../src/log/report';
import { projectForHouse } from '../src/log/project';
import type { MatchLog } from '../src/log/schema';
import type { MatchEvent } from '../src/core/events';
import { HOLLOW } from '../src/house/hollow';

const log = (events: MatchEvent[]): MatchLog => ({ seed: 1, house: 'HOLLOW', events });

describe('renderReport', () => {
  // rules §13.1 — the house reports facts and never interprets, in this order
  it('reads out in §13.1 order', () => {
    const lines = renderReport(projectForHouse(log([
      { kind: 'take.complete', tick: 1, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
      { kind: 'flame.out', tick: 2, night: 2, reason: 'take', remaining: 4 },
      { kind: 'sound', tick: 3, night: 2, floor: 1, sound: 'take', room: 'attic' },
    ]), 2), HOLLOW);
    const text = lines.join('\n');
    expect(text.indexOf('did not return')).toBeLessThan(text.indexOf('flame'));
    expect(text.indexOf('flame')).toBeLessThan(text.indexOf('sound'));
  });

  // rules §13.1 VOICE RULE — the house's phrasing depends only on the room and
  // the night, never on who was standing in it. This is the test that makes
  // that rule real.
  it('produces identical text when only the identities differ', () => {
    const shape = (a: string, b: string, c: string): MatchEvent[] => ([
      { kind: 'lantern.place', tick: 1, night: 3, actor: a, lantern: 'lantern_a', room: 'music_room', watching: 'd_music_playroom' },
      { kind: 'move.enter', tick: 5, night: 3, actor: b, room: 'playroom', via: 'd_music_playroom' },
      { kind: 'move.enter', tick: 9, night: 3, actor: c, room: 'music_room', via: 'd_music_playroom' },
      { kind: 'sound', tick: 12, night: 3, floor: 1, sound: 'snuff', room: 'music_room' },
    ]);
    const one = renderReport(projectForHouse(log(shape('bell', 'pike', 'clem')), 3), HOLLOW);
    const two = renderReport(projectForHouse(log(shape('moss', 'wren', 'sparrow')), 3), HOLLOW);
    expect(one).toEqual(two);
  });

  it('names a child who did not return, because §13.1 grants exactly that', () => {
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

  // §13.1 reads the flame count out every morning, not only when one went out
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/report.test.ts`
Expected: FAIL — cannot resolve `../src/log/report`.

- [ ] **Step 3: Implement**

`v12/src/log/report.ts`:

```ts
import { roomById, type House } from '../core/house';
import type { HouseProjection } from './project';

const FLOOR_WORD = ['downstairs', 'upstairs'] as const;

/** v12.2 §8 — the house reports facts, never opinions, in this order:
 *  who didn't come back, how many flames are left, what the lanterns saw,
 *  which socks got secured, which rooms were disturbed, which floor a noise
 *  came from, whether the children crowded together.
 *
 *  It takes a HouseProjection and nothing else. That type carries no identity
 *  but didNotReturn, so §8's voice rule — "the house never says anything that
 *  depends on who someone is" — holds by construction. */
export function renderReport(p: HouseProjection, house: House): string[] {
  const lines: string[] = [];
  const name = (id: string) => roomById(house, id).name;

  for (const child of p.didNotReturn) {
    lines.push(`${child} did not return.`);
  }

  // §13.1 lists "flames lost, and how many remain" among the things the house
  // reads out EVERY morning, so this line is unconditional. A quiet night that
  // silently omitted the count would let the children lose track of the clock.
  lines.push(
    p.flamesLost === 0 ? `No flame went out. ${p.flamesRemaining} remain.`
    : p.flamesLost === 1 ? `One flame went out. ${p.flamesRemaining} remain.`
    : `${p.flamesLost} flames went out. ${p.flamesRemaining} remain.`);

  for (const rec of p.lanternRecords) {
    const head = `The ${name(rec.room)} lantern`;
    if (rec.crossings === 0) {
      lines.push(`${head} watched an empty doorway.`);
    } else {
      lines.push(`${head} watched ${rec.crossings === 1 ? 'one figure' : `${rec.crossings} figures`} cross.`);
    }
    if (rec.moved) lines.push(`${head} was moved.`);
  }

  if (p.socksSecured > 0) {
    lines.push(p.socksSecured === 1
      ? 'One sock was secured.'
      : `${p.socksSecured} socks were secured.`);
  }

  for (const room of p.roomsDisturbed) {
    lines.push(`Something was disturbed in the ${name(room)}.`);
  }

  for (const s of p.floorSounds) {
    lines.push(`A noise came from ${FLOOR_WORD[s.floor] ?? 'somewhere'}.`);
  }

  // v12.2 §8's last line. It says a crowd happened, never where or who —
  // naming the room would identify everyone standing in it.
  if (p.crowded) lines.push('The children crowded together.');

  // The flame line always prints, so "nothing happened" means one line only.
  if (lines.length === 1) lines.push('The house stayed dark. The house saw nothing.');
  return lines;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS. If the voice-rule test fails, an identity has leaked into the projection — fix the projection, never the test.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): the house report, and a test that makes the voice rule real"
```

---

## Task 14: The hand-authored six-night fixture

**Files:**
- Create: `v12/src/log/fixture.ts`
- Test: `v12/test/fixture.test.ts`

**Interfaces:**
- Consumes: `MatchLog`, `Claim`, `projectForHouse`, `renderReport`
- Produces: `SIX_NIGHT_MATCH: MatchLog`, `SIX_NIGHT_CLAIMS: Claim[]`

Spec §5 requires the fixture to contain **a Displace, a failed Call, and a claim-board contradiction**.

- [ ] **Step 1: Write the failing test**

`v12/test/fixture.test.ts`:

```ts
import { SIX_NIGHT_MATCH, SIX_NIGHT_CLAIMS } from '../src/log/fixture';
import { projectForHouse } from '../src/log/project';
import { renderReport } from '../src/log/report';
import { HOLLOW } from '../src/house/hollow';

describe('SIX_NIGHT_MATCH', () => {
  it('covers six nights', () => {
    expect(new Set(SIX_NIGHT_MATCH.events.map(e => e.night))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/fixture.test.ts`
Expected: FAIL — cannot resolve `../src/log/fixture`.

- [ ] **Step 3: Implement**

`v12/src/log/fixture.ts`:

```ts
import type { MatchEvent } from '../core/events';
import type { Claim, MatchLog } from './schema';

/** A hand-authored six-night match. Nobody has played v12, so this is
 *  invented rather than recorded — it exists to exercise the report and the
 *  claim board (spec §5), not to assert anything about balance. It must never
 *  be treated as data. */
const events: MatchEvent[] = [
  // Night 1 — v12.2 §13: the Odd Sock cannot grab on Night One. Lanterns get
  // placed, that is all.
  { kind: 'move.enter', tick: 30, night: 1, actor: 'bell', room: 'hearth', via: 'd_bed_hearth' },
  { kind: 'lantern.place', tick: 60, night: 1, actor: 'bell', lantern: 'lantern_a', room: 'hearth', watching: 'd_hearth_library' },
  { kind: 'move.enter', tick: 75, night: 1, actor: 'clem', room: 'kitchen', via: 'd_hearth_kitchen' },

  // Night 2 — the first grab, in the attic. A noise on the upper floor.
  { kind: 'move.enter', tick: 120, night: 2, actor: 'pike', room: 'attic', via: 'd_attic_playroom' },
  { kind: 'take.complete', tick: 200, night: 2, actor: 'wren', victim: 'pike', room: 'attic' },
  { kind: 'sock.spawn', tick: 201, night: 2, sock: 'sock_1', room: 'attic', source: 'take' },
  { kind: 'flame.out', tick: 202, night: 2, reason: 'take', remaining: 4 },
  { kind: 'sound', tick: 203, night: 2, floor: 1, sound: 'take', room: 'attic' },

  // Night 3 — the villain does nothing (quiet night 1 of 2). sock_1 was still
  // lying in the attic from Night Two (v12.2 §6: socks stay put), and sparrow
  // finds AND boards it inside the same night — v12.2 §6's latency-zero pin,
  // the rule that decides whether the children ever reach an accusation.
  { kind: 'sock.pickup', tick: 265, night: 3, actor: 'sparrow', sock: 'sock_1', room: 'attic' },
  { kind: 'move.enter', tick: 290, night: 3, actor: 'sparrow', room: 'shared_bedroom', via: 's_attic_bedroom' },
  { kind: 'sock.secure', tick: 310, night: 3, actor: 'sparrow', sock: 'sock_1', room: 'shared_bedroom' },
  { kind: 'lantern.place', tick: 340, night: 3, actor: 'moss', lantern: 'lantern_b', room: 'music_room', watching: 'd_music_playroom' },
  { kind: 'move.enter', tick: 350, night: 3, actor: 'clem', room: 'playroom', via: 'd_music_playroom' },

  // Night 4 — quiet night 2 of 2, so v12.2 §7 sheds a sock into the exact room
  // the villain is standing in. No flame. This is the leak that prices hiding.
  { kind: 'sock.spawn', tick: 430, night: 4, sock: 'sock_2', room: 'library', source: 'shed' },
  { kind: 'sound', tick: 431, night: 4, floor: 0, sound: 'shed', room: 'library' },

  // Night 5 — a snuff, and the children crowd. The crowd is reported (v12.2 §8)
  // and costs nothing: §14 is parked.
  { kind: 'move.enter', tick: 505, night: 5, actor: 'moss', room: 'library', via: 'd_hearth_library' },
  { kind: 'move.enter', tick: 512, night: 5, actor: 'clem', room: 'library', via: 'd_cellar_library' },
  { kind: 'move.enter', tick: 520, night: 5, actor: 'sparrow', room: 'library', via: 'd_library_consv' },
  { kind: 'sock.pickup', tick: 530, night: 5, actor: 'moss', sock: 'sock_2', room: 'library' },
  { kind: 'lantern.snuff', tick: 540, night: 5, actor: 'wren', lantern: 'lantern_b', room: 'music_room' },
  { kind: 'sock.spawn', tick: 541, night: 5, sock: 'sock_3', room: 'music_room', source: 'snuff' },
  { kind: 'flame.out', tick: 542, night: 5, reason: 'snuff', remaining: 3 },
  { kind: 'sound', tick: 543, night: 5, floor: 1, sound: 'snuff', room: 'music_room' },
  { kind: 'sock.secure', tick: 580, night: 5, actor: 'moss', sock: 'sock_2', room: 'shared_bedroom' },

  // Night 6 — two secured socks bought an accusation. It named the wrong child.
  // v12.2 §10: that costs ONE sock and one flame, not both socks — so the board
  // keeps sock_1 and the children are one sock from trying again.
  { kind: 'flame.out', tick: 620, night: 6, reason: 'wrong-call', remaining: 2 },
];

export const SIX_NIGHT_MATCH: MatchLog = { seed: 4242, house: 'HOLLOW', events };

/** One mark per living player per morning (v12.2 §8). Two things are planted
 *  here on purpose, and both are what slice 1 exists to make visible:
 *
 *  - **A self-contradiction.** bell puts wren in the hearth on night 2, the
 *    attic on night 3, and the cellar on night 5. Same author, same subject,
 *    three rooms.
 *  - **A denial.** clem spends their entire night-4 mark saying bell's night-3
 *    claim is false. That is the fifth mark type, new in v12.1 — before it, the
 *    board had four ways to assert and no way to disagree. */
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
```

Note: `bell`'s night-3 and night-5 claims both place `wren`, in different rooms, on different nights — which is not itself a contradiction. The contradiction the test looks for is **the same subject in two rooms by the same author**; night 3 says the attic and night 5 says the cellar. Task 15 decides which of those pairings the board actually flags.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): a hand-authored six-night match to render against"
```

---

## Task 15: The claim board

**Files:**
- Create: `v12/src/log/board.ts`
- Test: `v12/test/board.test.ts`

**Interfaces:**
- Consumes: `Claim` from `log/schema`
- Produces:
  - `interface Board { claims: Claim[] }`, `emptyBoard(): Board`
  - `placeClaim(board: Board, claim: Claim): { ok: boolean; reason?: string }`
  - `interface Contradiction { a: Claim; b: Claim; because: string }`
  - `findContradictions(board: Board): Contradiction[]`

**Rule decided here (rules §13.2 leaves it open):** a contradiction is one author placing the **same subject** in **two different rooms**, regardless of night — because a claim is an assertion about where someone was, and the board's job is to show the author disagreeing with themselves. Same-night is the sharper case and is reported first.

- [ ] **Step 1: Write the failing test**

`v12/test/board.test.ts`:

```ts
import { emptyBoard, placeClaim, findContradictions, deniersOf } from '../src/log/board';
import { SIX_NIGHT_CLAIMS } from '../src/log/fixture';
import type { Claim } from '../src/log/schema';

function roomClaim(night: number, by: string, subject: string, room: string): Claim {
  return { id: `${by}-n${night}`, kind: 'player-room', night, by, subject, room };
}

describe('placeClaim', () => {
  // rules §13.2 — each living player may place ONE claim marker per morning
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

  // rules §13.2 — claims are permanent and public for the rest of the match
  it('never removes a claim once placed, and freezes what it stored', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, roomClaim(3, 'bell', 'wren', 'cellar'));
    expect(b.claims).toHaveLength(2);
    expect(Object.isFrozen(b.claims[0])).toBe(true);
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

  // spec §5 — a contradiction planted in the fixture must be findable
  it('finds the contradiction planted in the six-night fixture', () => {
    const b = emptyBoard();
    for (const c of SIX_NIGHT_CLAIMS) placeClaim(b, c);
    expect(findContradictions(b).length).toBeGreaterThan(0);
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
  });

  // Denying costs your whole morning — §8 gives one mark each.
  it('still consumes the denier’s single mark for that morning', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    placeClaim(b, { id: 'd1', kind: 'deny', night: 2, by: 'clem', denies: 'bell-n2' });
    expect(placeClaim(b, roomClaim(2, 'clem', 'moss', 'kitchen')).ok).toBe(false);
  });

  it('rejects a duplicate claim id', () => {
    const b = emptyBoard();
    placeClaim(b, roomClaim(2, 'bell', 'wren', 'attic'));
    const dup: Claim = { id: 'bell-n2', kind: 'player-room', night: 3, by: 'clem', subject: 'moss', room: 'kitchen' };
    expect(placeClaim(b, dup).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v12 && npx vitest run test/board.test.ts`
Expected: FAIL — cannot resolve `../src/log/board`.

- [ ] **Step 3: Implement**

`v12/src/log/board.ts`:

```ts
import type { Claim } from './schema';

export interface Board { claims: Claim[] }

export function emptyBoard(): Board { return { claims: [] }; }

export interface PlaceResult { ok: boolean; reason?: string }

/** v12.2 §8 — one mark per living player per morning, permanent and public for
 *  the rest of the game. Permanence is why the stored claim is frozen: talking
 *  is deniable, a placed mark is committed. */
export function placeClaim(board: Board, claim: Claim): PlaceResult {
  const already = board.claims.some(c => c.night === claim.night && c.by === claim.by);
  if (already) return { ok: false, reason: `${claim.by} has already claimed on night ${claim.night}` };
  if (board.claims.some(c => c.id === claim.id)) {
    return { ok: false, reason: `claim id ${claim.id} is already on the board` };
  }
  // A denial has to point at a mark that exists, or the board can be poisoned
  // with references to nothing.
  if (claim.kind === 'deny') {
    const target = board.claims.find(c => c.id === claim.denies);
    if (!target) return { ok: false, reason: `nothing on the board with id ${claim.denies}` };
    if (target.by === claim.by) return { ok: false, reason: 'you cannot deny your own mark' };
  }
  board.claims.push(Object.freeze({ ...claim }) as Claim);
  return { ok: true };
}

/** Who has been contradicted, and by whom. A denial is an accusation of lying
 *  that costs the denier their whole morning — v12.2 §8 gives each player one
 *  mark, so spending it to say "that's not true" is a real commitment. */
export function deniersOf(board: Board, id: ClaimId): ActorId[] {
  return board.claims
    .filter((c): c is Extract<Claim, { kind: 'deny' }> => c.kind === 'deny' && c.denies === id)
    .map(c => c.by);
}

export interface Contradiction { a: Claim; b: Claim; because: string }

/** rules §13.2 leaves "contradiction" undefined; this is the reading the
 *  prototype takes. An author placing the same subject in two different rooms
 *  disagrees with themselves — that is the whole point of a permanent board.
 *  Same-night pairs are the sharper case and sort first. */
export function findContradictions(board: Board): Contradiction[] {
  const out: Contradiction[] = [];
  const roomClaims = board.claims.filter(
    (c): c is Extract<Claim, { kind: 'player-room' }> => c.kind === 'player-room');

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
  return out.sort((x, y) =>
    Number(y.a.night === y.b.night) - Number(x.a.night === x.b.night));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd v12 && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v12/
git commit -m "feat(v12): the claim board, permanent and self-contradicting"
```

---

## Task 16: The morning scene — slice 1 playable, and the acceptance pass

**Files:**
- Create: `v12/src/app/scenes/morning.ts`
- Modify: `v12/src/app/main.ts` (route `?scene=morning`)
- Create: `docs/findings/2026-07-29-slice-1-acceptance.md`
- Test: manual, recorded in the findings document

**Interfaces:**
- Consumes: `SIX_NIGHT_MATCH`, `SIX_NIGHT_CLAIMS`, `projectForHouse`, `renderReport`, `emptyBoard`, `placeClaim`, `findContradictions`

- [ ] **Step 1: Implement the morning scene**

`v12/src/app/scenes/morning.ts`:

```ts
import { HOLLOW } from '../../house/hollow';
import { emptyBoard, findContradictions, placeClaim } from '../../log/board';
import { SIX_NIGHT_CLAIMS, SIX_NIGHT_MATCH } from '../../log/fixture';
import { projectForHouse } from '../../log/project';
import { renderReport } from '../../log/report';
import type { Claim } from '../../log/schema';

const PLAYER = 'bell';
const SUBJECTS = ['pike', 'clem', 'wren', 'sparrow', 'moss'];

export function runMorningScene(root: HTMLElement, night: number): void {
  const board = emptyBoard();
  for (const c of SIX_NIGHT_CLAIMS.filter(c => c.night < night)) placeClaim(board, c);

  const style = document.createElement('style');
  style.textContent = `
    .morning { font: 16px/1.6 Georgia, serif; color: #e8dcc8; padding: 32px;
               max-width: 900px; margin: 0 auto; }
    .morning h2 { font-weight: normal; letter-spacing: .08em; color: #b9a88f; }
    .report { border-left: 3px solid #6b5a3e; padding-left: 16px; margin: 24px 0; }
    .claim-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .claim-row button { font: inherit; background: #2a2434; color: #e8dcc8;
                        border: 1px solid #4a3f57; padding: 6px 12px; cursor: pointer; }
    .claim-row button[aria-pressed="true"] { background: #6b5a3e; }
    .placed { margin: 4px 0; color: #cbbfa8; }
    .contradiction { color: #e0a0a0; border-left: 3px solid #e0a0a0; padding-left: 12px; }
    .timer { color: #b9a88f; font-variant-numeric: tabular-nums; }
  `;
  document.head.appendChild(style);

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'morning';
  root.appendChild(wrap);

  let subject: string | null = null;
  let room: string | null = null;
  const started = performance.now();

  function render(): void {
    const report = renderReport(projectForHouse(SIX_NIGHT_MATCH, night), HOLLOW);
    const contradictions = findContradictions(board);
    wrap.innerHTML = `
      <h2>Night ${night}</h2>
      <div class="report">${report.map(l => `<div>${l}</div>`).join('')}</div>
      <h2>The claim board</h2>
      <div class="claim-row" id="subjects">${SUBJECTS.map(s =>
        `<button data-subject="${s}" aria-pressed="${subject === s}">${s}</button>`).join('')}</div>
      <div class="claim-row" id="rooms">${HOLLOW.rooms.map(r =>
        `<button data-room="${r.id}" aria-pressed="${room === r.id}">${r.name}</button>`).join('')}</div>
      <div class="claim-row"><button id="commit">Commit claim</button>
        <span class="timer" id="timer"></span></div>
      ${board.claims.map(c => `<div class="placed">n${c.night} · ${c.by} → ${
        'subject' in c ? c.subject : ''} ${'room' in c ? `in ${c.room}` : ''}</div>`).join('')}
      ${contradictions.map(c => `<div class="contradiction">${c.because}</div>`).join('')}
    `;

    wrap.querySelectorAll<HTMLButtonElement>('[data-subject]').forEach(b =>
      b.onclick = () => { subject = b.dataset.subject!; render(); });
    wrap.querySelectorAll<HTMLButtonElement>('[data-room]').forEach(b =>
      b.onclick = () => { room = b.dataset.room!; render(); });
    wrap.querySelector<HTMLButtonElement>('#commit')!.onclick = () => {
      if (!subject || !room) return;
      const claim: Claim = { kind: 'player-room', night, by: PLAYER, subject, room };
      const r = placeClaim(board, claim);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      // The number slice 1 is actually for: how long one claim took to place.
      console.log(`[claim] ${r.ok ? 'placed' : `refused: ${r.reason}`} after ${secs}s`);
      subject = null; room = null;
      render();
    };
    const t = wrap.querySelector<HTMLElement>('#timer')!;
    t.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s of 60`;
  }

  render();
  setInterval(() => {
    const t = wrap.querySelector<HTMLElement>('#timer');
    if (t) t.textContent = `${((performance.now() - started) / 1000).toFixed(1)}s of 60`;
  }, 100);
}
```

- [ ] **Step 2: Route to it from main**

Replace `v12/src/app/main.ts`:

```ts
import { createStage } from '../render/stage';
import { runMorningScene } from './scenes/morning';
import { runNightScene } from './scenes/night';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1234);
const night = Number(params.get('night') ?? 6);

if (params.get('scene') === 'morning') {
  runMorningScene(document.body, night);
} else {
  createStage(document.body).then(stage => runNightScene(stage, seed, night));
}
```

- [ ] **Step 3: Run the full suite**

Run: `cd v12 && npm test`
Expected: PASS, everything green, `tsc --noEmit` clean.

- [ ] **Step 4: Run the slice 1 acceptance pass**

Open `?scene=morning&night=5`. Create `docs/findings/2026-07-29-slice-1-acceptance.md` and answer each spec §5 criterion in writing, including failures:

1. Six nights render six reports, and no code reads actor identity outside `didNotReturn`. (The voice-rule test proves the second half.)
2. The contradiction planted on night 3 against night 5 is findable **by someone who did not plant it**. Ask this of yourself honestly, or better, of anyone at all.
3. **Timed:** how many seconds from morning start to a committed claim? Read it from the console line. Record the number.

State the limit plainly in the document: you are the fastest possible user of a board you built, so this can show 60 seconds is **definitely too slow** — it cannot show it is fast enough.

- [ ] **Step 5: Review the report for inferential leakage**

Spec §5 requires this and it is not a test. Read the six rendered reports and ask: does any line identify a person to someone who was in the adjacent room? Rules §10.3's direction, count and timing frequently will. Record what you find under a heading `## Inferential leakage` — this is a design finding, not a bug, and the answer feeds rules §3.3.

- [ ] **Step 6: Commit**

```bash
git add v12/ docs/findings/2026-07-29-slice-1-acceptance.md
git commit -m "feat(v12): slice 1 — the morning, and the first timed claim"
```

---

## Task 17: Read the gate

**Files:**
- Modify: `docs/findings/2026-07-29-tester-track.md`

Both slices are done. Spec §6 is now live.

- [ ] **Step 1: Record the gate status honestly**

Under `## Gate status`, write which of the two tiers is met:

- **Gate A** — 2–3 humans confirmed for a scheduled session, twice → slice 2a, the Bind toy.
- **Gate B** — 6 humans, twice → slice 2b and everything after.
- **Neither** → **park v12.** Record the findings and stop. Do not build authoritative netcode on an unvalidated premise.

Parking is an acceptable outcome and the spec says so. Slice 0 is a playable house and a recruiting artefact; slice 1 is a log format and two renderers the real game needs regardless. Neither is discarded.

- [ ] **Step 2: Commit**

```bash
git add docs/findings/2026-07-29-tester-track.md
git commit -m "docs: read the gate"
```

- [ ] **Step 3: Stop**

**This plan ends here.** Anything past the gate is planned separately, once there is a reason to believe the premise. Do not extend this document.

---

## Deliberately out of scope

Restating spec §9, because these are the things a well-meaning implementer will add:

- **Snuffing is not yet gated on occupancy.** v12.2 §5 says a lantern "can now be put out by the Odd Sock — **but only if nobody's standing in the light**." Task 6 implements the state flip only. The role half is infeasible in slice 0 (`Actor` has no role field), but **the occupancy half is buildable today** with `lightAt` and `Sim.lightSources()`, and it must land before any task charges a flame per snuff. Tracked here so it is not lost between slices.
- **No policy bot.** Task 8's stalker is scripted and produces no number. If it grows a heuristic, a score, or a counter, that is a defect.
- **No economy simulator** for rules §32 Q2/Q3/Q4. A movement model exists now, but it has never been calibrated against a human, so anything built on top of it would measure the model rather than the game.
- **No networking.** No Colyseus, no WebSocket, no room codes. Slice 2b, behind Gate B.
- **No Displace, Shed, Slip, Call, ghosts, Whisper, Last Night, or Bind** as playable systems. The fixture *describes* a Displace so the report has something to render; that is not an implementation.
- **Not rules §12.4's Shed logic.** Spec §8.0 records it as a defect with no correct resolution. Do not implement it and do not pick one of the two failing answers.
