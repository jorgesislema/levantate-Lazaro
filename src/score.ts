export type Status = "fulfilled" | "partial" | "missing" | "unknown";

export interface ScoreInput {
  daysInactive: number | null;
  testFiles: number;
  ci: boolean;
  buildScript: boolean;
  /** True only when a recorded check relevant to the snapshot passed. */
  checkVerified: boolean;
  lockfile: boolean;
  direct: number;
  unpinned: number;
  truncated: boolean;
  readme: boolean;
  readmeChars: number;
  license: boolean;
  description: boolean;
  /** One status per README promise, in casefile order. "unknown" means not classified. */
  promises: Status[];
}

export interface Score {
  components: {
    activity: number;
    integrity: { tests: number; check: number; ci: number; build: number; total: number };
    deps: { lockfile: number; pinned: number; total: number };
    clarity: number;
  };
  base: number;
  baseMax: 75;
  gap: { points: number | null; denominator: number; complete: boolean };
  final: number | null;
  provisional: boolean;
  unknowns: string[];
}

export function activityPoints(days: number | null): number {
  if (days === null) return 0;
  const d = Math.max(0, days);
  if (d <= 30) return 15;
  if (d <= 90) return 12;
  if (d <= 180) return 8;
  if (d <= 365) return 4;
  return 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function score(i: ScoreInput): Score {
  const unknowns: string[] = [];
  const activity = activityPoints(i.daysInactive);
  if (i.daysInactive === null) unknowns.push("activity: no Git history");

  const tests = i.testFiles > 0 ? 5 : 0;
  const check = i.checkVerified ? 15 : 0;
  const ci = i.ci ? 5 : 0;
  const build = i.buildScript ? 5 : 0;
  if (!i.checkVerified) unknowns.push("integrity: no passing recorded check, 15 points unawarded");
  const integrity = { tests, check, ci, build, total: tests + check + ci + build };

  const lockfile = i.lockfile ? 10 : 0;
  const inspected = i.direct > 0 && !i.truncated;
  const pinned = inspected && i.unpinned === 0 ? 10 : 0;
  if (!inspected) unknowns.push("dependencies: manifest not fully inspected");
  const deps = { lockfile, pinned, total: lockfile + pinned };

  const clarity =
    (i.readme ? 4 : 0) + (i.readmeChars >= 200 ? 2 : 0) + (i.license ? 2 : 0) + (i.description ? 2 : 0);

  const base = activity + integrity.total + deps.total + clarity;

  const total = i.promises.length;
  const complete = total > 0 && i.promises.every((s) => s !== "unknown");
  let points: number | null = null;
  if (complete) {
    const f = i.promises.filter((s) => s === "fulfilled").length;
    const p = i.promises.filter((s) => s === "partial").length;
    points = round1((25 * (f + 0.5 * p)) / total);
  } else {
    unknowns.push(total === 0 ? "gap: no promises found" : "gap: some promises are unclassified");
  }

  return {
    components: { activity, integrity, deps, clarity },
    base,
    baseMax: 75,
    gap: { points, denominator: total, complete },
    final: points === null ? null : round1(base + points),
    provisional: points === null,
    unknowns,
  };
}
