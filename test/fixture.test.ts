import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gen = join(process.cwd(), "scripts", "make-fixtures.mjs");
const dir = join(mkdtempSync(join(tmpdir(), "lazaro-")), "gastos-app");
execFileSync(process.execPath, [gen, dir], { stdio: "pipe" });

describe("gastos-app fixture", () => {
  it("has the planned last commit date", () => {
    const d = execFileSync("git", ["log", "-1", "--format=%cI"], { cwd: dir, encoding: "utf8" }).trim();
    expect(d.startsWith("2024-03-12")).toBe(true);
  });

  it("keeps the unfinished PDF branch", () => {
    const b = execFileSync("git", ["branch", "--list"], { cwd: dir, encoding: "utf8" });
    expect(b).toContain("feature/pdf-export");
  });

  it("baseline check fails on Node 24+ because util.isString was removed", () => {
    const r = spawnSync(process.execPath, [join(dir, "check", "expense-total.mjs")], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("FAIL");
    expect(r.stdout).toContain("isString is not a function");
  });

  it("the expense math itself is correct", () => {
    const r = spawnSync(
      process.execPath,
      ["-e", "const {sumCents}=require('./src/total');console.log(sumCents(require('./data/sample.json')))"],
      { cwd: dir, encoding: "utf8" },
    );
    expect(r.stdout.trim()).toBe("4250");
  });
});
