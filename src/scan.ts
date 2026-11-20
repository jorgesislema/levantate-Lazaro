import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { git, tryGit } from "./git.js";
import { sha256 } from "./canon.js";
import { redact, hasSecretLead } from "./redact.js";
import { fitBudget, writeAtomic, type Casefile, type CasefileDraft } from "./casefile.js";

export const CAPS = { paths: 5000, fileBytes: 128 * 1024, commits: 100 } as const;
const DAY_MS = 86_400_000;
const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
  "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock",
]);
const CI = [/^\.github\/workflows\//, /^\.gitlab-ci\.yml$/, /^azure-pipelines\.yml$/, /^\.circleci\//];
const TEST = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[a-z]+$/i;
const MARKER = /\b(TODO|FIXME)\b/;

export interface ScanOptions { dir: string; clock?: Date }
type Ev = Extract<Casefile["evidence"][number], { kind: "file" }>;
type EvDraft = Omit<Ev, "id">;

export function readText(root: string, rel: string, skipped: { symlink: number; oversized: number; binary: number }): string | null {
  const abs = resolve(root, rel);
  if (!abs.startsWith(root + sep)) return null;
  let st;
  try { st = lstatSync(abs); } catch { return null; }
  if (st.isSymbolicLink()) { skipped.symlink++; return null; }
  if (!st.isFile()) return null;
  if (st.size > CAPS.fileBytes) { skipped.oversized++; return null; }
  const buf = readFileSync(abs);
  if (buf.includes(0)) { skipped.binary++; return null; }
  return buf.toString("utf8");
}

function readmePromises(text: string): { text: string; line: number }[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s+promises\b/i.test(l));
  if (start < 0) return [];
  const out: { text: string; line: number }[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (/^#{1,6}\s/.test(l)) break;
    const m = /^\s*[-*]\s+(.*\S)/.exec(l);
    if (m) out.push({ text: redact(m[1]!, 100), line: i + 1 });
  }
  return out.slice(0, 4);
}

/** Resolve the Git root and require that the operator ran from it, so a stray parent repo is never scanned. */
export function repoRoot(dir: string): string {
  const root = realpathSync(git(dir, ["rev-parse", "--show-toplevel"]).trim());
  if (realpathSync(dir) !== root) throw new Error(`Run from the repository root: ${root}`);
  return root;
}

export function scan(opts: ScanOptions): Casefile {
  const clock = opts.clock ?? new Date();
  const root = repoRoot(opts.dir);

  const head = tryGit(root, ["rev-parse", "HEAD"])?.trim() ?? null;
  const branch =
    tryGit(root, ["symbolic-ref", "--short", "HEAD"])?.trim() ??
    tryGit(root, ["rev-parse", "--abbrev-ref", "HEAD"])?.trim() ?? null;
  const dirtyFiles = (tryGit(root, ["status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length;

  const all = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean).sort();
  const truncated = all.length > CAPS.paths;
  const tracked = all.slice(0, CAPS.paths);

  const log = head ? (tryGit(root, ["log", "-n", String(CAPS.commits + 1), "--format=%H%x1f%cI"]) ?? "") : "";
  const commits = log.split("\n").filter(Boolean);
  const history: Casefile["coverage"]["history"] = !head ? "empty" : commits.length > CAPS.commits ? "truncated" : "ok";
  const shown = commits.slice(0, CAPS.commits);
  const lastIso = shown[0]?.split("\x1f")[1] ?? null;

  let daysInactive: number | null = null;
  let clockSkew = false;
  if (lastIso) {
    const diff = Math.floor((clock.getTime() - new Date(lastIso).getTime()) / DAY_MS);
    clockSkew = diff < 0;
    daysInactive = Math.max(0, diff);
  }

  const skipped = { symlink: 0, oversized: 0, binary: 0 };
  let scannedFiles = 0;
  const todos: EvDraft[] = [];
  const secrets: EvDraft[] = [];
  const texts = new Map<string, string>();
  const dirCount = new Map<string, number>();

  for (const rel of tracked) {
    const top = rel.includes("/") ? rel.split("/")[0]! : ".";
    dirCount.set(top, (dirCount.get(top) ?? 0) + 1);
    const text = readText(root, rel, skipped);
    if (text === null) continue;
    scannedFiles++;
    if (/^(README|package\.json$|LICENSE)/i.test(rel)) texts.set(rel, text);
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      if (MARKER.test(l) && todos.length < 10)
        todos.push({ kind: "file", path: rel, startLine: i + 1, endLine: i + 1, label: "todo", excerpt: redact(l) });
      if (hasSecretLead(l) && secrets.length < 10)
        secrets.push({ kind: "file", path: rel, startLine: i + 1, endLine: i + 1, label: "secret-lead", excerpt: redact(l) });
    }
  }

  const readmePath = tracked.find((p) => /^readme(\.[a-z]+)?$/i.test(p)) ?? null;
  const readme = readmePath ? (texts.get(readmePath) ?? "") : "";
  const pkgText = texts.get("package.json");
  let pkg: Record<string, unknown> = {};
  if (pkgText) { try { pkg = JSON.parse(pkgText) as Record<string, unknown>; } catch { /* leave empty */ } }

  const direct = { ...(pkg.dependencies as object | undefined), ...(pkg.devDependencies as object | undefined) } as Record<string, string>;
  const unpinned = Object.entries(direct)
    .filter(([, v]) => v === "*" || v === "latest" || v === "" || /^[\^~><x]/i.test(v))
    .map(([k]) => k).sort();
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const engines = (pkg.engines ?? {}) as Record<string, string>;

  const entrypoints: string[] = [];
  if (typeof pkg.main === "string") entrypoints.push(pkg.main);
  if (typeof pkg.bin === "string") entrypoints.push(pkg.bin);
  else if (pkg.bin && typeof pkg.bin === "object") entrypoints.push(...Object.values(pkg.bin as Record<string, string>));

  // Evidence order: promises first, then todos, then secret leads.
  const promiseRows = readmePath ? readmePromises(readme) : [];
  const drafts: EvDraft[] = [
    ...promiseRows.map((p): EvDraft => ({
      kind: "file", path: readmePath!, startLine: p.line, endLine: p.line, label: "promise", excerpt: p.text.slice(0, 80),
    })),
    ...todos, ...secrets,
  ];
  const evidence: Casefile["evidence"] = drafts.map((d, i) => ({ ...d, id: `E${i + 1}` }));
  if (head) evidence.push({ id: `E${evidence.length + 1}`, kind: "commit", hash: head });

  const promises = promiseRows.map((p, i) => ({
    id: `P${i + 1}`, text: p.text, status: "unknown" as const, evidenceIds: [`E${i + 1}`],
  }));

  const relevant = [...texts.keys()].sort().map((k) => k + ":" + sha256(texts.get(k)!)).join("|");
  const dirs = [...dirCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8).map(([dir, files]) => ({ dir, files }));

  const draft: CasefileDraft = {
    schemaVersion: 1,
    scannedAt: clock.toISOString(),
    snapshot: { head, branch, dirtyFiles, digest: sha256(`${head}|${dirtyFiles}|${relevant}`).slice(0, 16) },
    coverage: {
      trackedPaths: all.length, scannedFiles, skipped, commits: shown.length, history, truncated, omittedEvidence: 0,
    },
    activity: { lastCommit: lastIso, daysInactive, clockSkew },
    integrity: {
      testFiles: tracked.filter((p) => TEST.test(p)).length,
      ci: tracked.some((p) => CI.some((r) => r.test(p))),
      buildScript: typeof scripts.build === "string",
      recordedCheck: "not_run",
      secretLeads: secrets.length,
      todoMarkers: todos.length,
    },
    deps: {
      runtime: typeof engines.node === "string" ? `node ${engines.node}` : null,
      lockfile: tracked.some((p) => LOCKFILES.has(p.split("/").pop()!)),
      direct: Object.keys(direct).length,
      unpinned,
    },
    clarity: {
      readme: readmePath !== null,
      readmeChars: readme.replace(/\s/g, "").length,
      license: tracked.some((p) => /^(license|licence|copying)(\.[a-z]+)?$/i.test(p)),
      description: typeof pkg.description === "string" && pkg.description.trim().length > 0,
    },
    codeMap: { entrypoints: entrypoints.sort(), dirs },
    advisories: { status: "not_scanned" },
    promises,
    evidence,
    contextPaths: [readmePath, ...promiseRows.map(() => null)].filter((p): p is string => !!p).slice(0, 1),
  };
  return fitBudget(draft);
}

export function scanAndWrite(opts: ScanOptions): { casefile: Casefile; path: string } {
  const casefile = scan(opts);
  const root = repoRoot(opts.dir);
  const path = join(root, ".lazarus", "casefile.json");
  writeAtomic(path, JSON.stringify(casefile, null, 2) + "\n");
  return { casefile, path };
}
