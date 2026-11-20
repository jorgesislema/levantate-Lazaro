import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan } from "../src/scan.js";
import { renderReport } from "../src/report.js";
import { exportSummary, Summary } from "../src/summary.js";
import { review, renderTable, renderReviewHtml } from "../src/review.js";
import { replayDiagnosis, writeReplayPlan, applyRecordedChange } from "../src/replay.js";
import { recordBaseline, verifyAfter } from "../src/verify.js";
import { shareable, stripControls } from "../src/text.js";

const CLOCK = new Date("2026-11-20T00:00:00Z");
const tmp = () => mkdtempSync(join(tmpdir(), "lz-r-"));

function fixture(): string {
  const dir = join(tmp(), "gastos-app");
  execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });
  return dir;
}

const dir = fixture();
const cf = scan({ dir, clock: CLOCK });
const diagnosis = replayDiagnosis(cf);
const manifest = writeReplayPlan(dir, cf, { properties: true });
recordBaseline(dir, manifest, cf);
applyRecordedChange(dir, manifest);
const verification = verifyAfter(dir, manifest, cf, CLOCK);

describe("report", () => {
  it("renders every section with the verified result", () => {
    const html = renderReport({ label: "gastos-app", casefile: cf, diagnosis, verification, manifest });
    expect(html).toContain("First blocker");
    expect(html).toContain("verified");
    expect(html).toContain("Property check");
    expect(html).toContain("Snapshot as of 2026-11-20");
    expect(html).toContain('href="#E1"');
  });

  it("works offline: no scripts, no remote assets", () => {
    const html = renderReport({ label: "x", casefile: cf, diagnosis, verification, manifest });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/(src|href)=["']https?:/i);
    expect(html).not.toContain("@import");
  });

  it("shows pending states when diagnosis and verification are absent", () => {
    const html = renderReport({ label: "x", casefile: cf });
    expect(html).toContain("Pending: run the interview and diagnosis.");
    expect(html).toContain("No approved check has run");
    expect(html).toContain("not_run");
    expect(html).toContain("provisional");
  });

  it("escapes hostile text and hides secrets", () => {
    const bad = { ...diagnosis, intentSummary: '<img src=x onerror=alert(1)> token = abcd1234 me@x.com' };
    const html = renderReport({ label: "<b>x</b>", casefile: cf, diagnosis: bad });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("abcd1234");
    expect(html).not.toContain("me@x.com");
    expect(html).not.toContain("FAKE_EXAMPLE");
  });

  it("marks verification from another snapshot as stale", () => {
    const html = renderReport({ label: "x", casefile: { ...cf, caseId: "1111111111111111" }, diagnosis: { ...diagnosis, caseId: "1111111111111111" }, verification });
    expect(html).toContain('class="badge stale"');
  });
});

describe("summary export", () => {
  it("builds a valid, bounded summary", () => {
    const s = exportSummary({ label: "gastos-app", casefile: cf, diagnosis, verification, manifest, now: CLOCK });
    expect(Summary.safeParse(s).success).toBe(true);
    expect(s.check.status).toBe("verified");
    expect(s.check.asOf).toBe(CLOCK.toISOString());
    expect(JSON.stringify(s).length).toBeLessThan(16 * 1024);
    expect(s.nextAction).toContain("approve the next task");
  });

  it("removes paths, remotes, emails and secrets", () => {
    const dirty = { ...diagnosis, intentSummary: "see C:\\Users\\ana\\proj\\a.txt and /home/ana/x, git@github.com:ana/r.git, ana@mail.com password = hunter22" };
    const s = exportSummary({ label: "C:\\Users\\ana\\proj", casefile: cf, diagnosis: dirty, now: CLOCK });
    const json = JSON.stringify(s);
    for (const leak of ["ana", "hunter22", "github.com", "C:\\\\Users"]) expect(json).not.toContain(leak);
    expect(s.goal).toContain("[PATH]");
  });

  it("does not trust a verification from another snapshot", () => {
    const s = exportSummary({ label: "x", casefile: { ...cf, caseId: "2222222222222222" }, verification, now: CLOCK });
    expect(s.check.status).toBe("stale");
  });

  it("says the check is not run when nothing was verified", () => {
    const s = exportSummary({ label: "x", casefile: cf, now: CLOCK });
    expect(s.check.status).toBe("not_run");
    expect(s.blocker).toContain("Unknown");
  });
});

describe("mentor review", () => {
  const base = tmp();
  const put = (name: string, body: unknown) => {
    const p = join(base, name);
    writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
    return p;
  };
  const a = exportSummary({ label: "alpha", casefile: cf, diagnosis, verification, manifest, now: CLOCK });
  const b = exportSummary({ label: "beta", casefile: cf, now: CLOCK });

  it("shows two valid rows and rejects an invalid file in one run, keeping input order", () => {
    const r = review([put("a.json", a), put("bad.json", { schemaVersion: 1, label: "" }), put("b.json", b)]);
    expect(r.rows.map((x) => x.summary.label)).toEqual(["alpha", "beta"]);
    expect(r.rejected.length).toBe(1);
    const t = renderTable(r);
    expect(t).toContain("alpha");
    expect(t).toContain("verified (2026-11-20)");
    expect(t).toContain("beta");
    expect(t).toContain("rejected");
  });

  it("rejects an unsupported version, broken JSON and oversized files individually", () => {
    const big = put("big.json", { ...a, goal: "x".repeat(20000) });
    const r = review([put("v2.json", { ...a, schemaVersion: 2 }), put("broken.json", "{nope"), big, put("ok.json", a)]);
    expect(r.rows.length).toBe(1);
    expect(r.rejected.map((x) => x.reason).join("|")).toMatch(/unsupported schemaVersion 2/);
    expect(r.rejected.length).toBe(3);
  });

  it("refuses more than 20 files", () => {
    const files = Array.from({ length: 21 }, () => put("a.json", a));
    expect(() => review(files)).toThrow(/at most 20/);
  });

  it("strips terminal controls from what it displays", () => {
    const sneaky = put("s.json", { ...a, label: "evil\u001b[31mred", goal: "g\u0007h\u001b]0;title\u0007" });
    const out = renderTable(review([sneaky])) + renderReviewHtml(review([sneaky]));
    expect(out).not.toContain("\u001b");
    expect(out).not.toContain("\u0007");
  });

  it("escapes HTML in the review page and needs no repository", () => {
    const xss = put("x.json", { ...a, label: "<script>alert(1)</script>" });
    const html = renderReviewHtml(review([xss]));
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    mkdirSync(join(base, "no-repo"), { recursive: true });
  });
});

describe("text helpers", () => {
  it("strips ANSI and control characters", () => {
    expect(stripControls("a\u001b[1;31mb\u0000c")).toBe("abc");
  });
  it("shareable removes remotes with credentials", () => {
    expect(shareable("https://user:pw@host.com/r.git")).toBe("[REMOTE]");
  });
});
