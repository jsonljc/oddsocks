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
