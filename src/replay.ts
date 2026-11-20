import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Casefile } from "./casefile.js";
import { Diagnosis } from "./diagnosis.js";
import { bind, digestsFor, TaskManifest, type ManifestDraft } from "./manifest.js";

const REPLAY = join(dirname(fileURLToPath(import.meta.url)), "..", "replay", "gastos-app");

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

export function replayManifest(c: Casefile, fixtureRoot: string): TaskManifest {
  const t = JSON.parse(readFileSync(join(REPLAY, "task-1.template.json"), "utf8")) as Record<string, unknown> & {
    harness: string[]; fixtures: string[];
  };
  const draft: ManifestDraft = {
    schemaVersion: 1,
    caseId: c.caseId,
    ...(t as object),
    harness: digestsFor(fixtureRoot, t.harness),
    fixtures: digestsFor(fixtureRoot, t.fixtures),
  } as ManifestDraft;
  return TaskManifest.parse(bind(draft));
}
