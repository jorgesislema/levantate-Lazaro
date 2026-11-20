// Recovery check. Runs the legacy entrypoint on fixed data and compares the total.
// Exit 0 = expected total printed. Exit 1 = anything else (prints a short signature).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = 'total_cents=4250';

const r = spawnSync(process.execPath, ['src/legacy-entry.js', 'data/sample.json'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 10000,
});

const out = (r.stdout ?? '').trim();
if (r.status === 0 && out === EXPECTED) {
  console.log('PASS ' + EXPECTED);
  process.exit(0);
}

const err = (r.stderr ?? '').split('\n').find((l) => /Error/.test(l)) ?? 'no error line';
console.log(`FAIL expected=${EXPECTED} exit=${r.status} signature=${err.trim()}`);
process.exit(1);
