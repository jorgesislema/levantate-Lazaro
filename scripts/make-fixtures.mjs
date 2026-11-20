// Generates the synthetic gastos-app repo with fixed, fake Git history.
// Usage: node scripts/make-fixtures.mjs <outDir>
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'fixtures-src', 'gastos-app');
const out = resolve(process.argv[2] ?? join(here, '..', 'fixtures', 'gastos-app'));

if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function git(args, date) {
  const env = { ...process.env };
  env.GIT_AUTHOR_NAME = env.GIT_COMMITTER_NAME = 'Fixture Dev';
  env.GIT_AUTHOR_EMAIL = env.GIT_COMMITTER_EMAIL = 'fixture@example.invalid';
  if (date) env.GIT_AUTHOR_DATE = env.GIT_COMMITTER_DATE = date;
  execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
    cwd: out, env, stdio: 'pipe',
  });
}

function copy(rel) {
  const to = join(out, rel);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(join(src, rel), to, { recursive: true });
}

function commit(msg, date) {
  git(['add', '-A'], date);
  git(['commit', '-q', '-m', msg], date);
}

git(['init', '-q', '-b', 'main']);

copy('package.json'); copy('README.md'); copy('src/total.js');
commit('initial express expense app', '2021-06-01T12:00:00Z');

copy('src/legacy-entry.js'); copy('data/sample.json'); copy('check/expense-total.mjs'); copy('check/expense-property.mjs');
commit('add expense entrypoint and sample data', '2022-02-10T12:00:00Z');

// Fake template-generated example; not a real secret.
writeFileSync(join(out, '.env.example'), 'API_KEY=FAKE_EXAMPLE_NOT_A_REAL_KEY\n');
commit('add env example', '2023-05-20T12:00:00Z');

git(['checkout', '-q', '-b', 'feature/pdf-export']);
mkdirSync(join(out, 'src'), { recursive: true });
writeFileSync(join(out, 'src', 'pdf.js'), "'use strict';\n// TODO: PDF export is unfinished.\nmodule.exports = {};\n");
commit('wip: pdf export', '2023-09-01T12:00:00Z');
git(['checkout', '-q', 'main']);

writeFileSync(join(out, 'NOTES.txt'), 'wip: timestamp units\n');
commit('wip: timestamp units', '2024-03-12T12:00:00Z');

console.log('fixture ready: ' + out);
