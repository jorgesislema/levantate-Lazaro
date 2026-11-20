# Revival Kit Requirements

## R1 — Install and scan

- When an operator runs `levantate init` in a supported Git workspace, the CLI shall add the Kiro kit and report any existing path it skipped.
- When an operator runs `levantate scan`, the CLI shall read bounded local Git and repository data, validate and atomically write a versioned casefile, and report unavailable or truncated evidence.
- While running offline, the CLI shall avoid network calls and target-code execution. If Git history is unavailable, the CLI shall record that condition and preserve available file evidence for a valid Git workspace.

## R2 — Interview and diagnosis

- When the operator starts a revival, the agent shall ask five questions together and accept an explicit skip. Skipped mode and scope shall resolve to Séance and minimal.
- When the agent produces a diagnosis, it shall cite known evidence IDs for factual claims, identify inferences and user recollections, and label unsupported conclusions unknown.
- When evidence supports a recommendation, the diagnosis shall distinguish the first blocker, up to three defensive security or complexity review signals, and at most one further improvement tied to the operator's goal. Each recommendation shall include a practical next action. Uncertain signals and missing coverage shall be visible.
- When the CLI validates the diagnosis, it shall reject broken evidence references, unknown promise IDs and stale casefile bindings. It shall calculate score components according to the design.

## R3 — Plan and authorize work

- When a diagnosis is valid, the agent shall write intent and a revival spec with EARS requirements, a design and up to ten ordered tasks. Each task shall have an ID, evidence or stated user goal, allowed paths, a check, skill, estimated minutes and rationale.
- While operating in Séance, the agent shall return an ordered checklist for self-directed work and write only revival artifacts. While operating in Apprentice, it shall provide progressively stronger hints and leave source edits to the user.
- When Resurrection is selected and the operator authorizes task 1 and its checks, the agent shall work within the approved paths, stop after the selected checks pass or three attempts, and leave subsequent tasks pending.
- If the snapshot, approved scope, expected baseline, or command changes, the workflow shall stop with a concrete reason and request refreshed evidence or approval as appropriate.

## R4 — Report and replay

- When a casefile is available, the CLI shall render a standalone HTML report with coverage and provenance labels. When available, show the recommended evaluation, rationale, operator's selection and separate check outcomes. When diagnosis or verification is absent, render the available sections and show the pending state.
- When a judge uses the downloaded demo build with its prerequisites installed, the fixture scan, first-task replay checks and HTML rendering shall work without a network connection, Kiro account or API key.

## R5 — Local verification

- When the agent plans the first task, it shall recommend one evaluation based on the approved goal and available evidence, explain why it fits, and show the applicable executable choices. The owner shall be able to choose a simple behavior check or add a property check when a suitable rule and runnable harness are available.
- When another evaluation method fits, the plan may recommend it with its prerequisite and review purpose. The runner shall execute only approved MVP check types. The selection shall be independent of whether the owner wants a checklist, guided practice or approved execution.
- When recovery work uses a behavior check, the runner shall bind the operator-approved expected behavior, command, test harness and input fixtures to the plan before source changes. The runner shall check that they are unchanged across baseline and post-change runs.
- When the expected baseline fails and the post-change check passes against the same approved criterion, the runner shall record verified recovery for that behavior and its snapshots. If the check lacks approval, cannot run, times out, fails for an unrelated reason, or changes, the runner shall record the specific outcome and preserve the unverified state.
- When the operator selects a property check, the runner shall record its outcome separately from recovery verification. The synthetic fixture shall offer a bounded, seeded property check for a declared expense-total rule. Local checks shall use no model calls or hosted test service.

## R6 — Mentor review

- When the operator exports a report for sharing, the CLI shall generate a compact summary with a chosen project label, objective, blocker and evidence references, next action, optional improvement and verification status as of export. The operator shall be able to review the summary before sharing it.
- When a mentor supplies several local summary files to `levantate review`, the CLI shall render comparable rows for the valid inputs and report invalid or unsupported inputs individually. While reviewing summaries, the CLI shall avoid repository access, source edits, test execution and agent calls.
