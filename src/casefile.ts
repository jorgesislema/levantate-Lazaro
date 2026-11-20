import { z } from "zod";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonical, sha256 } from "./canon.js";

export const BUDGET_BYTES = 4096;

const Evidence = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().regex(/^E\d+$/),
    kind: z.literal("file"),
    path: z.string().min(1).refine((p) => !p.startsWith("/") && !p.includes(".."), "invalid path"),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    label: z.enum(["promise", "todo", "secret-lead"]),
    excerpt: z.string().max(81).optional(),
  }),
  z.object({ id: z.string().regex(/^E\d+$/), kind: z.literal("commit"), hash: z.string().regex(/^[0-9a-f]{40}$/) }),
]);

export const Casefile = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().regex(/^[0-9a-f]{16}$/),
    scannedAt: z.string(),
    snapshot: z.object({
      head: z.string().nullable(),
      branch: z.string().nullable(),
      dirtyFiles: z.number().int().min(0),
      digest: z.string(),
    }),
    coverage: z.object({
      trackedPaths: z.number().int().min(0),
      scannedFiles: z.number().int().min(0),
      skipped: z.object({
        symlink: z.number().int().min(0),
        oversized: z.number().int().min(0),
        binary: z.number().int().min(0),
      }),
      commits: z.number().int().min(0),
      history: z.enum(["ok", "empty", "truncated"]),
      truncated: z.boolean(),
      omittedEvidence: z.number().int().min(0),
    }),
    activity: z.object({
      lastCommit: z.string().nullable(),
      daysInactive: z.number().int().min(0).nullable(),
      clockSkew: z.boolean(),
    }),
    integrity: z.object({
      testFiles: z.number().int().min(0),
      ci: z.boolean(),
      buildScript: z.boolean(),
      recordedCheck: z.literal("not_run"),
      secretLeads: z.number().int().min(0),
      todoMarkers: z.number().int().min(0),
    }),
    deps: z.object({
      runtime: z.string().nullable(),
      lockfile: z.boolean(),
      direct: z.number().int().min(0),
      unpinned: z.array(z.string()),
    }),
    clarity: z.object({
      readme: z.boolean(),
      readmeChars: z.number().int().min(0),
      license: z.boolean(),
      description: z.boolean(),
    }),
    codeMap: z.object({
      entrypoints: z.array(z.string()),
      dirs: z.array(z.object({ dir: z.string(), files: z.number().int().min(0) })),
    }),
    advisories: z.object({ status: z.literal("not_scanned") }),
    promises: z.array(
      z.object({
        id: z.string().regex(/^P\d+$/),
        text: z.string(),
        status: z.enum(["fulfilled", "partial", "missing", "unknown"]),
        evidenceIds: z.array(z.string()),
      }),
    ),
    evidence: z.array(Evidence),
    contextPaths: z.array(z.string()),
  })
  .superRefine((c, ctx) => {
    const ids = new Set<string>();
    for (const e of c.evidence) {
      if (ids.has(e.id)) ctx.addIssue({ code: "custom", message: `duplicate evidence ${e.id}` });
      ids.add(e.id);
    }
    for (const p of c.promises)
      for (const id of p.evidenceIds)
        if (!ids.has(id)) ctx.addIssue({ code: "custom", message: `dangling evidence ${id} in ${p.id}` });
  });

export type Casefile = z.infer<typeof Casefile>;
export type CasefileDraft = Omit<Casefile, "caseId">;

export function caseIdOf(draft: CasefileDraft): string {
  return sha256(canonical(draft)).slice(0, 16);
}

export function finalize(draft: CasefileDraft): Casefile {
  return Casefile.parse({ ...draft, caseId: caseIdOf(draft) });
}

/** Drop the lowest-priority evidence until the serialized casefile fits the budget. */
export function fitBudget(draft: CasefileDraft): Casefile {
  let d = draft;
  let cf = finalize(d);
  while (JSON.stringify(cf).length > BUDGET_BYTES && d.evidence.length > 0) {
    const pinned = new Set(d.promises.flatMap((p) => p.evidenceIds));
    let idx = -1;
    for (let i = d.evidence.length - 1; i >= 0; i--) {
      if (!pinned.has(d.evidence[i]!.id)) { idx = i; break; }
    }
    if (idx < 0) break;
    const evidence = d.evidence.filter((_, i) => i !== idx);
    d = { ...d, evidence, coverage: { ...d.coverage, omittedEvidence: d.coverage.omittedEvidence + 1 } };
    cf = finalize(d);
  }
  return cf;
}

/** Write via a temp file in the same directory, then rename. */
export function writeAtomic(path: string, data: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.tmp-${process.pid}-${Date.now()}`);
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}
