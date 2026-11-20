import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Casefile } from "./casefile.js";
import { Diagnosis } from "./diagnosis.js";
import { bind, digestsFor, TaskManifest, type ManifestDraft } from "./manifest.js";
import { canEditSource } from "./profiles.js";
import { writeAtomic } from "./casefile.js";
import { existsSync } from "node:fs";
import { loadRecorded, REPLAY_DIR } from "./recorded.js";

const REPLAY = REPLAY_DIR;
export const PROPERTY = { seed: 42, runs: 200, timeoutMs: 10000, path: "check/expense-property.mjs" } as const;

function tokens(c: Casefile): Record<string, string> {
  const file = c.evidence.filter((e) => e.kind === "file");
  const promise = file.filter((e) => e.label === "promise");
  const first = (label: string) => file.find((e) => e.label === label)?.id ?? "E0";
  return {
    $CASE: c.caseId,
    $TODO: first("todo"),
    $SECRET: first("secret-lead"),
    $PROMISE1: promise[0]?.id ?? "E0",
    $PROMISE4: promise[3]?.id ?? "E0",
  };
}

function fill(raw: string, t: Record<string, string>): string {
  // Longest tokens first so $PROMISE1 is never cut by a shorter token.
  return Object.keys(t).sort((a, b) => b.length - a.length).reduce((s, k) => s.replaceAll(k, t[k]!), raw);
}

export function replayDiagnosis(c: Casefile): Diagnosis {
  const raw = readFileSync(join(REPLAY, "diagnosis.template.json"), "utf8");
  return Diagnosis.parse(JSON.parse(fill(raw, tokens(c))));
}

export function replayManifest(c: Casefile, fixtureRoot: string, opts: { properties?: boolean } = {}): TaskManifest {
  const t = JSON.parse(readFileSync(join(REPLAY, "task-1.template.json"), "utf8")) as Record<string, unknown> & {
    harness: string[]; fixtures: string[]; evaluation: Record<string, unknown>;
  };
  const evaluation = opts.properties
    ? {
        ...t.evaluation,
        recommended: "simple+properties",
        selection: "simple+properties",
        reason: "A known input and total establish the milestone. The invariant that reordering keeps the total is confirmed and a bounded seeded harness exists.",
        property: {
          rule: "Reversing the expense list preserves the total",
          argv: ["node", PROPERTY.path],
          harness: digestsFor(fixtureRoot, [PROPERTY.path])[0],
          seed: PROPERTY.seed, runs: PROPERTY.runs, timeoutMs: PROPERTY.timeoutMs,
        },
      }
    : t.evaluation;
  const draft = {
    schemaVersion: 1,
    caseId: c.caseId,
    ...(t as object),
    evaluation,
    harness: digestsFor(fixtureRoot, t.harness),
    fixtures: digestsFor(fixtureRoot, t.fixtures),
  } as ManifestDraft;
  return TaskManifest.parse(bind(draft));
}

/** Write the replayed diagnosis and task manifest into a fixture workspace. */
export function writeReplayPlan(root: string, c: Casefile, opts: { properties?: boolean } = {}): TaskManifest {
  const m = replayManifest(c, root, opts);
  writeAtomic(join(root, ".lazarus", "diagnosis.json"), JSON.stringify(replayDiagnosis(c), null, 2) + "\n");
  writeAtomic(join(root, ".kiro", "specs", "revival", "task-1.json"), JSON.stringify(m, null, 2) + "\n");
  return m;
}

/** Apply the disclosed, recorded change. Allowed only inside the approved paths. */
export function applyRecordedChange(root: string, m: TaskManifest): string {
  const target = m.allowedPaths[0]!;
  if (!canEditSource("resurrection", true, m.allowedPaths, target)) throw new Error(`edit not allowed: ${target}`);
  mkdirSync(dirname(join(root, target)), { recursive: true });
  const recorded = join(REPLAY, "recorded", "change");
  copyFileSync(existsSync(recorded) ? recorded : join(REPLAY, "legacy-entry.fixed.js"), join(root, target));
  return target;
}

export interface Plan {
  manifest: TaskManifest;
  diagnosis: Diagnosis;
  /** "recorded" comes from a real Kiro session. "placeholder" is hand-authored. */
  source: "recorded" | "placeholder";
  provenance?: { surface: string; model: string; recordedAt: string };
}

/** Use the recorded Kiro session when it matches this casefile, else the placeholder templates. */
export function planFor(root: string, c: Casefile, opts: { properties?: boolean } = {}): Plan {
  const rec = loadRecorded(c, root);
  if (rec) {
    writeAtomic(join(root, ".lazarus", "diagnosis.json"), JSON.stringify(rec.diagnosis, null, 2) + "\n");
    writeAtomic(join(root, ".kiro", "specs", "revival", "task-1.json"), JSON.stringify(rec.manifest, null, 2) + "\n");
    return { manifest: rec.manifest, diagnosis: rec.diagnosis, source: "recorded", provenance: rec.provenance };
  }
  const manifest = writeReplayPlan(root, c, opts);
  return { manifest, diagnosis: replayDiagnosis(c), source: "placeholder" };
}
