// Seeded property check: reversing the expense list keeps the total.
// Pair with a fixed example whose expected total is written by hand, so a
// function that always returns zero cannot pass.
// Usage: node check/expense-property.mjs [--seed N] [--runs N]
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sumCents } = require('../src/total.js');

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? Number(process.argv[i + 1]) : dflt;
};
const seed = arg('seed', 42);
const runs = arg('runs', 200);

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (cents) => cents.map((c) => ({ cents: c }));
const holds = (cents) => sumCents(wrap(cents)) === sumCents(wrap([...cents].reverse()));

function shrink(cents) {
  let cur = cents;
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < cur.length; i++) {
      const next = cur.filter((_, j) => j !== i);
      if (!holds(next)) { cur = next; again = true; break; }
    }
  }
  return cur;
}

const fixed = [
  [sumCents(wrap([1250, 2000, 999, 1])), 4250],
  [sumCents([]), 0],
];
for (const [got, want] of fixed) {
  if (got !== want) {
    console.log(`FAIL fixed-example expected=${want} got=${got}`);
    process.exit(1);
  }
}

const next = rng(seed);
for (let r = 0; r < runs; r++) {
  const n = Math.floor(next() * 21);
  const cents = Array.from({ length: n }, () => Math.floor(next() * 100001));
  if (!holds(cents)) {
    console.log(`FAIL property=reverse-preserves-total seed=${seed} run=${r} counterexample=${JSON.stringify(shrink(cents))}`);
    process.exit(1);
  }
}
console.log(`PASS property=reverse-preserves-total seed=${seed} runs=${runs}`);
