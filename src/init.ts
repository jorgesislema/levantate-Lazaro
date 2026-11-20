import { closeSync, constants, mkdirSync, openSync, readdirSync, readFileSync, writeSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { git } from "./git.js";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "kit");

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out.sort();
}

export interface InitResult { created: string[]; skipped: string[] }

/** Copy the bundled kit into a Git workspace. Never overwrites an existing path. */
export function init(dir: string): InitResult {
  git(dir, ["rev-parse", "--show-toplevel"]); // fails if not a Git workspace
  const result: InitResult = { created: [], skipped: [] };
  for (const src of listFiles(KIT)) {
    const rel = relative(KIT, src);
    const dest = join(dir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    try {
      const fd = openSync(dest, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL);
      writeSync(fd, readFileSync(src));
      closeSync(fd);
      result.created.push(rel.replaceAll("\\", "/"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") result.skipped.push(rel.replaceAll("\\", "/"));
      else throw e;
    }
  }
  return result;
}
