import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Casefile } from "./casefile.js";
import { Diagnosis, validateDiagnosis } from "./diagnosis.js";
import { bind, TaskManifest, validateManifest } from "./manifest.js";

export const REPLAY_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "replay", "gastos-app");

export const Provenance = z.object({
  surface: z.enum(["kiro-ide", "kiro-cli", "kiro-web", "kiro-crew"]),
  model: z.string().min(1).max(80),
  recordedAt: z.string(),
  agent: z.string().min(1).max(40),
  correctionPasses: z.number().int().min(0).max(5),
  note: z.string().max(300).default(""),
});
export type Provenance = z.infer<typeof Provenance>;

export interface Recorded { diagnosis: Diagnosis; manifest: TaskManifest; provenance: Provenance }

const dirOf = (replayDir: string) => join(replayDir, "recorded");

/**
 * Store a real Kiro session's diagnosis and task manifest as the replay inputs.
 * Both must validate against the fixture's own casefile and files first.
 */
export function importRecorded(args: {
  fixtureRoot: string; casefile: Casefile; diagnosisPath: string; manifestPath: string;
  provenance: unknown; replayDir?: string;
}): Recorded {
  const diagnosis = Diagnosis.parse(JSON.parse(readFileSync(args.diagnosisPath, "utf8")));
  const manifest = TaskManifest.parse(JSON.parse(readFileSync(args.manifestPath, "utf8")));
  const provenance = Provenance.parse(args.provenance);

  const d = validateDiagnosis(diagnosis, args.casefile);
  if (!d.ok) throw new Error(`diagnosis is not valid: ${d.errors.join("; ")}`);
  const m = validateManifest(manifest, args.casefile, args.fixtureRoot);
  if (!m.ok) throw new Error(`manifest is not valid: ${m.errors.join("; ")}`);

  const out = dirOf(args.replayDir ?? REPLAY_DIR);
  mkdirSync(out, { recursive: true });
  copyFileSync(args.diagnosisPath, join(out, "diagnosis.json"));
  copyFileSync(args.manifestPath, join(out, "task-1.json"));
  // The real edit: the final content of the single approved file in the fixture working copy.
  if (manifest.allowedPaths.length !== 1) throw new Error("recording supports exactly one approved path");
  copyFileSync(join(args.fixtureRoot, manifest.allowedPaths[0]!), join(out, "change"));
  writeFileSync(join(out, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
  return { diagnosis, manifest, provenance };
}

/**
 * The recorded session, if one exists and fits this fixture.
 * The session ran in a workspace with extra untracked kit files, so its case ID differs from a
 * fresh fixture scan. The recording is rebound to this casefile, then fully validated: every
 * evidence ID and promise ID it cites must exist here, and the check files must be unchanged.
 */
export function loadRecorded(casefile: Casefile, fixtureRoot: string, replayDir = REPLAY_DIR): Recorded | null {
  const dir = dirOf(replayDir);
  if (!existsSync(join(dir, "provenance.json")) || !existsSync(join(dir, "change"))) return null;
  try {
    const d = Diagnosis.parse(JSON.parse(readFileSync(join(dir, "diagnosis.json"), "utf8")));
    const m = TaskManifest.parse(JSON.parse(readFileSync(join(dir, "task-1.json"), "utf8")));
    const provenance = Provenance.parse(JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8")));
    const diagnosis: Diagnosis = { ...d, caseId: casefile.caseId };
    const { planDigest: _drop, ...rest } = m;
    const manifest = TaskManifest.parse(bind({ ...rest, caseId: casefile.caseId }));
    if (!validateDiagnosis(diagnosis, casefile).ok || !validateManifest(manifest, casefile, fixtureRoot).ok) return null;
    return { diagnosis, manifest, provenance };
  } catch {
    return null;
  }
}