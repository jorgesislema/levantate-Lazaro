import { z } from "zod";
import type { Casefile } from "./casefile.js";
import type { ScoreInput, Status } from "./score.js";

const Ids = z.array(z.string().regex(/^E\d+$/));

export const Diagnosis = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().regex(/^[0-9a-f]{16}$/),
  cause: z.enum(["technical_block", "dependency_rot", "scope_creep", "context_loss", "unknown"]),
  confidence: z.enum(["high", "medium", "low"]),
  evidenceIds: Ids,
  /** What the owner said. Stays attributed; it is not a fact. */
  recollection: z.string().max(600),
  gaps: z.array(
    z.object({
      promiseId: z.string().regex(/^P\d+$/),
      status: z.enum(["fulfilled", "partial", "missing", "unknown"]),
      evidenceIds: Ids,
    }),
  ),
  intentSummary: z.string().min(1).max(600),
  blocker: z.object({ text: z.string().min(1).max(400), evidenceIds: Ids }),
  reviewSignals: z
    .array(
      z.object({
        category: z.enum(["security", "complexity", "quality"]),
        text: z.string().min(1).max(300),
        evidenceIds: Ids,
        uncertainty: z.string().min(1).max(200),
        nextAction: z.string().min(1).max(200),
      }),
    )
    .max(3),
  opportunity: z
    .object({
      text: z.string().min(1).max(300),
      evidenceIds: Ids,
      userGoal: z.string().max(300).optional(),
      benefit: z.string().min(1).max(200),
      effortMinutes: z.number().int().positive(),
      acceptance: z.string().min(1).max(200),
    })
    .optional(),
});
export type Diagnosis = z.infer<typeof Diagnosis>;

export interface Validation { ok: boolean; stale: boolean; errors: string[] }

/** Check a diagnosis against the casefile it claims to describe. */
export function validateDiagnosis(d: Diagnosis, c: Casefile): Validation {
  const errors: string[] = [];
  const stale = d.caseId !== c.caseId;
  if (stale) errors.push(`stale: diagnosis is for case ${d.caseId}, casefile is ${c.caseId}. Run scan and diagnose again.`);

  const evidence = new Map(c.evidence.map((e) => [e.id, e]));
  const promiseIds = new Set(c.promises.map((p) => p.id));
  const checkIds = (where: string, ids: string[]) => {
    for (const id of ids) if (!evidence.has(id)) errors.push(`${where}: unknown evidence ${id}`);
  };

  checkIds("diagnosis", d.evidenceIds);
  checkIds("blocker", d.blocker.evidenceIds);
  d.reviewSignals.forEach((s, i) => checkIds(`reviewSignals[${i}]`, s.evidenceIds));
  if (d.opportunity) {
    checkIds("opportunity", d.opportunity.evidenceIds);
    if (d.opportunity.evidenceIds.length === 0 && !d.opportunity.userGoal)
      errors.push("opportunity: cite evidence or an attributed user goal");
  }

  if (d.cause !== "unknown" && d.evidenceIds.length === 0) errors.push("cause: a known cause needs evidence");
  if (d.confidence === "high" && d.evidenceIds.length < 2) errors.push("confidence: high needs two or more evidence items");
  if (d.blocker.evidenceIds.length === 0) errors.push("blocker: cite evidence");

  const seen = new Set<string>();
  for (const g of d.gaps) {
    if (!promiseIds.has(g.promiseId)) errors.push(`gaps: unknown promise ${g.promiseId}`);
    if (seen.has(g.promiseId)) errors.push(`gaps: promise ${g.promiseId} classified twice`);
    seen.add(g.promiseId);
    checkIds(`gaps ${g.promiseId}`, g.evidenceIds);
    if (g.status !== "unknown" && g.evidenceIds.length === 0)
      errors.push(`gaps ${g.promiseId}: ${g.status} needs evidence`);
    if (g.status === "missing") {
      const positive = g.evidenceIds.some((id) => {
        const e = evidence.get(id);
        return e?.kind === "file" && e.label === "todo";
      });
      if (!positive) errors.push(`gaps ${g.promiseId}: missing needs a pending TODO as evidence`);
    }
  }
  return { ok: errors.length === 0, stale, errors };
}

/** Build the pure scoring input from a casefile and an optional diagnosis. */
export function toScoreInput(c: Casefile, d?: Diagnosis, checkVerified = false): ScoreInput {
  const byPromise = new Map<string, Status>();
  if (d) for (const g of d.gaps) byPromise.set(g.promiseId, g.status);
  return {
    daysInactive: c.activity.daysInactive,
    testFiles: c.integrity.testFiles,
    ci: c.integrity.ci,
    buildScript: c.integrity.buildScript,
    checkVerified,
    lockfile: c.deps.lockfile,
    direct: c.deps.direct,
    unpinned: c.deps.unpinned.length,
    truncated: c.coverage.truncated,
    readme: c.clarity.readme,
    readmeChars: c.clarity.readmeChars,
    license: c.clarity.license,
    description: c.clarity.description,
    promises: c.promises.map((p) => byPromise.get(p.id) ?? "unknown"),
  };
}
