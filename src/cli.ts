#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./init.js";
import { scanAndWrite } from "./scan.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Casefile } from "./casefile.js";
import { Diagnosis, toScoreInput, validateDiagnosis } from "./diagnosis.js";
import { score } from "./score.js";
import { contextPack, recordUsage } from "./context.js";
import { bindDraft, DraftManifest, readManifest, TaskManifest, validateManifest } from "./manifest.js";
import { applyRecordedChange, writeReplayPlan } from "./replay.js";
import { isBaseline, recordBaseline, verifyAfter } from "./verify.js";
import type { Verification } from "./verify.js";
import { writeAtomic } from "./casefile.js";
import { renderReport } from "./report.js";
import { runDemo } from "./demo.js";
import { importRecorded } from "./recorded.js";
import { exportSummary } from "./summary.js";
import { review, renderTable, renderReviewHtml } from "./review.js";

function readJson(path: string): unknown | undefined {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; }
}

/** Load whatever artifacts exist. Missing ones render as pending. */
function loadArtifacts(dir: string) {
  const casefile = Casefile.parse(JSON.parse(readFileSync(join(dir, ".lazarus", "casefile.json"), "utf8")));
  const d = readJson(join(dir, ".lazarus", "diagnosis.json"));
  const m = readJson(join(dir, ".kiro", "specs", "revival", "task-1.json"));
  const v = readJson(join(dir, ".lazarus", "verification.json"));
  return {
    casefile,
    diagnosis: d ? Diagnosis.parse(d) : undefined,
    manifest: m ? TaskManifest.parse(m) : undefined,
    verification: v as Verification | undefined,
  };
}

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
  .command("context")
  .description("Print the bounded, redacted context pack for a phase and record its size.")
  .requiredOption("--phase <name>", "interview | diagnosis | plan | task")
  .option("--dir <path>", "workspace directory", process.cwd())
  .action((o: { phase: string; dir: string }) => {
    const cf = Casefile.parse(JSON.parse(readFileSync(join(o.dir, ".lazarus", "casefile.json"), "utf8")));
    const pack = contextPack(o.dir, cf);
    recordUsage(o.dir, { at: new Date().toISOString(), phase: o.phase, inputBytes: pack.bytes, passes: 1 });
    console.log(pack.text);
    console.error(`context ${pack.bytes} bytes, ${pack.files.length} files`);
  });

program
  .command("replay")
  .description("Offline replay of the recorded plan and change on the synthetic fixture.")
  .argument("<step>", "plan | apply")
  .option("--dir <path>", "fixture directory", process.cwd())
  .option("--properties", "also select the seeded property check")
  .action((step: string, o: { dir: string; properties?: boolean }) => {
    const cf = Casefile.parse(JSON.parse(readFileSync(join(o.dir, ".lazarus", "casefile.json"), "utf8")));
    if (step === "plan") {
      const m = writeReplayPlan(o.dir, cf, { properties: o.properties });
      console.log(`plan ${m.planDigest.slice(0, 12)} written (${m.evaluation.selection})`);
    } else if (step === "apply") {
      const m = readManifest(o.dir);
      console.log(`applied recorded change to ${applyRecordedChange(o.dir, m)}`);
    } else throw new Error("step must be plan or apply");
  });

program
  .command("verify")
  .description("Run the approved check before and after the repair.")
  .argument("<phase>", "baseline | after")
  .option("--dir <path>", "workspace directory", process.cwd())
  .action((phase: string, o: { dir: string }) => {
    if (!existsSync(join(o.dir, ".kiro", "specs", "revival", "task-1.json")) || !existsSync(join(o.dir, ".lazarus", "casefile.json"))) {
      console.log("no approved task manifest or casefile; nothing to verify");
      return;
    }
    const cf = Casefile.parse(JSON.parse(readFileSync(join(o.dir, ".lazarus", "casefile.json"), "utf8")));
    const m = readManifest(o.dir);
    if (phase === "baseline") {
      const r = recordBaseline(o.dir, m, cf);
      if (isBaseline(r)) console.log(`baseline recorded: expected failure seen (${r.signature})`);
      else { console.log(`${r.status}: ${r.reason}`); process.exit(1); }
    } else if (phase === "after") {
      const r = verifyAfter(o.dir, m, cf);
      console.log(`${r.status}: ${r.reason}`);
      if (r.property.status !== "not_selected") console.log(`property ${r.property.status}: ${r.property.detail}`);
      if (r.status !== "verified") process.exit(1);
    } else throw new Error("phase must be baseline or after");
  });

