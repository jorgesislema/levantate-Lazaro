import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan } from "../src/scan.js";
import { bind, digestsFor, type ManifestDraft, type TaskManifest } from "../src/manifest.js";
import { applyRecordedChange, writeReplayPlan } from "../src/replay.js";
import { isBaseline, recordBaseline, verifyAfter } from "../src/verify.js";
import type { Casefile } from "../src/casefile.js";

const CLOCK = new Date("2026-11-20T00:00:00Z");
const tmp = () => mkdtempSync(join(tmpdir(), "lz-v-"));

function fixture(): string {
  const dir = join(tmp(), "gastos-app");
  execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });
  return dir;
}

function write(dir: string, rel: string, text: string) {
  mkdirSync(join(dir, rel, ".."), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

interface Mini { dir: string; cf: Casefile; m: TaskManifest; draft: ManifestDraft }

function mini(over: Partial<ManifestDraft> = {}, state = "bad"): Mini {
  const dir = tmp();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  write(dir, "src/state.txt", state);
  write(dir, "check/c.mjs", `import {readFileSync} from 'node:fs';
if (readFileSync('src/state.txt','utf8').trim()==='ok'){console.log('PASS');process.exit(0)}
console.log('FAIL Error: state is bad');process.exit(1);`);
  write(dir, "check/slow.mjs", "setTimeout(()=>{}, 60000);");
  write(dir, "check/p-fail.mjs", "console.log('FAIL property counterexample=[1]');process.exit(1);");
  write(dir, "check/p-pass.mjs", "console.log('PASS property');");
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const cf = scan({ dir, clock: CLOCK });
  const draft: ManifestDraft = {
    schemaVersion: 1, caseId: cf.caseId, taskId: "T1", requirementIds: ["R5"],
    allowedPaths: ["src/state.txt"],
    expectedBehavior: "state is ok", expectedBaselineFailure: "state is bad",
    check: { argv: ["node", "check/c.mjs"], timeoutMs: 5000 },
    harness: digestsFor(dir, ["check/c.mjs"]), fixtures: [],
    evaluation: { recommended: "simple", reason: "r", selection: "simple", advisory: [] },
    ...over,
  };
  return { dir, cf, m: bind(draft), draft };
}

const repair = (dir: string) => write(dir, "src/state.txt", "ok");

describe("recovery on the fixture", () => {
  it("fails the baseline, applies the recorded change, then passes the same check", () => {
    const dir = fixture();
    const cf = scan({ dir, clock: CLOCK });
    const m = writeReplayPlan(dir, cf);
    const b = recordBaseline(dir, m, cf);
    expect(isBaseline(b)).toBe(true);
    if (isBaseline(b)) expect(b.signature).toContain("util.isString is not a function");
    expect(applyRecordedChange(dir, m)).toBe("src/legacy-entry.js");
    const v = verifyAfter(dir, m, cf);
    expect(v.status).toBe("verified");
    expect(v.changedPaths).toEqual(["src/legacy-entry.js"]);
    expect(v.property.status).toBe("not_selected");
    expect(v.recovery?.exit).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, ".lazarus", "verification.json"), "utf8")).status).toBe("verified");
  });

  it("records the selected property separately and passes it", () => {
    const dir = fixture();
    const cf = scan({ dir, clock: CLOCK });
    const m = writeReplayPlan(dir, cf, { properties: true });
    expect(isBaseline(recordBaseline(dir, m, cf))).toBe(true);
    applyRecordedChange(dir, m);
    const v = verifyAfter(dir, m, cf);
    expect(v.status).toBe("verified");
    expect(v.property.status).toBe("passed");
    expect(v.property.detail).toContain("seed=42");
  });

  it("the property catches an order-dependent defect and shrinks it", () => {
    const dir = fixture();
    write(dir, "src/total.js", "exports.sumCents = (xs) => xs.reduce((a, e, i) => a + (i === 0 && e.cents > 50000 ? 0 : e.cents), 0);");
    const r = spawnSync(process.execPath, [join(dir, "check", "expense-property.mjs")], { cwd: dir, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FAIL property=reverse-preserves-total");
    expect(r.stdout).toMatch(/counterexample=\[\d+,\d+\]/);
  }, 20000);
});

