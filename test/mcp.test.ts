import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { branches, dependencyHealth, gitHistory, lastActivity } from "../src/mcp-tools.js";

const dir = join(mkdtempSync(join(tmpdir(), "lz-m-")), "gastos-app");
execFileSync(process.execPath, [join(process.cwd(), "scripts", "make-fixtures.mjs"), dir], { stdio: "pipe" });

describe("read-only git tools", () => {
  it("lists history newest first with redacted subjects", () => {
    const h = gitHistory(dir, 10);
    expect(h.length).toBe(4);
    expect(h[0]!.subject).toBe("wip: timestamp units");
    expect(h[0]!.hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("caps the limit", () => {
    expect(gitHistory(dir, 100000).length).toBe(4);
    expect(gitHistory(dir, 0).length).toBe(1);
  });

  it("shows the unfinished branch", () => {
    const b = branches(dir);
    const pdf = b.find((x) => x.name === "feature/pdf-export");
    expect(pdf?.ahead).toBe(1);
    expect(b.find((x) => x.name === "main")?.ahead).toBe(0);
  });

  it("reports activity with a fixed clock", () => {
    const a = lastActivity(dir, new Date("2026-11-20T00:00:00Z"));
    expect(a.daysInactive).toBe(982);
    expect(a.branches.length).toBe(2);
  });

  it("reports dependency health without running anything", () => {
    const d = dependencyHealth(dir);
    expect(d.runtime).toBe("node 12.x");
    expect(d.unpinned).toEqual(["express", "pdfkit"]);
    expect(d.lockfile).toBe(false);
    expect(d.scriptNames).toEqual(["start"]);
  });
});

describe("MCP server over stdio", () => {
  const client = new Client({ name: "test", version: "0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(process.cwd(), "dist", "cli.js"), "mcp", "--root", dir],
  });
  afterAll(async () => { await client.close(); });

  it("exposes four read-only tools and no path argument", async () => {
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["branches", "dependency_health", "git_history", "last_activity"]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(JSON.stringify(t.inputSchema)).not.toMatch(/path|dir|cwd/i);
    }
  }, 60000);

  it("answers a call", async () => {
    const r = await client.callTool({ name: "git_history", arguments: { limit: 2 } });
    const body = JSON.parse((r.content as { text: string }[])[0]!.text) as { subject: string }[];
    expect(body.length).toBe(2);
  }, 30000);
});
