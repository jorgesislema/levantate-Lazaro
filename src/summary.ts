import { z } from "zod";
import type { Casefile } from "./casefile.js";
import type { Diagnosis } from "./diagnosis.js";
import type { TaskManifest } from "./manifest.js";
import type { Verification } from "./verify.js";
import { shareable } from "./text.js";

export const MAX_SUMMARY_BYTES = 16 * 1024;
export const MAX_REVIEW_FILES = 20;

export const Summary = z.object({
  schemaVersion: z.literal(1),
  label: z.string().min(1).max(60),
  snapshotId: z.string().regex(/^[0-9a-f]{16}$/),
  snapshotAt: z.string(),
  exportedAt: z.string(),
  goal: z.string().min(1).max(300),
  blocker: z.string().min(1).max(300),
  nextAction: z.string().min(1).max(300),
  improvement: z.string().max(300).optional(),
  evidenceRefs: z.array(z.string().regex(/^E\d+$/)).max(10),
  check: z.object({
    status: z.enum(["not_run", "failed", "blocked", "timed_out", "stale", "verified"]),
    asOf: z.string(),
  }),
});
export type Summary = z.infer<typeof Summary>;

export interface ExportInput {
  label: string;
  casefile: Casefile;
  diagnosis?: Diagnosis;
  verification?: Verification;
  manifest?: TaskManifest;
  now?: Date;
}

/** What the owner should do next, derived from recorded state only. */
export function nextActionOf(i: Pick<ExportInput, "diagnosis" | "verification" | "manifest">, status: Summary["check"]["status"]): string {
  if (status === "verified") return "Review the change, then approve the next task.";
  if (i.manifest) return `Approve task ${i.manifest.taskId}: ${i.manifest.expectedBehavior}`;
  if (i.diagnosis) return "Write the revival plan and choose how to check the first milestone.";
  return "Answer the five interview questions, then run the diagnosis.";
}

export function exportSummary(i: ExportInput): Summary {
  const now = i.now ?? new Date();
  // Verification counts only when it belongs to the snapshot being exported.
  const v = i.verification && i.verification.caseId === i.casefile.caseId ? i.verification : undefined;
  const status: Summary["check"]["status"] = v ? v.status : i.verification ? "stale" : "not_run";
  const d = i.diagnosis && i.diagnosis.caseId === i.casefile.caseId ? i.diagnosis : undefined;

  const refs = d ? [...new Set([...d.blocker.evidenceIds, ...d.evidenceIds])].slice(0, 10) : [];
  const summary: Summary = {
    schemaVersion: 1,
    label: shareable(i.label, 60) || "project",
    snapshotId: i.casefile.caseId,
    snapshotAt: i.casefile.scannedAt,
    exportedAt: now.toISOString(),
    goal: shareable(d?.intentSummary ?? "Not diagnosed yet.", 300),
    blocker: shareable(d?.blocker.text ?? "Unknown until the diagnosis is written.", 300),
    nextAction: shareable(nextActionOf({ diagnosis: d, verification: v, manifest: i.manifest }, status), 300),
    evidenceRefs: refs,
    check: { status, asOf: v?.at ?? now.toISOString() },
  };
  if (d?.opportunity) summary.improvement = shareable(d.opportunity.text, 300);
  return Summary.parse(summary);
}
