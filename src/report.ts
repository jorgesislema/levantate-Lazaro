import type { Casefile } from "./casefile.js";
import type { Diagnosis } from "./diagnosis.js";
import { toScoreInput } from "./diagnosis.js";
import type { TaskManifest } from "./manifest.js";
import { score } from "./score.js";
import { escapeHtml, shareable } from "./text.js";
import { nextActionOf } from "./summary.js";
import type { Verification } from "./verify.js";

export interface ReportInput {
  label: string;
  casefile: Casefile;
  diagnosis?: Diagnosis;
  verification?: Verification;
  manifest?: TaskManifest;
}

const e = (s: string | number) => escapeHtml(String(s));
const t = (s: string, n = 400) => e(shareable(s, n));

const CSS = `
:root{--bg:#120f1a;--card:#1c1727;--line:#2b2540;--text:#eae6f2;--mute:#a79fba;--accent:#b794f6;--ok:#4ade80;--bad:#f87171;--warn:#fbbf24}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 20px 64px}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.brand{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
h1{font-size:30px;margin:4px 0 0}h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin:36px 0 12px}
.meta{color:var(--mute);font-size:13px;text-align:right}
.lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.card h3{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.card p{margin:0}.pending{color:var(--mute);font-style:italic}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:13px;font-weight:600;background:var(--line)}
.verified{background:#14532d;color:#bbf7d0}.failed,.blocked,.timed_out{background:#7f1d1d;color:#fecaca}.stale,.not_run,.not_selected{background:#3f3a52;color:#d8d2e6}.passed{background:#14532d;color:#bbf7d0}
.bar{height:12px;border-radius:99px;background:var(--line);overflow:hidden;margin:8px 0 4px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#7c3aed,#b794f6)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-weight:600}
code{font-family:ui-monospace,Consolas,monospace;font-size:13px;background:var(--line);padding:1px 6px;border-radius:6px}
a{color:var(--accent)}a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
footer{margin-top:40px;color:var(--mute);font-size:13px;border-top:1px solid var(--line);padding-top:16px}
@media print{:root{--bg:#fff;--card:#fff;--line:#ddd;--text:#111;--mute:#555;--accent:#5b21b6}.card{break-inside:avoid}}
`;

function cite(ids: string[]): string {
  return ids.length ? ids.map((id) => `<a href="#${e(id)}">${e(id)}</a>`).join(" ") : '<span class="pending">no evidence cited</span>';
}

