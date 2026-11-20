# Revival Kit Design

## Runtime boundary

`init` copies only bundled kit paths using exclusive creation and reports conflicts. `scan`, `validate`, `report`, `review` and verification are local. Bundled demo commands run only the generated synthetic fixture. For arbitrary targets, scan Git metadata and static source; run an exact approved check only during first-task verification and only in the user's trusted workspace. Do not execute commands discovered in repository text automatically or assume a subprocess is a sandbox.

Keep generated artifacts under `.lazarus/` by default. Stage files in the same directory before atomic replacement. On rescans, bind all downstream artifacts to the new casefile and label old artifacts stale. Use a single Git worktree root, normalized repository-relative paths and canonical containment checks. Skip symlinks, ignored/untracked files and binary blobs in scan input, and avoid shell interpolation.

## Deterministic collection and contracts

| Artifact | Fields and validation |
| --- | --- |
| `.lazarus/casefile.json` | `schemaVersion`, `caseId`, `scannedAt`, `snapshot`, `coverage`, `activity`, `integrity`, `deps`, `clarity`, `codeMap`, `advisories`, `promises`, `evidence`, `contextPaths`. Evidence has unique IDs and a kind: file with path and positive line range, commit with full hash, or recorded check with outcome and artifact digest. Include safe excerpts only. |
| `.lazarus/diagnosis.json` | `schemaVersion`, `caseId`, `cause`, `confidence`, `evidenceIds`, `recollection`, `gaps`, `intentSummary`, `blocker`, `reviewSignals`, `opportunity`. Use `technical_block`, `dependency_rot`, `scope_creep`, `context_loss` or `unknown` for technical cause. Keep reported lack of time, knowledge or tooling in attributed recollection unless evidence corroborates it. Gap entries contain `promiseId`, `status` and `evidenceIds`. |
| `.kiro/specs/revival/` | `requirements.md`, `design.md`, `tasks.md` and machine-readable `task-1.json`. The manifest binds `caseId`, `taskId`, allowed paths, requirement IDs, evaluation selection, operator-confirmed expected behavior, expected baseline failure, check argv, harness and fixture paths and digests, and timeout. For a selected property check, bind the rule, separate command and harness, seed, run limit and timeout. A plan digest binds approval to that exact manifest. |
| `.lazarus/verification.json` | `caseId`, `taskId`, plan digest, before and after snapshots, check digest, outcomes, safe baseline failure signature and timestamps. Create verification only from local command outcomes. Use `not_run`, `failed`, `blocked`, `timed_out`, `stale` or `verified` for the recovery check. Record the selected property and its outcome separately. Display a reason when a check is pending. |
| Shareable `summary.json` | `schemaVersion`, operator-chosen project label, exported snapshot ID and timestamp, bounded goal, blocker, next action, optional opportunity, evidence references and recorded check status. Export on request and redact excerpts, secrets, absolute paths, remotes, emails and raw logs. Include only the operator-reviewed text intended for sharing. |

Define strict Zod schemas and reject dangling IDs, duplicate promise classifications and invalid paths. Hash canonical casefile data excluding the self-referential ID. Snapshot uses HEAD, repository index state and hashes of relevant working files, with a separate scope check for all changes during task execution. Capture pre-existing changes and preserve them. Recheck scoped inputs before writing phase outputs. For task 1, verify approved paths only and stop if an external edit, new out-of-scope change or unexpected baseline occurs. Changes from the approved task may invalidate later use of the original casefile as a fresh diagnosis, while verification still links its before and after snapshots.

Read bounded Git history, declared runtime and dependencies, CI and build/test metadata, README promises, TODO/FIXME markers and entrypoints. Check tracked files locally for defensive secret and insecure-pattern indicators. Redact matched values before collecting excerpts, including from history messages and path labels where needed. Treat indicators as leads. Use `not_scanned` when advisory data is absent and show cache date and provenance when present. Recognize lockfile presence independently of advisory coverage. Publish a coarse code map from declared entrypoints and tracked directories.

