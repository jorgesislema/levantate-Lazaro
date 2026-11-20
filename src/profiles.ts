export type Mode = "seance" | "apprentice" | "resurrection";
export type Scope = "minimal" | "full";

export interface Interview {
  mode: Mode;
  scope: Scope;
  skipped: boolean;
  /** Attributed recollection, never treated as fact. */
  answers: [string, string, string, string, string];
}

const blank = (s?: string) => (s ?? "").trim();

export function parseInterview(raw: { answers?: (string | undefined)[]; skip?: boolean }): Interview {
  const a = [0, 1, 2, 3, 4].map((i) => blank(raw.answers?.[i])) as Interview["answers"];
  if (raw.skip || a.every((x) => x === "")) return { mode: "seance", scope: "minimal", skipped: true, answers: a };

  const fifth = a[4].toLowerCase();
  let mode: Mode = "seance";
  if (/(guid|practice|learn|apprentice|guiad|aprend)/.test(fifth)) mode = "apprentice";
  else if (/(repair|fix|resurrect|approved|repar|arregl)/.test(fifth)) mode = "resurrection";

  const scope: Scope = /(full|whole|complete|everything|todo|complet)/.test(a[3].toLowerCase()) ? "full" : "minimal";
  return { mode, scope, skipped: false, answers: a };
}

export interface Profile {
  output: "checklist" | "hints" | "approved-task";
  /** Where the agent may write. */
  writes: "revival-artifacts" | "approved-paths";
}

export const PROFILES: Record<Mode, Profile> = {
  seance: { output: "checklist", writes: "revival-artifacts" },
  apprentice: { output: "hints", writes: "revival-artifacts" },
  resurrection: { output: "approved-task", writes: "approved-paths" },
};

/** Source edits need Resurrection mode, an approved task and a path inside its allowlist. */
export function canEditSource(mode: Mode, approved: boolean, allowedPaths: string[], path: string): boolean {
  if (mode !== "resurrection" || !approved) return false;
  const p = path.replaceAll("\\", "/");
  if (p.startsWith("/") || p.split("/").includes("..")) return false;
  return allowedPaths.includes(p);
}
