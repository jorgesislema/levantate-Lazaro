import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { redact } from "./redact.js";
import { readText } from "./scan.js";
import { writeAtomic, type Casefile } from "./casefile.js";

export const CONTEXT_CAPS = { files: 5, perFile: 1024, total: 6144 } as const;

export interface Pack { text: string; bytes: number; files: string[] }

/** Bounded, redacted excerpts around cited lines: README plus up to five cited files. */
export function contextPack(root: string, c: Casefile): Pack {
  const real = realpathSync(root);
  const cited = new Map<string, [number, number][]>();
  for (const e of c.evidence) {
    if (e.kind !== "file") continue;
    cited.set(e.path, [...(cited.get(e.path) ?? []), [e.startLine, e.endLine]]);
  }
  const order = [...c.contextPaths, ...[...cited.keys()].filter((p) => !c.contextPaths.includes(p))];
  const picked = [...new Set(order)].slice(0, CONTEXT_CAPS.files);

  const parts: string[] = [];
  const files: string[] = [];
  let total = 0;
  for (const rel of picked) {
    const text = readText(real, rel, { symlink: 0, oversized: 0, binary: 0 });
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    const ranges = cited.get(rel) ?? [[1, 12]];
    const chunk: string[] = [];
    for (const [s, e] of ranges) {
      const from = Math.max(1, s - 2), to = Math.min(lines.length, e + 2);
      chunk.push(`--- ${rel} L${from}-L${to}`);
      for (let i = from; i <= to; i++) chunk.push(`${i}: ${redact(lines[i - 1] ?? "", 160)}`);
    }
    let body = chunk.join("\n");
    if (body.length > CONTEXT_CAPS.perFile) body = body.slice(0, CONTEXT_CAPS.perFile);
    if (total + body.length > CONTEXT_CAPS.total) break;
    total += body.length;
    parts.push(body);
    files.push(rel);
  }
  const text = parts.join("\n\n");
  return { text, bytes: Buffer.byteLength(text), files };
}

export interface UsageRow { at: string; phase: string; inputBytes: number; passes: number; note?: string }

/** Append one measured row to .lazarus/usage.json. Only measured numbers are stored. */
export function recordUsage(root: string, row: UsageRow): UsageRow[] {
  const path = join(root, ".lazarus", "usage.json");
  let rows: UsageRow[] = [];
  try { rows = JSON.parse(readFileSync(path, "utf8")) as UsageRow[]; } catch { /* first row */ }
  rows.push(row);
  writeAtomic(path, JSON.stringify(rows, null, 2) + "\n");
  return rows;
}
