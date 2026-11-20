// Builds a self-contained release folder: one bundled file plus the data it reads.
// Judges need only Node 24 and Git. No npm install, no network, no API key.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const name = `levantate-lazaro-${version}`;
const out = join(root, 'release', name);

rmSync(join(root, 'release'), { recursive: true, force: true });
mkdirSync(join(out, 'dist'), { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'cli.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: join(out, 'dist', 'levantate.mjs'),
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

for (const d of ['kit', 'replay', 'fixtures-src']) cpSync(join(root, d), join(out, d), { recursive: true });
mkdirSync(join(out, 'scripts'));
cpSync(join(root, 'scripts', 'make-fixtures.mjs'), join(out, 'scripts', 'make-fixtures.mjs'));
for (const f of ['README.md', 'LICENSE']) cpSync(join(root, f), join(out, f));
writeFileSync(join(out, 'RUN-DEMO.txt'), `Requirements: Node 24 or newer, Git.\n\n  node dist/levantate.mjs demo --out demo-out\n\nThen open demo-out/report.html in a browser.\nNo network, no API key, no Kiro credits.\n`);

try {
  execFileSync('tar', ['-czf', `${name}.tgz`, name], { cwd: join(root, 'release'), stdio: 'pipe' });
} catch {
  console.log('tar not found; zip the folder by hand.');
}
console.log('release ready: ' + out);
