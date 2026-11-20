import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tryGit } from "./git.js";
import { repoRoot, scan } from "./scan.js";
import { shareable } from "./text.js";

/**
 * Read-only views of a repository for the Forense agent.
 * Every function takes the root fixed at server start. No tool accepts a path,
 * runs repository code, or writes anything.
 */

export interface CommitRow { hash: string; date: string; subject: string }

export function gitHistory(root: string, limit = 30): CommitRow[] {
  const n = Math.min(100, Math.max(1, Math.floor(limit)));
  const out = tryGit(root, ["log", "-n", String(n), "--format=%H%x1f%cI%x1f%s"]) ?? "";
  return out.split("\n").filter(Boolean).map((l) => {
    const [hash = "", date = "", subject = ""] = l.split("\x1f");
    return { hash, date, subject: shareable(subject, 120) };
  });
}

export interface BranchRow { name: string; lastCommit: string; ahead: number }

/** Branches with their last commit date and commits not on the default branch. Unfinished work shows up here. */
export function branches(root: string): BranchRow[] {
  const raw = tryGit(root, ["for-each-ref", "--format=%(refname:short)%1f%(committerdate:iso-strict)", "refs/heads"]) ?? "";
  const base = tryGit(root, ["symbolic-ref", "--short", "HEAD"])?.trim() ?? "main";
  return raw.split("\n").filter(Boolean).map((l) => {
    const [name = "", lastCommit = ""] = l.split("\x1f");
    const ahead = name === base ? 0 : Number((tryGit(root, ["rev-list", "--count", `${base}..${name}`]) ?? "0").trim()) || 0;
    return { name: shareable(name, 80), lastCommit, ahead };
  });
}

export function lastActivity(root: string, clock = new Date()) {
  const cf = scan({ dir: root, clock });
  return {
    lastCommit: cf.activity.lastCommit,
    daysInactive: cf.activity.daysInactive,
    history: cf.coverage.history,
    branches: branches(root),
  };
}

export function dependencyHealth(root: string) {
  const cf = scan({ dir: root });
  let scripts: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
    scripts = Object.keys(pkg.scripts ?? {}).sort();
  } catch { /* no manifest */ }
  return {
    runtime: cf.deps.runtime,
    lockfile: cf.deps.lockfile,
    directDependencies: cf.deps.direct,
    unpinned: cf.deps.unpinned,
    scriptNames: scripts,
    advisories: cf.advisories.status,
  };
}

export function resolveRoot(dir: string): string {
  return repoRoot(dir);
}