Keep the blocker separate from review signals and upside. A review signal includes category, cited evidence, uncertainty and a next review action. For complexity, tie the concern to a maintained behavior or a concrete cost, such as two inspected paths maintaining the same rule. File size alone is insufficient. The optional opportunity cites an evidence ID or explicitly attributed user goal, names the expected benefit and estimates effort, and proposes a measurable acceptance criterion. Use unknown or omit it when evidence is thin.

Cap scan traversal at 5,000 tracked paths, 128 KiB per text file and 100 commits. Sort selected paths and evidence deterministically. Record truncation and coverage when a cap applies. Put top evidence in a compact casefile targeting 2 KiB; enforce a 4 KiB serialized budget with deterministic prioritization and explicit omitted counts. Preserve distinct counts for detected signals and cited signals. Prefer a bounded, redacted context pack with README and up to five cited files, 1 KiB per file and 6 KiB total. Embed evidence line ranges in the pack and never include raw secret-bearing content. If the casefile or context cannot safely support a claim, carry the omission through to the report.

## Vitality and confidence

| Component | Rule |
| --- | --- |
| Activity /15 | UTC elapsed full days from last committer date. 0–30 → 15, 31–90 → 12, 91–180 → 8, 181–365 → 4, 366+ → 0. Clamp future skew to zero days and label it. No history → 0 with unknown coverage. |
| Integrity /30 | Test files 5, passing recorded check relevant to snapshot 15, CI config 5, declared build script 5. An unrun check leaves 15 unawarded and is labeled unknown. |
| Dependencies /20 | Recognized ecosystem lockfile 10, no wildcard or unpinned direct dependencies in fully inspected manifests 10. Missing or incomplete inspection leaves the applicable points unawarded. |
| Clarity /10 | README 4, README with at least 200 non-whitespace characters 2, recognized license file 2, populated manifest description 2. |
| Gap /25 | Round to one decimal: 25 × (fulfilled + 0.5 × partial) / total. Apply only when the promise set is nonempty, complete and every promise has a supported classification. Otherwise show provisional base /75 and explain why. |

Use `fulfilled`, `partial`, `missing` and `unknown` as promise statuses. `missing` requires positive evidence such as an explicit pending TODO or a documented failing check. If neither the casefile nor selected context supports classification, use `unknown`. Keep completeness and score denominators visible. Treat the score as a prioritization heuristic. Use high confidence for reproducible corroboration, medium for a direct signal without reproduction and low for weak signals or recollection alone. Record contradictions and prefer observable evidence for technical claims. Keep interview answers as attributed recollection.

## Agent passes and release

Run interview once. A fresh diagnosis reads only the casefile and supplied context. Planning reads accepted diagnosis, intent and only the evidence needed for proposed tasks. Execution reads task 1, its allowed paths and its verification prerequisites. Additional unknowns require a targeted request to the deterministic collector. Each agent-authored artifact gets one correction pass with concrete validator errors. Keep output limits in the prompt pack. Prompt limits are workflow instructions; record real IDE behavior before describing them as enforced. Inspect diffs and check results at each approval boundary.

Render portable HTML with escaped text and bundled assets. Lead with goal, blocker, next action, opportunity and verification, followed by supporting diagnosis, security signals, code map and learning plan. Keep citations accessible and progress scoped to the case ID. If the printable certificate ships, gate it on the current verified record. A progress toggle never unlocks it.

`levantate review <summary...>` accepts at most 20 explicitly selected local JSON files per run, each at most 16 KiB. Validate and render one compact row per valid export, in input order. Reject unsupported versions and invalid fields per input while continuing valid rows. Strip terminal controls from display. At export, validate verification against the snapshot being exported. At review, show only the status as of the export date. Keep this workflow separate from the per-repo interaction profiles and Kiro context.

