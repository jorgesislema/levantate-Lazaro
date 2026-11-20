import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDemo } from "../src/demo.js";

describe("offline demo", () => {
  const out = join(mkdtempSync(join(tmpdir(), "lz-demo-")), "out");
  const lines: string[] = [];
  const r = runDemo(out, (s) => lines.push(s));

  it("goes from failing baseline to verified recovery", () => {
    expect(r.status).toBe("verified");
    const log = lines.join("\n");
    expect(log).toContain("util.isString is not a function");
    expect(log).toContain("verified: expected baseline failure, then the same check passes");
    expect(log).toContain("property passed");
  });

  it("labels stored inputs as replay and checks as live", () => {
    const log = lines.join("\n");
    expect(log).toContain("REPLAY inputs, not a live Kiro run");
    expect(log).toContain("(LIVE)");
  });

  it("writes the report, two summaries and a review page", () => {
    expect(existsSync(r.report)).toBe(true);
    expect(r.summaries.every(existsSync)).toBe(true);
    expect(readFileSync(r.report, "utf8")).toContain("verified");
    const table = lines.join("\n");
    expect(table).toContain("gastos-app (before)");
    expect(table).toContain("not_run");
    expect(table).toContain("gastos-app (after)");
    expect(table).toContain("verified (2026-11-20)");
  });

  it("is reproducible: same clock gives the same case id", () => {
    const again: string[] = [];
    runDemo(join(mkdtempSync(join(tmpdir(), "lz-demo2-")), "out"), (s) => again.push(s));
    const pick = (a: string[]) => a.find((l) => l.includes("casefile "));
    expect(pick(again)).toBe(pick(lines));
  });
}, 60000);

describe("hooks", () => {
  const dirs = [join(process.cwd(), ".kiro", "hooks"), join(process.cwd(), "kit", ".kiro", "hooks")];
  for (const d of dirs) {
    for (const f of readdirSync(d)) {
      it(`${f} is well formed and narrow`, () => {
        const h = JSON.parse(readFileSync(join(d, f), "utf8")) as Record<string, any>;
        expect(h.enabled).toBe(true);
        expect(h.version).toBe("1");
        expect(["fileEdited", "agentStop"]).toContain(h.when.type);
        if (h.when.type === "fileEdited") expect(h.when.patterns.length).toBeGreaterThan(0);
        expect(h.then.type).toBe("runCommand");
        // No model calls, no network, no destructive commands.
        expect(h.then.command).not.toMatch(/curl|wget|rm |del |push|--force|http/i);
      });
    }
  }
});
