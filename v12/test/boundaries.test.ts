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

const FORBIDDEN_LAYERS = ['render', 'audio', 'app', 'scripted'];

// core/, log/ and house/ run on the server in slice 2b (test/boundaries.test.ts
// is the whole enforcement mechanism for that — nothing else in the repo
// checks this). Both guards below cover the SAME three directories: the
// original had the clock/random check running on only ['src/core', 'src/log'],
// silently exempting src/house from it while the import check covered all
// three — found in the slice-0/1 final review, alongside four other holes
// fixed in the same pass (see each comment below).
const GUARDED_DIRS = ['src/core', 'src/log', 'src/house'];

// Matches both `import x from '...'`/`export x from '...'` AND dynamic
// `import('...')`. The original regex required the literal `from` keyword,
// so `await import('../render/stage')` — no `from` anywhere in that
// expression — was invisible to it.
function importSpecifiers(src: string): string[] {
  return [
    ...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
    ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
  ].map(m => m[1]!);
}

describe('layer boundaries', () => {
  // The original only matched RELATIVE specifiers containing
  // render/|audio/|app/|scripted/, so a browser PACKAGE — `import { Graphics }
  // from 'pixi.js'` — sailed straight through: 'pixi.js' contains none of
  // those substrings. Every legitimate import in these three directories
  // today is relative (audited directly before writing this check), so "not
  // relative" is exactly "not allowed" here — a bare/package specifier is
  // rejected outright, with nothing to enumerate and fall behind a future
  // package. The forbidden-layer check on relative specifiers still applies,
  // both here (for `../render/stage`-style paths) and now against dynamic
  // imports too.
  it.each(GUARDED_DIRS)('%s imports no browser layer and no non-relative package', dir => {
    for (const file of filesUnder(join(TEST_DIR, '..', dir))) {
      const src = readFileSync(file, 'utf8');
      for (const spec of importSpecifiers(src)) {
        expect(spec.startsWith('.'), `${file}: non-relative import '${spec}'`).toBe(true);
        for (const layer of FORBIDDEN_LAYERS) {
          expect(spec, `${file}: imports forbidden layer via '${spec}'`).not.toMatch(new RegExp(`${layer}/`));
        }
      }
    }
  });

  // Expanded from `Date.now(|performance.now(` — that pair missed
  // `new Date().getTime()` and `Date.parse(...)`, both real ways to read the
  // wall clock that the original regex let straight through. Also now checks
  // for direct browser-global reads (`window.`/`document.`), which had no
  // check at all before this pass.
  it.each(GUARDED_DIRS)('%s reads no wall clock, no global random, and no browser globals', dir => {
    for (const file of filesUnder(join(TEST_DIR, '..', dir))) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/Math\.random\(/);
      expect(src).not.toMatch(/Date\.now\(|performance\.now\(|new Date\(|Date\.parse\(/);
      expect(src).not.toMatch(/\bwindow\.|\bdocument\./);
    }
  });
});