Bundle a release with pinned dependencies already included, fixture generator, static replay inputs and offline smoke script. The script produces a fresh failing snapshot, runs the disclosed recorded change, verifies the passing snapshot and regenerates the report. Make deterministic hooks small and narrow. Prioritize a tested post-task validation hook and demonstrate its actual trigger before adding extra automation.

Define the fixture milestone as producing a correct expense total from fixed sample data through the supported Node 24 entrypoint. Keep the expense calculation in a small dependency-free module so the release can verify behavior without installing the legacy Express tree. During T1, record the specific legacy startup incompatibility that blocks the same check on Node 24. During T5, use the spec to replace that startup path with a supported entrypoint and rerun the exact check. The release should describe the recovered expense workflow and list the wider Express integration as pending if it was outside task 1.

## Local testing

Recommend an evaluation in Phase 2 using the same evidence pack as the plan. Include its purpose, the evidence or attributed goal that makes it relevant, and the missing prerequisite if any. Default to a simple behavior check when it answers the recovery question. Offer **simple + properties** when an operator can confirm an invariant and has a bounded runnable harness with known inputs. The bundled fixture provides that harness. For other repos, accept an existing or separately prepared operator-approved harness. Keep the option unavailable when the prerequisite is missing. Present the recommendation and available choices together within the existing planning and approval steps.

| Method | When to suggest it |
| --- | --- |
| Simple | A known input, action and expected result establish the first milestone. |
| Property-based | A confirmed invariant applies across many inputs. |
| Adversarial review | A scoped change or its tests may share assumptions that warrant independent human review. |
| Defensive fuzzing | Local input-handling code should remain reliable over a wide range of benign malformed inputs. |
| Mutation | A passing suite should catch a selected controlled functional defect. Keep any hackathon demonstration confined to the bundled synthetic fixture. |
| Differential | The old and new versions can run the same inputs and equivalent behavior is expected. |
| Metamorphic | A predictable relationship between outputs applies when an input is changed and an exact expected output is hard to specify. |
| Evals and LLM as judge | An AI product needs a rubric to assess output quality. Keep outside the local MVP. |
| Red teaming | A tool-using AI or sensitive-data workflow would benefit from an authorized defensive review of safeguards. |

Keep advisory methods in the written plan and outside the project runner. In Séance, return a checklist. In Apprentice, guide the owner through the check. In Resurrection, include the selected check in the existing task approval. A change to that selection invalidates prior approval and requires the corresponding baseline for the new plan. An unselected property has no outcome. A property result cannot mark recovery verified by itself, and a failed selected property remains visible even when the recovery check passes.

Use an expected result reviewed by the operator and the same approved harness and fixtures on both sides of the repair. Keep check files outside the source edit allowlist, and revalidate their digests around both executions. Record the expected baseline failure reason, not just a nonzero exit code. When no credible check is available, propose a criterion for the operator to approve and show verification pending. Do not introduce a second model pass in the default workflow.

Bundle one functional property test for the fixture and run it after the repair when selected. For bounded lists of integer-cent expense values, reversing the list preserves the total. Pair it with a fixed example with an independent expected total so a function that always returns zero cannot satisfy the whole check. Pin the seed and run count for demo replay and show a minimized, sanitized counterexample when available. Report this property separately from behavior verification. If time remains, evaluate whether the fixture's suite catches one known arithmetic defect in a disposable copy and show the outcome as a narrow test-strength check.

## Verification properties

Use fast-check for P1 base and final bounds, P2 older activity cannot earn more, P3 adding a positive integrity signal cannot lower score, P4 upgrading a known promise cannot lower Gap points, P5 identical inputs and clock produce identical output, P6 absent or incomplete promise evidence stays provisional and P7 missing checks cannot earn passing-check points. Add targeted coverage of non-clobbering install, redaction, invalid references, stale snapshots, offline network absence, unchanged check inputs, unexpected baseline outcomes and both expected fixture check outcomes.