export function renderReport(i: ReportInput): string {
  const c = i.casefile;
  const d = i.diagnosis && i.diagnosis.caseId === c.caseId ? i.diagnosis : undefined;
  const v = i.verification && i.verification.caseId === c.caseId ? i.verification : undefined;
  const status = v ? v.status : i.verification ? "stale" : "not_run";
  const s = score(toScoreInput(c, d, status === "verified"));
  const pct = Math.round(((s.final ?? s.base) / (s.final === null ? 75 : 100)) * 100);

  const pend = (what: string) => `<p class="pending">${e(what)}</p>`;
  const lead = `
<section class="lead" aria-label="Summary">
 <div class="card"><h3>Goal</h3>${d ? `<p>${t(d.intentSummary)}</p>` : pend("Pending: run the interview and diagnosis.")}</div>
 <div class="card"><h3>First blocker</h3>${d ? `<p>${t(d.blocker.text)}</p><p>${cite(d.blocker.evidenceIds)}</p>` : pend("Unknown until the diagnosis is written.")}</div>
 <div class="card"><h3>Next action</h3><p>${t(nextActionOf({ diagnosis: d, verification: v, manifest: i.manifest }, status))}</p></div>
 <div class="card"><h3>One improvement</h3>${d?.opportunity ? `<p>${t(d.opportunity.text)}</p><p class="pending">${t(d.opportunity.benefit)} (about ${e(d.opportunity.effortMinutes)} min)</p>` : pend("None proposed yet.")}</div>
 <div class="card"><h3>Verification</h3><p><span class="badge ${e(status)}">${e(status)}</span></p>
  <p class="pending">${v ? t(v.reason) : "No approved check has run for this snapshot."}</p>
  ${v && v.property.status !== "not_selected" ? `<p>Property check: <span class="badge ${e(v.property.status)}">${e(v.property.status)}</span> ${t(v.property.detail, 160)}</p>` : ""}
  ${v?.baselineSignature ? `<p class="pending">Baseline failure: ${t(v.baselineSignature, 160)}</p>` : ""}</div>
 <div class="card"><h3>Vitality</h3><p><b>${e(s.final ?? s.base)}</b> / ${s.final === null ? "75 (provisional)" : "100"}</p>
  <div class="bar" role="img" aria-label="Vitality ${pct} percent"><i style="width:${pct}%"></i></div>
  <p class="pending">${s.unknowns.length ? e(s.unknowns.join("; ")) : "All components known."}</p></div>
</section>`;

  const promises = c.promises.length
    ? `<table><thead><tr><th>Promise</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${c.promises
        .map((p) => {
          const g = d?.gaps.find((x) => x.promiseId === p.id);
          return `<tr><td>${t(p.text, 160)}</td><td><span class="badge">${e(g?.status ?? "unknown")}</span></td><td>${cite(g?.evidenceIds ?? p.evidenceIds)}</td></tr>`;
        })
        .join("")}</tbody></table>`
    : pend("No README promises found.");

  const signals = d?.reviewSignals.length
    ? `<table><thead><tr><th>Signal</th><th>Uncertainty</th><th>Review action</th><th>Evidence</th></tr></thead><tbody>${d.reviewSignals
        .map((x) => `<tr><td><b>${e(x.category)}</b>: ${t(x.text, 200)}</td><td>${t(x.uncertainty, 160)}</td><td>${t(x.nextAction, 160)}</td><td>${cite(x.evidenceIds)}</td></tr>`)
        .join("")}</tbody></table>`
    : pend("No review signals recorded. Leads found by the scan are listed under Evidence.");

  const evidence = c.evidence
    .map((x) =>
      x.kind === "file"
        ? `<tr id="${e(x.id)}"><td>${e(x.id)}</td><td><code>${e(x.path)}:${e(x.startLine)}</code></td><td>${e(x.label)}</td><td>${t(x.excerpt ?? "", 100)}</td></tr>`
        : `<tr id="${e(x.id)}"><td>${e(x.id)}</td><td><code>${e(x.hash.slice(0, 12))}</code></td><td>commit</td><td></td></tr>`,
    )
    .join("");

  const cov = c.coverage;
  const provenance = `<table><tbody>
<tr><th>Snapshot</th><td><code>${e(c.snapshot.head?.slice(0, 12) ?? "no commits")}</code> on ${e(c.snapshot.branch ?? "unknown")}, ${e(c.snapshot.dirtyFiles)} uncommitted file(s)</td></tr>
<tr><th>Scanned</th><td>${e(c.scannedAt)}</td></tr>
<tr><th>Last commit</th><td>${e(c.activity.lastCommit ?? "unknown")}${c.activity.daysInactive === null ? "" : ` (${e(c.activity.daysInactive)} days before the scan${c.activity.clockSkew ? ", clock skew clamped" : ""})`}</td></tr>
<tr><th>Coverage</th><td>${e(cov.scannedFiles)} of ${e(cov.trackedPaths)} files read, ${e(cov.commits)} commits (${e(cov.history)}); skipped: ${e(cov.skipped.symlink)} symlink, ${e(cov.skipped.oversized)} oversized, ${e(cov.skipped.binary)} binary; omitted evidence: ${e(cov.omittedEvidence)}</td></tr>
<tr><th>Dependencies</th><td>${e(c.deps.runtime ?? "no runtime declared")}; lockfile: ${c.deps.lockfile ? "yes" : "no"}; unpinned: ${c.deps.unpinned.length ? e(c.deps.unpinned.join(", ")) : "none"}; advisories: ${e(c.advisories.status)}</td></tr>
<tr><th>Case</th><td><code>${e(c.caseId)}</code></td></tr></tbody></table>`;

  const codeMap = c.codeMap.dirs.length
    ? `<table><thead><tr><th>Directory</th><th>Files</th></tr></thead><tbody>${c.codeMap.dirs.map((x) => `<tr><td><code>${e(x.dir)}</code></td><td>${e(x.files)}</td></tr>`).join("")}</tbody></table>${c.codeMap.entrypoints.length ? `<p>Entrypoints: ${c.codeMap.entrypoints.map((x) => `<code>${e(x)}</code>`).join(" ")}</p>` : ""}`
    : pend("No tracked directories.");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Levántate Lázaro: ${e(shareable(i.label, 60))}</title><style>${CSS}</style></head><body><main>
<header><div><div class="brand">Levántate Lázaro</div><h1>${e(shareable(i.label, 60))}</h1></div>
<div class="meta">Snapshot as of ${e(c.scannedAt.slice(0, 10))}<br>Case <code>${e(c.caseId)}</code></div></header>
${lead}
<h2>Promises in the README</h2>${promises}
<h2>Review signals</h2>${signals}
<h2>Evidence</h2><table><thead><tr><th>ID</th><th>Where</th><th>Kind</th><th>Excerpt (redacted)</th></tr></thead><tbody>${evidence}</tbody></table>
<h2>Code map</h2>${codeMap}
<h2>Coverage and provenance</h2>${provenance}
<footer>Generated locally. No network calls, no model calls. Scores guide priorities; they are not a verdict. Text is redacted before it is shown.</footer>
</main></body></html>`;
}
