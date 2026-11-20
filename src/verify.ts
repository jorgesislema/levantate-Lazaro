import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonical, sha256 } from "./canon.js";
import { writeAtomic, type Casefile } from "./casefile.js";
import { git } from "./git.js";
import { validateManifest, type TaskManifest } from "./manifest.js";
import { redact } from "./redact.js";
import { readText } from "./scan.js";

export type Status = "not_run" | "failed" | "blocked" | "timed_out" | "stale" | "verified";
export type PropertyStatus = "not_selected" | "passed" | "failed" | "timed_out" | "blocked";

export interface Run { kind: "exit" | "timeout" | "blocked"; code: number | null; signature: string }

/** Run an approved argv without a shell. Only `node` is a supported executable. */
export function runCheck(root: string, argv: string[], timeoutMs: number): Run {
  if (argv[0] !== "node") return { kind: "blocked", code: null, signature: `unsupported executable: ${argv[0]}` };
  const r = spawnSync(process.execPath, argv.slice(1), { cwd: root, encoding: "utf8", timeout: timeoutMs, shell: false });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT") return { kind: "timeout", code: null, signature: "timed out" };
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const line = out.split("\n").find((l) => /(FAIL|Error)/.test(l)) ?? out.split("\n").find((l) => l.trim()) ?? "";
  return { kind: "exit", code: r.status, signature: redact(line, 160) };
}

/** Hash of every tracked or untracked, non-ignored text file, excluding generated artifacts. */
export function snapshotFiles(root: string): Record<string, string> {
  const list = git(root, ["ls-files", "-z", "-c", "-o", "--exclude-standard"])
    .split("\0").filter((p) => p && !p.startsWith(".lazarus/")).sort().slice(0, 5000);
  const out: Record<string, string> = {};
  for (const rel of list) {
    const t = readText(root, rel, { symlink: 0, oversized: 0, binary: 0 });
    if (t !== null) out[rel] = sha256(t);
  }
  return out;
}
const digestOf = (m: Record<string, string>) => sha256(canonical(m)).slice(0, 16);

export function checkDigest(m: TaskManifest): string {
  return sha256(canonical({ argv: m.check.argv, harness: m.harness, fixtures: m.fixtures, property: m.evaluation.property ?? null })).slice(0, 16);
}

export interface Baseline {
  caseId: string; taskId: string; planDigest: string; at: string;
  files: Record<string, string>; snapshot: string; checkDigest: string;
  exit: number | null; signature: string;
}

export interface Verification {
  schemaVersion: 1; caseId: string; taskId: string; planDigest: string;
  status: Status; reason: string;
  before: string | null; after: string | null; changedPaths: string[];
  checkDigest: string; baselineSignature: string | null;
  recovery: { exit: number | null; signature: string } | null;
  property: { status: PropertyStatus; detail: string };
  at: string;
}

const lz = (root: string, f: string) => join(root, ".lazarus", f);

function result(m: TaskManifest, status: Status, reason: string, at: string, extra: Partial<Verification> = {}): Verification {
  return {
    schemaVersion: 1, caseId: m.caseId, taskId: m.taskId, planDigest: m.planDigest, status, reason,
    before: null, after: null, changedPaths: [], checkDigest: checkDigest(m), baselineSignature: null,
    recovery: null, property: { status: "not_selected", detail: "" }, at, ...extra,
  };
}

/** Phase 1: run the approved check before the repair and require the expected failure. */
export function recordBaseline(root: string, m: TaskManifest, c: Casefile, now = new Date()): Verification | Baseline {
  const at = now.toISOString();
  const v = validateManifest(m, c, root);
  if (!v.ok) return finish(root, result(m, v.errors.some((e) => e.startsWith("stale")) ? "stale" : "blocked", v.errors.join("; "), at));

  const run = runCheck(root, m.check.argv, m.check.timeoutMs);
  if (run.kind === "blocked") return finish(root, result(m, "blocked", run.signature, at));
  if (run.kind === "timeout") return finish(root, result(m, "timed_out", "baseline timed out", at));
  if (run.code === 0) return finish(root, result(m, "blocked", "unexpected baseline: the check already passes", at));
  if (!run.signature.includes(m.expectedBaselineFailure))
    return finish(root, result(m, "blocked", `unexpected baseline: got "${run.signature}"`, at, { baselineSignature: run.signature }));

  const files = snapshotFiles(root);
  const b: Baseline = {
    caseId: m.caseId, taskId: m.taskId, planDigest: m.planDigest, at, files, snapshot: digestOf(files),
    checkDigest: checkDigest(m), exit: run.code, signature: run.signature,
  };
  writeAtomic(lz(root, "baseline.json"), JSON.stringify(b, null, 2) + "\n");
  return b;
}

function finish(root: string, v: Verification): Verification {
  writeAtomic(lz(root, "verification.json"), JSON.stringify(v, null, 2) + "\n");
  return v;
}

export const isBaseline = (x: Verification | Baseline): x is Baseline => "files" in x;

/** Phase 2: after the repair, confirm scope and rerun the same check. */
export function verifyAfter(root: string, m: TaskManifest, c: Casefile, now = new Date()): Verification {
  const at = now.toISOString();
  const v = validateManifest(m, c, root);
  if (!v.ok) return finish(root, result(m, v.errors.some((e) => e.startsWith("stale")) ? "stale" : "blocked", v.errors.join("; "), at));

  let b: Baseline;
  try {
    b = JSON.parse(readFileSync(lz(root, "baseline.json"), "utf8")) as Baseline;
  } catch {
    return finish(root, result(m, "blocked", "no baseline recorded for this plan", at));
  }
  if (b.planDigest !== m.planDigest || b.caseId !== m.caseId)
    return finish(root, result(m, "stale", "baseline belongs to a different plan or casefile", at));
  if (b.checkDigest !== checkDigest(m))
    return finish(root, result(m, "blocked", "check, harness or selection changed since the baseline", at));

  const after = snapshotFiles(root);
  const paths = new Set([...Object.keys(b.files), ...Object.keys(after)]);
  const changed = [...paths].filter((p) => b.files[p] !== after[p]).sort();
  const outside = changed.filter((p) => !m.allowedPaths.includes(p));
  const base = { before: b.snapshot, after: digestOf(after), changedPaths: changed, baselineSignature: b.signature };
  if (outside.length) return finish(root, result(m, "blocked", `scope drift: ${outside.join(", ")}`, at, base));

  const run = runCheck(root, m.check.argv, m.check.timeoutMs);
  if (run.kind === "blocked") return finish(root, result(m, "blocked", run.signature, at, base));
  if (run.kind === "timeout") return finish(root, result(m, "timed_out", "check timed out after the change", at, base));
  const recovery = { exit: run.code, signature: run.signature };
  if (run.code !== 0) return finish(root, result(m, "failed", "the check still fails", at, { ...base, recovery }));

  // The recovery check passed. A selected property is recorded separately.
  let property: Verification["property"] = { status: "not_selected", detail: "" };
  const p = m.evaluation.property;
  if (m.evaluation.selection === "simple+properties" && p) {
    const pr = runCheck(root, [...p.argv, "--seed", String(p.seed), "--runs", String(p.runs)], p.timeoutMs);
    property =
      pr.kind === "timeout" ? { status: "timed_out", detail: "timed out" }
      : pr.kind === "blocked" ? { status: "blocked", detail: pr.signature }
      : pr.code === 0 ? { status: "passed", detail: pr.signature }
      : { status: "failed", detail: pr.signature };
  }
  return finish(root, result(m, "verified", "expected baseline failure, then the same check passes", at, { ...base, recovery, property }));
}