program
  .command("report")
  .description("Render a standalone HTML report from the local artifacts.")
  .option("--dir <path>", "workspace directory", process.cwd())
  .option("--label <text>", "project label", "project")
  .option("--out <file>", "output file")
  .action((o: { dir: string; label: string; out?: string }) => {
    const a = loadArtifacts(o.dir);
    const out = o.out ?? join(o.dir, ".lazarus", "report.html");
    writeAtomic(out, renderReport({ label: o.label, ...a }));
    console.log(`report -> ${out}`);
  });

program
  .command("export")
  .description("Write a shareable summary.json. Review it before you send it.")
  .option("--dir <path>", "workspace directory", process.cwd())
  .requiredOption("--label <text>", "project label shown to the mentor")
  .option("--out <file>", "output file")
  .action((o: { dir: string; label: string; out?: string }) => {
    const a = loadArtifacts(o.dir);
    const s = exportSummary({ label: o.label, ...a });
    const out = o.out ?? join(o.dir, ".lazarus", "summary.json");
    writeAtomic(out, JSON.stringify(s, null, 2) + "\n");
    console.log(JSON.stringify(s, null, 2));
    console.error(`summary -> ${out}`);
  });

program
  .command("review")
  .description("Compare shared summary files in one table. Reads only the files you name.")
  .argument("<files...>", "summary.json files (at most 20)")
  .option("--html <file>", "also write an HTML table")
  .action((files: string[], o: { html?: string }) => {
    const r = review(files);
    console.log(renderTable(r));
    if (o.html) writeAtomic(o.html, renderReviewHtml(r));
  });

program
  .command("demo")
  .description("Offline replay on the synthetic fixture: failing check, recorded change, passing check, report.")
  .option("--out <dir>", "output directory", "demo-out")
  .action((o: { out: string }) => {
    runDemo(o.out);
  });

program
  .command("mcp")
  .description("Start the read-only Git MCP server (stdio) for the Forense agent.")
  .option("--root <path>", "repository root to expose", process.cwd())
  .action(async (o: { root: string }) => {
    const { serve } = await import("./mcp.js");
    await serve(o.root);
  });

program
  .command("plan")
  .description("Bind an agent-written task draft to this casefile: fills file digests and the plan digest.")
  .argument("<step>", "bind")
  .option("--dir <path>", "workspace directory", process.cwd())
  .action((step: string, o: { dir: string }) => {
    if (step !== "bind") throw new Error("step must be bind");
    const cf = Casefile.parse(JSON.parse(readFileSync(join(o.dir, ".lazarus", "casefile.json"), "utf8")));
    const draftPath = join(o.dir, ".kiro", "specs", "revival", "task-1.draft.json");
    const draft = DraftManifest.parse(JSON.parse(readFileSync(draftPath, "utf8")));
    const m = bindDraft(o.dir, draft, cf.caseId);
    const v = validateManifest(m, cf, o.dir);
    if (!v.ok) { for (const e of v.errors) console.log(`error  ${e}`); process.exit(1); }
    writeAtomic(join(o.dir, ".kiro", "specs", "revival", "task-1.json"), JSON.stringify(m, null, 2) + "\n");
    console.log(`plan ${m.planDigest.slice(0, 12)} bound to case ${cf.caseId} (${m.evaluation.selection})`);
  });

program
  .command("record")
  .description("Save a real Kiro session (diagnosis, plan, the edit) as the replay inputs for the demo.")
  .requiredOption("--surface <name>", "kiro-ide | kiro-cli | kiro-web | kiro-crew")
  .requiredOption("--model <name>", "model name shown by Kiro")
  .option("--agent <name>", "agent that did the work", "lazaro")
  .option("--passes <n>", "correction passes used", "0")
  .option("--note <text>", "short note", "")
  .option("--dir <path>", "fixture workspace where the session ran", process.cwd())
  .action((o: { surface: string; model: string; agent: string; passes: string; note: string; dir: string }) => {
    const cf = Casefile.parse(JSON.parse(readFileSync(join(o.dir, ".lazarus", "casefile.json"), "utf8")));
    const r = importRecorded({
      fixtureRoot: o.dir,
      casefile: cf,
      diagnosisPath: join(o.dir, ".lazarus", "diagnosis.json"),
      manifestPath: join(o.dir, ".kiro", "specs", "revival", "task-1.json"),
      provenance: {
        surface: o.surface, model: o.model, agent: o.agent, correctionPasses: Number(o.passes),
        recordedAt: new Date().toISOString(), note: o.note,
      },
    });
    console.log(`recorded: ${r.provenance.surface}, ${r.provenance.model}. The demo now replays this session.`);
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
  await program.parseAsync();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
