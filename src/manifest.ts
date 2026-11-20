import { z } from "zod";
import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { canonical, sha256 } from "./canon.js";
import type { Casefile } from "./casefile.js";

const RelPath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !/^[a-zA-Z]:/.test(p) && !p.split(/[\\/]/).includes("..") && !/[*?]/.test(p), "must be a plain relative path");
const Digest = z.object({ path: RelPath, sha256: z.string().regex(/^[0-9a-f]{64}$/) });

export const TaskManifest = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().regex(/^[0-9a-f]{16}$/),
  taskId: z.string().regex(/^T\d+$/),
  requirementIds: z.array(z.string().regex(/^R\d+$/)).min(1),
  allowedPaths: z.array(RelPath).min(1),
  /** The behavior the operator confirmed. */
  expectedBehavior: z.string().min(1).max(300),
  expectedBaselineFailure: z.string().min(1).max(200),
  check: z.object({ argv: z.array(z.string().min(1)).min(1), timeoutMs: z.number().int().min(1000).max(60000) }),
  harness: z.array(Digest).min(1),
  fixtures: z.array(Digest),
  evaluation: z.object({
    recommended: z.enum(["simple", "simple+properties"]),
    reason: z.string().min(1).max(300),
    selection: z.enum(["simple", "simple+properties"]),
    advisory: z.array(z.string()).max(5),
    property: z
      .object({
        rule: z.string().min(1).max(200),
        argv: z.array(z.string().min(1)).min(1),
        harness: Digest,
        seed: z.number().int(),
        runs: z.number().int().min(1).max(1000),
        timeoutMs: z.number().int().min(1000).max(60000),
      })
      .optional(),
  }),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
});
export type TaskManifest = z.infer<typeof TaskManifest>;
export type ManifestDraft = Omit<TaskManifest, "planDigest">;

export function planDigestOf(m: ManifestDraft): string {
  return sha256(canonical(m));
}

export function bind(draft: ManifestDraft): TaskManifest {
  return { ...draft, planDigest: planDigestOf(draft) };
}

export function fileDigest(root: string, rel: string): string {
  const abs = resolve(root, rel);
  if (!abs.startsWith(resolve(root) + sep)) throw new Error(`path escapes the workspace: ${rel}`);
  return sha256(readFileSync(abs, "utf8"));
}

/** Fill the digests of harness and fixture files from disk. Used when binding a template. */
export function digestsFor(root: string, paths: string[]): { path: string; sha256: string }[] {
  return paths.map((path) => ({ path, sha256: fileDigest(root, path) }));
}

export interface ManifestCheck { ok: boolean; errors: string[] }

/** Validate a manifest against the casefile and, when `root` is given, the files on disk. */
export function validateManifest(m: TaskManifest, c: Casefile, root?: string): ManifestCheck {
  const errors: string[] = [];
  const { planDigest, ...draft } = m;
  if (planDigest !== planDigestOf(draft)) errors.push("planDigest: approval does not match this manifest");
  if (m.caseId !== c.caseId) errors.push(`stale: manifest is for case ${m.caseId}, casefile is ${c.caseId}`);

  const locked = new Set([...m.harness, ...m.fixtures, ...(m.evaluation.property ? [m.evaluation.property.harness] : [])].map((d) => d.path));
  for (const p of m.allowedPaths)
    if (locked.has(p)) errors.push(`allowedPaths: ${p} is a locked check file and cannot be edited`);

  const ev = m.evaluation;
  if (ev.selection === "simple+properties" && !ev.property) errors.push("evaluation: simple+properties needs a property check");
  if (ev.selection === "simple" && ev.property) errors.push("evaluation: a property is defined but not selected");

  if (root) {
    const all = [...m.harness, ...m.fixtures, ...(ev.property ? [ev.property.harness] : [])];
    for (const d of all) {
      try {
        if (fileDigest(root, d.path) !== d.sha256) errors.push(`${d.path}: changed since approval`);
      } catch {
        errors.push(`${d.path}: cannot be read`);
      }
    }
    for (const p of m.allowedPaths) {
      if (!resolve(root, p).startsWith(resolve(root) + sep)) errors.push(`allowedPaths: ${p} escapes the workspace`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function readManifest(dir: string, rel = ".kiro/specs/revival/task-1.json"): TaskManifest {
  return TaskManifest.parse(JSON.parse(readFileSync(join(dir, rel), "utf8")));
}
