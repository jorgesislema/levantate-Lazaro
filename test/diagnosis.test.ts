import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan } from "../src/scan.js";
import { Diagnosis, validateDiagnosis, toScoreInput } from "../src/diagnosis.js";
import { score } from "../src/score.js";

const dir = join(mkdtempSync(join(tmpdir(), "lz-d-")), "gastos-app");
execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });
const cf = scan({ dir, clock: new Date("2026-11-20T00:00:00Z") });
const todo = cf.evidence.find((e) => e.kind === "file" && e.label === "todo")!.id;
const prom = (n: number) => cf.promises[n]!.id;

function good(): Diagnosis {
  return {
    schemaVersion: 1,
    caseId: cf.caseId,
    cause: "technical_block",
    confidence: "medium",
    evidenceIds: [todo],
    recollection: "Owner: I stopped when Node 12 reached end of life.",
    gaps: [
      { promiseId: prom(0), status: "fulfilled", evidenceIds: [todo] },
      { promiseId: prom(1), status: "missing", evidenceIds: [todo] },
    ],
    intentSummary: "Track expenses in cents and export a monthly PDF.",
    blocker: { text: "Legacy entrypoint fails on current Node.", evidenceIds: [todo] },
    reviewSignals: [],
  };
}

describe("validateDiagnosis", () => {
  it("accepts a well-formed diagnosis", () => {
    const d = Diagnosis.parse(good());
    expect(validateDiagnosis(d, cf)).toEqual({ ok: true, stale: false, errors: [] });
  });

  it("rejects dangling evidence", () => {
    const d = { ...good(), evidenceIds: ["E999"] };
    expect(validateDiagnosis(d, cf).errors.join()).toContain("unknown evidence E999");
  });

  it("rejects unknown and duplicate promises", () => {
    const d = good();
    d.gaps.push({ promiseId: "P99", status: "unknown", evidenceIds: [] });
    d.gaps.push({ promiseId: prom(0), status: "partial", evidenceIds: [todo] });
    const e = validateDiagnosis(d, cf).errors.join();
    expect(e).toContain("unknown promise P99");
    expect(e).toContain("classified twice");
  });

  it("flags a stale casefile binding", () => {
    const v = validateDiagnosis({ ...good(), caseId: "0000000000000000" }, cf);
    expect(v.stale).toBe(true);
    expect(v.ok).toBe(false);
  });

  it("requires evidence for strong claims", () => {
    const d = { ...good(), confidence: "high" as const };
    expect(validateDiagnosis(d, cf).errors.join()).toContain("high needs two");
    const m = good();
    m.gaps[1] = { promiseId: prom(1), status: "missing", evidenceIds: [cf.evidence.find((e) => e.kind === "file" && e.label === "promise")!.id] };
    expect(validateDiagnosis(m, cf).errors.join()).toContain("needs a pending TODO");
  });

  it("limits review signals to three", () => {
    const s = { category: "security", text: "t", evidenceIds: [todo], uncertainty: "u", nextAction: "a" };
    expect(Diagnosis.safeParse({ ...good(), reviewSignals: [s, s, s, s] }).success).toBe(false);
  });
});

describe("scoring from a casefile", () => {
  it("is provisional until every promise is classified", () => {
    const s = score(toScoreInput(cf, Diagnosis.parse(good())));
    expect(s.provisional).toBe(true);
    expect(s.unknowns.join()).toContain("unclassified");
  });

  it("completes when all promises are classified", () => {
    const d = good();
    d.gaps = cf.promises.map((p, i) => ({
      promiseId: p.id, status: i === 0 ? "fulfilled" : "missing", evidenceIds: [todo],
    }));
    const s = score(toScoreInput(cf, Diagnosis.parse(d)));
    expect(s.provisional).toBe(false);
    expect(s.gap.points).toBe(6.3); // 25 * 1 / 4
    expect(s.final).toBe(s.base + 6.3);
  });
});
