import { runSweep, BASELINE_CELLS } from '../analysis/sweep.js';
import { formatTable } from '../analysis/report.js';

const started = Date.now();
const results = runSweep(BASELINE_CELLS, 0);
process.stdout.write(formatTable(results));
process.stdout.write(`\n${BASELINE_CELLS.length} configs in ${Date.now() - started}ms\n`);
