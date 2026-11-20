import { readFileSync, statSync } from "node:fs";
import { MAX_REVIEW_FILES, MAX_SUMMARY_BYTES, Summary } from "./summary.js";
import { escapeHtml, stripControls } from "./text.js";

export interface Row { file: string; summary: Summary }
export interface Rejected { file: string; reason: string }
export interface Review { rows: Row[]; rejected: Rejected[] }

/** Read only the files the mentor named. No repository access, no execution. */
export function review(files: string[]): Review {
  const out: Review = { rows: [], rejected: [] };
  if (files.length > MAX_REVIEW_FILES)
    throw new Error(`at most ${MAX_REVIEW_FILES} summary files per run, got ${files.length}`);
  for (const file of files) {
    try {
      if (statSync(file).size > MAX_SUMMARY_BYTES) throw new Error(`larger than ${MAX_SUMMARY_BYTES / 1024} KiB`);
      const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
      if (raw && typeof raw === "object" && (raw as { schemaVersion?: unknown }).schemaVersion !== 1)
        throw new Error(`unsupported schemaVersion ${String((raw as { schemaVersion?: unknown }).schemaVersion)}`);
      const parsed = Summary.safeParse(raw);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      out.rows.push({ file, summary: parsed.data });
    } catch (e) {
      out.rejected.push({ file, reason: stripControls((e as Error).message).slice(0, 200) });
    }
  }
  return out;
}

const clean = (s: string) => stripControls(s).replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const day = (iso: string) => iso.slice(0, 10);

/** Compact text table, one row per valid export, in input order. */
export function renderTable(r: Review): string {
  const head = ["Project", "Goal", "Blocker", "Next action", "Improvement", "Check (as of)"];
  const rows = r.rows.map(({ summary: s }) => [
    clip(clean(s.label), 26), clip(clean(s.goal), 34), clip(clean(s.blocker), 34),
    clip(clean(s.nextAction), 34), clip(clean(s.improvement ?? "-"), 24), `${s.check.status} (${day(s.check.asOf)})`,
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((x) => x[i]!.length)));
  const line = (c: string[]) => c.map((x, i) => x.padEnd(w[i]!)).join("  ");
  const lines = [line(head), line(w.map((n) => "-".repeat(n))), ...rows.map(line)];
  for (const x of r.rejected) lines.push(`rejected  ${clean(x.file)}: ${x.reason}`);
  return lines.join("\n");
}

/** Standalone HTML version of the same table. */
export function renderReviewHtml(r: Review): string {
  const e = (s: string) => escapeHtml(clean(s));
  const tr = r.rows
    .map(({ summary: s }) => `<tr><td><b>${e(s.label)}</b></td><td>${e(s.goal)}</td><td>${e(s.blocker)}</td><td>${e(s.nextAction)}</td><td>${e(s.improvement ?? "-")}</td><td><span class="b ${s.check.status}">${e(s.check.status)}</span><br><small>as of ${e(day(s.check.asOf))}</small></td></tr>`)
    .join("");
  const bad = r.rejected.map((x) => `<li>${e(x.file)}: ${e(x.reason)}</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mentor review</title><style>
body{font:15px/1.5 system-ui,sans-serif;background:#120f1a;color:#eae6f2;margin:0;padding:24px}
h1{font-size:20px;margin:0 0 4px}p{color:#a79fba;margin:0 0 16px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #2b2540;vertical-align:top}
th{color:#a79fba;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.b{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;background:#2b2540}
.verified{background:#14532d;color:#bbf7d0}.failed,.blocked,.timed_out{background:#7f1d1d;color:#fecaca}.stale,.not_run{background:#3f3a52}
@media print{body{background:#fff;color:#000}}</style></head><body>
<h1>Mentor review</h1><p>${r.rows.length} project(s). Generated offline from the summary files you chose.</p>
<table><thead><tr><th>Project</th><th>Goal</th><th>Blocker</th><th>Next action</th><th>Improvement</th><th>Check</th></tr></thead><tbody>${tr}</tbody></table>
${bad ? `<h2>Rejected</h2><ul>${bad}</ul>` : ""}</body></html>`;
}
