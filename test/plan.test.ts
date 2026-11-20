import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan } from "../src/scan.js";
import { validateDiagnosis, toScoreInput } from "../src/diagnosis.js";
import { score } from "../src/score.js";
import { replayDiagnosis, replayManifest } from "../src/replay.js";
import { validateManifest, bind, type TaskManifest } from "../src/manifest.js";
import { contextPack, recordUsage, CONTEXT_CAPS } from "../src/context.js";
import { parseInterview, canEditSource, PROFILES } from "../src/profiles.js";

const dir = join(mkdtempSync(join(tmpdir(), "lz-p-")), "gastos-app");
execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });
const cf = scan({ dir, clock: new Date("2026-11-20T00:00:00Z") });

describe("interview and the three profiles", () => {
  it("maps the fifth answer to a mode", () => {
    const a = (x: string) => parseInterview({ answers: ["p", "m", "w", "one milestone", x] });
    expect(a("a checklist please").mode).toBe("seance");
    expect(a("guided practice").mode).toBe("apprentice");
    expect(a("a first approved repair").mode).toBe("resurrection");
  });

  it("resolves a skip or silence to seance and minimal", () => {
    expect(parseInterview({ skip: true })).toMatchObject({ mode: "seance", scope: "minimal", skipped: true });
    expect(parseInterview({ answers: [] })).toMatchObject({ mode: "seance", scope: "minimal" });
  });

  it("reads full scope from the fourth answer", () => {
    expect(parseInterview({ answers: ["a", "b", "c", "the full goal", "fix it"] }).scope).toBe("full");
  });

  it("allows source edits only in Resurrection, approved, inside the allowlist", () => {
    const ok = ["src/legacy-entry.js"];
    expect(canEditSource("resurrection", true, ok, "src/legacy-entry.js")).toBe(true);
    expect(canEditSource("resurrection", false, ok, "src/legacy-entry.js")).toBe(false);
    expect(canEditSource("seance", true, ok, "src/legacy-entry.js")).toBe(false);
    expect(canEditSource("apprentice", true, ok, "src/legacy-entry.js")).toBe(false);
    expect(canEditSource("resurrection", true, ok, "check/expense-total.mjs")).toBe(false);
    expect(canEditSource("resurrection", true, ok, "../x")).toBe(false);
    expect(PROFILES.apprentice.output).toBe("hints");
  });
});

describe("replayed diagnosis", () => {
  it("validates against the fresh casefile and scores provisionally", () => {
    const d = replayDiagnosis(cf);
    expect(validateDiagnosis(d, cf)).toEqual({ ok: true, stale: false, errors: [] });
    expect(d.reviewSignals.length).toBeLessThanOrEqual(3);
    expect(score(toScoreInput(cf, d)).provisional).toBe(true);
  });
});

describe("task 1 manifest", () => {
  const m = replayManifest(cf, dir);

  it("is valid and bound to the casefile", () => {
    expect(validateManifest(m, cf, dir)).toEqual({ ok: true, errors: [] });
  });

  it("changes the plan digest when anything changes", () => {
    const edited: TaskManifest = { ...m, expectedBehavior: "something else" };
    expect(validateManifest(edited, cf, dir).errors.join()).toContain("planDigest");
  });

  it("rejects a locked check file in the edit allowlist", () => {
    const { planDigest: _p, ...draft } = m;
    const bad = bind({ ...draft, allowedPaths: ["check/expense-total.mjs"] });
    expect(validateManifest(bad, cf, dir).errors.join()).toContain("locked check file");
  });

  it("detects a harness changed after approval", () => {
    const other = join(mkdtempSync(join(tmpdir(), "lz-p2-")), "gastos-app");
    execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), other], { stdio: "pipe" });
    appendFileSync(join(other, "check", "expense-total.mjs"), "\n// tampered\n");
    expect(validateManifest(m, cf, other).errors.join()).toContain("changed since approval");
  });

  it("is stale for another casefile", () => {
    expect(validateManifest(m, { ...cf, caseId: "0000000000000000" }).errors.join()).toContain("stale");
  });

  it("requires a property definition when properties are selected", () => {
    const { planDigest: _p, ...draft } = m;
    const bad = bind({ ...draft, evaluation: { ...draft.evaluation, selection: "simple+properties" } });
    expect(validateManifest(bad, cf, dir).errors.join()).toContain("needs a property check");
  });

  it("recommends one evaluation with a reason", () => {
    expect(m.evaluation.recommended).toBe("simple");
    expect(m.evaluation.reason.length).toBeGreaterThan(0);
  });
});

describe("context pack and usage", () => {
  it("stays inside the caps and hides secrets", () => {
    const p = contextPack(dir, cf);
    expect(p.bytes).toBeLessThanOrEqual(CONTEXT_CAPS.total);
    expect(p.files.length).toBeLessThanOrEqual(CONTEXT_CAPS.files);
    expect(p.text).not.toContain("FAKE_EXAMPLE");
    expect(p.text).toContain("README.md");
  });

  it("records measured usage rows", () => {
    const p = contextPack(dir, cf);
    recordUsage(dir, { at: "2026-11-20T00:00:00Z", phase: "diagnosis", inputBytes: p.bytes, passes: 1 });
    const rows = recordUsage(dir, { at: "2026-11-20T00:01:00Z", phase: "plan", inputBytes: 100, passes: 1 });
    expect(rows.length).toBe(2);
    expect(JSON.parse(readFileSync(join(dir, ".lazarus", "usage.json"), "utf8")).length).toBe(2);
  });
});