describe("outcomes", () => {
  it("a selected property that fails stays visible while recovery passes", () => {
    const { dir, cf, draft } = mini();
    const m = bind({
      ...draft,
      evaluation: {
        ...draft.evaluation, recommended: "simple+properties", selection: "simple+properties",
        property: { rule: "r", argv: ["node", "check/p-fail.mjs"], harness: digestsFor(dir, ["check/p-fail.mjs"])[0]!, seed: 1, runs: 1, timeoutMs: 5000 },
      },
    });
    expect(isBaseline(recordBaseline(dir, m, cf))).toBe(true);
    repair(dir);
    const v = verifyAfter(dir, m, cf);
    expect(v.status).toBe("verified");
    expect(v.property.status).toBe("failed");
    expect(v.property.detail).toContain("counterexample");
  });

  it("reports failed when the check still fails after the change", () => {
    const { dir, cf, m } = mini();
    recordBaseline(dir, m, cf);
    write(dir, "src/state.txt", "still bad");
    expect(verifyAfter(dir, m, cf).status).toBe("failed");
  });

  it("blocks an unexpected baseline that already passes", () => {
    const { dir, cf, m } = mini({}, "ok");
    const r = recordBaseline(dir, m, cf);
    expect(isBaseline(r)).toBe(false);
    if (!isBaseline(r)) expect(r.reason).toContain("already passes");
  });

  it("blocks a baseline that fails for another reason", () => {
    const { dir, cf, draft } = mini();
    const m = bind({ ...draft, expectedBaselineFailure: "something else" });
    const r = recordBaseline(dir, m, cf);
    expect(isBaseline(r)).toBe(false);
    if (!isBaseline(r)) expect(r.reason).toContain("unexpected baseline");
  });

  it("times out a slow check", () => {
    const { dir, cf, draft } = mini();
    const m = bind({ ...draft, check: { argv: ["node", "check/slow.mjs"], timeoutMs: 1000 }, harness: digestsFor(dir, ["check/slow.mjs"]) });
    const r = recordBaseline(dir, m, cf);
    expect(isBaseline(r)).toBe(false);
    if (!isBaseline(r)) expect(r.status).toBe("timed_out");
  });

  it("rejects an unsupported executable", () => {
    const { dir, cf, draft } = mini();
    const m = bind({ ...draft, check: { argv: ["bash", "check/c.mjs"], timeoutMs: 5000 } });
    const r = recordBaseline(dir, m, cf);
    expect(isBaseline(r)).toBe(false);
    if (!isBaseline(r)) expect(r.reason).toContain("unsupported executable");
  });
});

describe("guards", () => {
  it("blocks scope drift outside the approved paths", () => {
    const { dir, cf, m } = mini();
    recordBaseline(dir, m, cf);
    repair(dir);
    write(dir, "src/other.txt", "surprise");
    const v = verifyAfter(dir, m, cf);
    expect(v.status).toBe("blocked");
    expect(v.reason).toContain("scope drift: src/other.txt");
  });

  it("keeps changes that existed before the baseline out of the scope check", () => {
    const { dir, cf, m } = mini();
    write(dir, "notes.txt", "mine");
    recordBaseline(dir, m, cf);
    repair(dir);
    expect(verifyAfter(dir, m, cf).status).toBe("verified");
  });

  it("blocks when the harness changes after approval", () => {
    const { dir, cf, m } = mini();
    recordBaseline(dir, m, cf);
    write(dir, "check/c.mjs", "process.exit(0);");
    repair(dir);
    const v = verifyAfter(dir, m, cf);
    expect(v.status).toBe("blocked");
    expect(v.reason).toContain("changed since approval");
  });

  it("blocks a missing harness", () => {
    const { dir, cf, m } = mini();
    recordBaseline(dir, m, cf);
    rmSync(join(dir, "check", "c.mjs"));
    expect(verifyAfter(dir, m, cf).reason).toContain("cannot be read");
  });

  it("refuses to bind a property whose harness does not exist", () => {
    const { dir } = mini();
    expect(() => digestsFor(dir, ["check/missing.mjs"])).toThrow();
  });

  it("marks a baseline from another plan as stale", () => {
    const { dir, cf, m, draft } = mini();
    recordBaseline(dir, m, cf);
    repair(dir);
    const other = bind({ ...draft, expectedBehavior: "a different goal" });
    expect(verifyAfter(dir, other, cf).status).toBe("stale");
  });

  it("marks a manifest for another casefile as stale", () => {
    const { dir, cf, m } = mini();
    expect(verifyAfter(dir, m, { ...cf, caseId: "0000000000000000" }).status).toBe("stale");
  });

  it("needs a baseline before verifying", () => {
    const { dir, cf, m } = mini();
    repair(dir);
    expect(verifyAfter(dir, m, cf).reason).toContain("no baseline");
  });
});
