import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeAtomic } from "./casefile.js";
import { renderReport } from "./report.js";
import { applyRecordedChange, planFor } from "./replay.js";
import { renderReviewHtml, renderTable, review } from "./review.js";
import { scanAndWrite } from "./scan.js";
import { exportSummary } from "./summary.js";
import { isBaseline, recordBaseline, verifyAfter } from "./verify.js";

const MAKE = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "make-fixtures.mjs");
export const DEMO_CLOCK = new Date("2026-11-20T00:00:00Z");

export interface DemoResult { dir: string; report: string; summaries: string[]; reviewHtml: string; status: string }

/**
 * Offline replay on the synthetic fixture. Stored diagnosis and the recorded change are
 * replay inputs. Every check runs live. No network, no model, no API key.
 */
export function runDemo(out: string, log: (s: string) => void = console.log): DemoResult {
  const root = resolve(out);
  const dir = join(root, "gastos-app");
  mkdirSync(root, { recursive: true });
  const step = (n: number, s: string) => log(`[${n}/7] ${s}`);

  step(1, "Generate the synthetic fixture (fixed Git history, last commit 2024-03-12)");
  execFileSync(process.execPath, [MAKE, dir], { stdio: "pipe" });

  step(2, `Scan offline with the recorded demo clock ${DEMO_CLOCK.toISOString()}`);
  const { casefile: cf } = scanAndWrite({ dir, clock: DEMO_CLOCK });
  log(`      casefile ${cf.caseId}: ${cf.coverage.scannedFiles} files, ${cf.coverage.commits} commits, ${cf.activity.daysInactive} days inactive`);

  const plan = planFor(dir, cf, { properties: true });
  const m = plan.manifest;
  const diagnosis = plan.diagnosis;
  step(3, plan.source === "recorded"
    ? `Load the diagnosis and plan recorded from a real Kiro session (REPLAY inputs: ${plan.provenance!.surface}, ${plan.provenance!.model}, ${plan.provenance!.recordedAt.slice(0, 10)})`
    : "Load the stored diagnosis and plan (REPLAY inputs, hand-authored placeholder, not a live Kiro run)");
  const before = exportSummary({ label: "gastos-app (before)", casefile: cf, diagnosis, manifest: m, now: DEMO_CLOCK });

  step(4, "Run the approved check before any change (LIVE)");
  const b = recordBaseline(dir, m, cf, DEMO_CLOCK);
  if (!isBaseline(b)) throw new Error(`baseline failed: ${b.status}: ${b.reason}`);
  log(`      expected failure seen: ${b.signature}`);

  step(5, "Apply the recorded change inside the approved paths (REPLAY)");
  log(`      edited ${applyRecordedChange(dir, m)}`);

  step(6, "Run the same check again, then the seeded property check (LIVE)");
  const v = verifyAfter(dir, m, cf, DEMO_CLOCK);
  log(`      ${v.status}: ${v.reason}`);
  log(`      property ${v.property.status}: ${v.property.detail}`);
  if (v.status !== "verified") throw new Error(`verification failed: ${v.reason}`);

  step(7, "Write the report and compare two summaries as a mentor would");
  const reportPath = join(root, "report.html");
  writeAtomic(reportPath, renderReport({ label: "gastos-app", casefile: cf, diagnosis, verification: v, manifest: m }));
  const after = exportSummary({ label: "gastos-app (after)", casefile: cf, diagnosis, verification: v, manifest: m, now: DEMO_CLOCK });
  const files = [join(root, "summaries", "before.json"), join(root, "summaries", "after.json")];
  writeAtomic(files[0]!, JSON.stringify(before, null, 2) + "\n");
  writeAtomic(files[1]!, JSON.stringify(after, null, 2) + "\n");
  const r = review(files);
  log(renderTable(r).split("\n").map((l) => "      " + l).join("\n"));
  const reviewHtml = join(root, "review.html");
  writeAtomic(reviewHtml, renderReviewHtml(r));

  log(`\nDone. Open ${reportPath}`);
  return { dir, report: reportPath, summaries: files, reviewHtml, status: v.status };
}
