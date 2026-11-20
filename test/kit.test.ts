import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(n) ? [p] : [];
  });
}

const roots = [".kiro", join("kit", ".kiro")];

describe("Kiro config files", () => {
  for (const r of roots) {
    for (const f of files(r, /\.(json|hook)$/)) {
      it(`${f} is plain UTF-8 JSON without a BOM`, () => {
        const b = readFileSync(f);
        expect(b[0]).not.toBe(0xef);
        expect(() => JSON.parse(b.toString("utf8"))).not.toThrow();
      });
    }
  }

  it("each agent file is named after its agent", () => {
    for (const r of roots) {
      for (const f of files(join(r, "agents"), /\.json$/)) {
        const a = JSON.parse(readFileSync(f, "utf8")) as { name: string };
        expect(f.endsWith(`${a.name}.json`)).toBe(true);
      }
    }
  });

  it("the shipped kit agents match the ones this repo uses", () => {
    for (const f of files(join(".kiro", "agents"), /\.json$/)) {
      const twin = join("kit", f);
      expect(readFileSync(twin, "utf8")).toBe(readFileSync(f, "utf8"));
    }
  });

  it("the forense agent has no shell tool and only read-only MCP tools", () => {
    const a = JSON.parse(readFileSync(join(".kiro", "agents", "forense.json"), "utf8")) as { tools: string[]; allowedTools: string[] };
    expect(a.tools).not.toContain("execute_bash");
    expect(a.allowedTools.every((t) => t === "fs_read" || t.startsWith("@lazarus-git/"))).toBe(true);
  });
});
