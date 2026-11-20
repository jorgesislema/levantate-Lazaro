import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan } from "../src/scan.js";
import { bindDraft, DraftManifest, validateManifest } from "../src/manifest.js";
import { applyRecordedChange, replayDiagnosis, replayManifest } from "../src/replay.js";
import { importRecorded, loadRecorded } from "../src/recorded.js";

const CLOCK = new Date("2026-11-20T00:00:00Z");
const tmp = () => mkdtempSync(join(tmpdir(), "lz-rec-"));

function fixture(): string {
  const dir = join(tmp(), "gastos-app");
  execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });
  return dir;
}

const dir = fixture();
const cf = scan({ dir, clock: CLOCK });
const template = JSON.parse(readFileSync(join(process.cwd(), "replay", "gastos-app", "task-1.template.json"), "utf8"));

describe("plan bind", () => {
  it("fills digests so an agent-written draft becomes a valid manifest", () => {
    const m = bindDraft(dir, DraftManifest.parse(template), cf.caseId);
    expect(validateManifest(m, cf, dir)).toEqual({ ok: true, errors: [] });
    expect(m.planDigest).toBe(replayManifest(cf, dir).planDigest);
  });

  it("binds a property harness digest too", () => {
    const draft = DraftManifest.parse({
      ...template,
      evaluation: {
        ...template.evaluation, recommended: "simple+properties", selection: "simple+properties",
        property: { rule: "r", argv: ["node", "check/expense-property.mjs"], harness: "check/expense-property.mjs", seed: 42, runs: 50, timeoutMs: 10000 },
      },
    });
    const m = bindDraft(dir, draft, cf.caseId);
    expect(m.evaluation.property?.harness.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(validateManifest(m, cf, dir).ok).toBe(true);
  });

  it("rejects traversal and missing files in a draft", () => {
    expect(DraftManifest.safeParse({ ...template, allowedPaths: ["../x"] }).success).toBe(false);
    expect(DraftManifest.safeParse({ ...template, allowedPaths: ["src/*.js"] }).success).toBe(false);
    expect(() => bindDraft(dir, DraftManifest.parse({ ...template, harness: ["check/nope.mjs"] }), cf.caseId)).toThrow();
  });
});

describe("recording a real session", () => {
  const prov = { surface: "kiro-ide", model: "test-model", recordedAt: "2026-11-20T00:00:00Z", agent: "lazaro", correctionPasses: 1 };

  function session() {
    const root = fixture();
    const c = scan({ dir: root, clock: CLOCK });
    const m = replayManifest(c, root);
    const d = replayDiagnosis(c);
    const dp = join(tmp(), "d.json"), mp = join(tmp(), "m.json");
    writeFileSync(dp, JSON.stringify(d)); writeFileSync(mp, JSON.stringify(m));
    applyRecordedChange(root, m); // stands in for the agent's edit
    return { root, c, m, dp, mp };
  }

  it("stores diagnosis, plan, the edit and provenance, then loads them back", () => {
    const { root, c, dp, mp } = session();
    const replayDir = tmp();
    importRecorded({ fixtureRoot: root, casefile: c, diagnosisPath: dp, manifestPath: mp, provenance: prov, replayDir });
    expect(existsSync(join(replayDir, "recorded", "change"))).toBe(true);
    const rec = loadRecorded(c, root, replayDir);
    expect(rec?.provenance.model).toBe("test-model");
    expect(rec?.manifest.allowedPaths).toEqual(["src/legacy-entry.js"]);
  });

  it("refuses a diagnosis for another casefile", () => {
    const { root, c, dp, mp } = session();
    const bad = { ...JSON.parse(readFileSync(dp, "utf8")), caseId: "0000000000000000" };
    writeFileSync(dp, JSON.stringify(bad));
    expect(() => importRecorded({ fixtureRoot: root, casefile: c, diagnosisPath: dp, manifestPath: mp, provenance: prov, replayDir: tmp() }))
      .toThrow(/diagnosis is not valid/);
  });

  it("refuses a manifest whose check files changed", () => {
    const { root, c, dp, mp } = session();
    writeFileSync(join(root, "check", "expense-total.mjs"), "process.exit(0);");
    expect(() => importRecorded({ fixtureRoot: root, casefile: c, diagnosisPath: dp, manifestPath: mp, provenance: prov, replayDir: tmp() }))
      .toThrow(/manifest is not valid/);
  });

  it("refuses incomplete provenance", () => {
    const { root, c, dp, mp } = session();
    expect(() => importRecorded({ fixtureRoot: root, casefile: c, diagnosisPath: dp, manifestPath: mp, provenance: { surface: "chatgpt" }, replayDir: tmp() })).toThrow();
  });

  it("rebinds to a fresh casefile but ignores a recording whose evidence is gone", () => {
    const { root, c, dp, mp } = session();
    const replayDir = tmp();
    importRecorded({ fixtureRoot: root, casefile: c, diagnosisPath: dp, manifestPath: mp, provenance: prov, replayDir });
    expect(loadRecorded({ ...c, caseId: "1111111111111111" }, root, replayDir)?.diagnosis.caseId).toBe("1111111111111111");
    expect(loadRecorded({ ...c, evidence: [], promises: [] }, root, replayDir)).toBeNull();
    expect(loadRecorded(c, root, tmp())).toBeNull();
  });
});
