#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./init.js";
import { scanAndWrite } from "./scan.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Casefile } from "./casefile.js";
import { Diagnosis, toScoreInput, validateDiagnosis } from "./diagnosis.js";
import { score } from "./score.js";

const program = new Command();
program.name("levantate").description("Resurrect your dead repos.").version("0.1.0");

program
  .command("init")
  .description("Add the Kiro kit (agents, steering) to this Git workspace. Never overwrites.")
  .option("--dir <path>", "workspace directory", process.cwd())
  .action((o: { dir: string }) => {
    const r = init(o.dir);
    for (const f of r.created) console.log(`created  ${f}`);
    for (const f of r.skipped) console.log(`skipped  ${f} (already exists)`);
  });

program
  .command("scan")
  .description("Scan Git history and files offline and write .lazarus/casefile.json.")
  .option("--dir <path>", "workspace directory", process.cwd())
  .option("--clock <iso>", "fixed clock for reproducible demos")
  .action((o: { dir: string; clock?: string }) => {
    const clock = o.clock ? new Date(o.clock) : undefined;
    if (clock && Number.isNaN(clock.getTime())) throw new Error("--clock must be an ISO date");
    const { casefile, path } = scanAndWrite({ dir: o.dir, clock });
    const c = casefile.coverage;
    console.log(`casefile ${casefile.caseId} -> ${path}`);
    console.log(`files ${c.scannedFiles}/${c.trackedPaths}, commits ${c.commits} (${c.history}), omitted evidence ${c.omittedEvidence}`);
  });

program
  .command("validate")
  .description("Validate .lazarus/diagnosis.json against the casefile and print the score.")
  .option("--dir <path>", "workspace directory", process.cwd())
  .action((o: { dir: string }) => {
    const read = (f: string) => JSON.parse(readFileSync(join(o.dir, ".lazarus", f), "utf8")) as unknown;
    const cf = Casefile.parse(read("casefile.json"));
    const d = Diagnosis.parse(read("diagnosis.json"));
    const v = validateDiagnosis(d, cf);
    for (const e of v.errors) console.log(`error  ${e}`);
    const s = score(toScoreInput(cf, d));
    console.log(`base ${s.base}/${s.baseMax}  gap ${s.gap.points ?? "provisional"}  final ${s.final ?? "provisional"}`);
    for (const u of s.unknowns) console.log(`unknown  ${u}`);
    if (!v.ok) process.exit(1);
  });

try {
  program.parse();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
