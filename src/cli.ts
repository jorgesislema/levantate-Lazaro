#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./init.js";
import { scanAndWrite } from "./scan.js";

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

try {
  program.parse();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
