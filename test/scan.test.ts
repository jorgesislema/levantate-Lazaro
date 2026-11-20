import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scan, scanAndWrite } from "../src/scan.js";
import { init } from "../src/init.js";
import { Casefile } from "../src/casefile.js";
import { redact } from "../src/redact.js";

const CLOCK = new Date("2026-11-20T00:00:00Z");
const tmp = () => mkdtempSync(join(tmpdir(), "lz-"));

function fixture(): string {
  const dir = join(tmp(), "gastos-app");
  execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });
  return dir;
}

function emptyRepo(): string {
  const dir = tmp();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  return dir;
}

describe("scan on the fixture", () => {
  const dir = fixture();
  const cf = scan({ dir, clock: CLOCK });

  it("produces a valid casefile", () => {
    expect(Casefile.safeParse(cf).success).toBe(true);
    expect(JSON.stringify(cf).length).toBeLessThanOrEqual(4096);
  });

  it("derives inactivity from the recorded clock", () => {
    expect(cf.activity.daysInactive).toBe(982); // full days from 2024-03-12T12:00Z to 2026-11-20T00:00Z
    expect(cf.activity.clockSkew).toBe(false);
  });

  it("is deterministic", () => {
    expect(scan({ dir, clock: CLOCK })).toEqual(cf);
  });

  it("finds the planted evidence and redacts the fake key", () => {
    expect(cf.promises.length).toBe(4);
    expect(cf.integrity.todoMarkers).toBeGreaterThanOrEqual(1);
    expect(cf.integrity.secretLeads).toBe(1);
    expect(JSON.stringify(cf)).not.toContain("FAKE_EXAMPLE");
    expect(cf.deps.unpinned).toEqual(["express", "pdfkit"]);
    expect(cf.deps.runtime).toBe("node 12.x");
    expect(cf.deps.lockfile).toBe(false);
  });

  it("writes the casefile atomically under .lazarus", () => {
    const { path } = scanAndWrite({ dir, clock: CLOCK });
    expect(Casefile.safeParse(JSON.parse(readFileSync(path, "utf8"))).success).toBe(true);
  });
});

describe("edge cases", () => {
  it("handles a repo with no commits", () => {
    const dir = emptyRepo();
    writeFileSync(join(dir, "a.txt"), "x");
    execFileSync("git", ["add", "a.txt"], { cwd: dir });
    const cf = scan({ dir, clock: CLOCK });
    expect(cf.coverage.history).toBe("empty");
    expect(cf.activity.daysInactive).toBeNull();
    expect(cf.snapshot.head).toBeNull();
  });

  it("skips oversized files and records it", () => {
    const dir = emptyRepo();
    writeFileSync(join(dir, "big.txt"), "a".repeat(200 * 1024));
    execFileSync("git", ["add", "big.txt"], { cwd: dir });
    const cf = scan({ dir, clock: CLOCK });
    expect(cf.coverage.skipped.oversized).toBe(1);
    expect(cf.coverage.scannedFiles).toBe(0);
  });

  it("rejects a folder that is not a Git workspace", () => {
    expect(() => scan({ dir: tmp(), clock: CLOCK })).toThrow();
  });
});

describe("init", () => {
  it("never overwrites and reports skipped paths on a repeat run", () => {
    const dir = emptyRepo();
    const first = init(dir);
    expect(first.created.length).toBeGreaterThan(0);
    expect(first.skipped).toEqual([]);
    const target = join(dir, ".kiro", "steering", "lazaro-voice.md");
    writeFileSync(target, "mine");
    const second = init(dir);
    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBe(first.created.length);
    expect(readFileSync(target, "utf8")).toBe("mine");
  });

  it("keeps existing user files untouched", () => {
    const dir = emptyRepo();
    mkdirSync(join(dir, ".kiro", "agents"), { recursive: true });
    writeFileSync(join(dir, ".kiro", "agents", "lazaro.json"), "{}");
    const r = init(dir);
    expect(r.skipped).toContain(".kiro/agents/lazaro.json");
    expect(existsSync(join(dir, ".kiro", "agents", "forense.json"))).toBe(true);
  });
});

describe("redact", () => {
  it("hides secrets, emails and control characters", () => {
    expect(redact("token = abc12345")).toBe("token = [REDACTED]");
    expect(redact("mail me@site.com")).toBe("mail [EMAIL]");
    expect(redact("a\u001b[31mb")).not.toContain("\u001b");
  });
});
