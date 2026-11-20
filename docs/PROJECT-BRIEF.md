# Levántate Lázaro

*Arise, Lazarus — resurrect your dead repos.*

## Product and commercial case

Levántate Lázaro is a local TypeScript CLI and Kiro kit for anyone who needs to resume a stalled Git repository or review one they inherited. People leave projects for lack of time, knowledge, or tooling. They may also have lost the context needed to review code produced with AI. Lázaro combines Git history, static evidence, and the owner's recollection to recommend what to fix first, one improvement worth making next, and a local check for the first milestone. Use `levantate-lazaro` as the working npm and repository slug, and `levantate` as the CLI command. Confirm npm availability before publishing. Use the accented brand in marketing and English for code, specs, demo and submission.

**Verdict.** Build it for Kiroween. Commercial demand is a hypothesis. Developers, students, maintainers and small teams share the recovery workflow. Bootcamps are the first buyer to test because instructors review several teams on a recurring deadline. Their immediate need is to see each project's blocker, next action, improvement and verification status quickly. A portable review artifact also serves portfolio reviews and maintainer handoffs.

| Offer | What to test |
| --- | --- |
| MIT CLI and Kiro kit | Whether an owner reaches a verified first milestone faster or with less help than with Kiro alone |
| Paid cohort pilot after the event | Whether a program lead pays for onboarding and a repeatable workflow that reduces instructor review time across groups |

Run 3–5 observed sessions with permission on real repos, including owners outside bootcamps if available. Compare with Kiro using a strong direct prompt. Keep the model, acceptance criterion and time cap consistent. Use equivalent repos and alternate the order where possible. Record time to the first verified milestone, mentor minutes, failed attempts and actual credits if visible. Have a mentor triage several group summaries and record time per group plus whether they identify a useful next action. Treat this as directional feedback. Ask two instructors how they handled the last cohort and seek one pilot commitment with a date and budget. Report observed counts and timings.

The pitch is **recover intent, fix the first blocker and prove the result**. The report distinguishes blockers, possible quality or security concerns, and one prioritized improvement. A mentor sees what changed and how the team checked it. Plain Kiro is the baseline that this workflow has to beat.

## Kiroween 2026

Enter **Resurrection**. The rules call for reimagining obsolete technology. Use a new synthetic Node/Express fixture, `gastos-app`, whose compatibility target is Node 12. Demonstrate its expense workflow on supported Node 24 using built-in Node tooling for an offline smoke check. Show a failed baseline and a passing check for the same behavior after the first migration task. Keep the old runtime as evidence in the fixture and avoid installing it for the demo. Keep unrelated backlog items separate from the causal diagnosis. [Official rules](https://kiroween.devpost.com/rules) · [Node release status](https://nodejs.org/en/about/previous-releases)

| Event | Ecuador time |
| --- | --- |
| New-project build window opens | Oct 30, 2026, 11:00 |
| Request the one-time allotment of up to 4,000 Kiro credits | Dec 1, 2026, 15:00 |
| Internal submission target | Dec 3, 2026 |
| Submission deadline | Dec 4, 2026, 17:00 |
| Redeem credit code | By Dec 4, 2026, per rules |
| Redeemed credits expire | Jan 1, 2027, 02:59 |
| Free judging access through | Jan 29, 2027, 16:00 |

Plan for 48 business hours to review credit requests. Best Resurrection is $5,000. Impact, implementation, design, innovation and presentation each count for 20% after the initial eligibility review. Submit a public GitHub repo with detectable MIT license, a working demo or test-build URL with English instructions, a public YouTube video under three minutes and a Kiro usage write-up. Build during the official window and disclose any incorporated pre-existing work. List actual Kiro use and sources of assistance accurately. Verify eligibility for student and returning-entrant prizes. Blog and social bonuses have separate rules and are competitive. [Official rules](https://kiroween.devpost.com/rules) · [Submission overview](https://kiroween.devpost.com/)

## Scope

- **MVP.** Node 24, strict TypeScript ESM, `levantate init`, offline `scan`, a brief interview, an evidence-bound diagnosis, a revival spec and three interaction profiles. Verify one behavior locally and publish a portable HTML report with a compact mentor summary. Provide a local `review` command over explicitly supplied summary files. Use commander, simple-git, picocolors, Zod, Vitest and fast-check where they serve the implementation.
- **Demo fixture.** Generate from versioned `fixtures-src/gastos-app` using `scripts/make-fixtures.mjs`. Ignore generated `fixtures/` and use synthetic Git metadata. The planned last commit date is March 12, 2024. Record the demo clock and derive inactivity from the recorded UTC dates. Mark any replay data or cached dependency advisories as synthetic fixture results or dated source records as appropriate. The fixture is currently a build task in this workspace.
- **Fixture evidence.** Preserve the proposed expense-app backlog in synthetic form: a FIXME around timestamp units, an unfinished PDF-export branch, a committed fake environment example generated from a template, and up to four concrete README promises. Use these as secondary evidence and score inputs. Show defensively redacted findings. Keep the video centered on restoring one legacy entrypoint.
- **Stretch.** A printable certificate, a targeted test-strength demonstration on the synthetic fixture, live OSV with explicit `--online`, additional hooks, and a Python fixture. Unlock stretch work after the offline recovery and review flows pass. Keep backend, accounts, billing and a hosted multi-repo dashboard outside the hackathon build.

## Build and use

**Build in Kiro.** Start from the staged [requirements](kiro/revival-kit/requirements.md), [design](kiro/revival-kit/design.md), [tasks](kiro/revival-kit/tasks.md) and [prompt pack](kiro/PROMPTS.md). Copy the three spec files into `.kiro/specs/revival-kit/` when starting implementation. Execute one task at a time and record verification. Commit the product's steering, specs and verified hooks. Keep this brief in `docs/`.

**Use in a target repository.** Install the kit without overwriting existing files, scan locally, and answer up to five questions in one turn. The interview asks what the project was for, what the owner remembers, why work stopped, what success looks like now, and how much help they want. Séance hands the owner a prioritized checklist to carry out. Apprentice teaches through progressively stronger hints and leaves edits to the learner. Resurrection applies the first explicitly approved task, verifies it and stops for review. The remaining tasks form the route to completion.

**Review across groups.** The mentor opens shared summaries locally in one command. Each row shows the project goal, blocker, next action, one improvement, and the recorded check status. The mentor decides where to spend time. The review command uses supplied exports and costs no Kiro credits.

**Choose how to test.** The plan recommends one evaluation with a reason tied to the repository and the owner's goal. In the MVP, choose a simple before/after check or add a reproducible property check when the repo has a suitable rule and a runnable test. In `gastos-app`, the simple check verifies an expected expense total and the property checks whether reordering expenses preserves it. Other evaluation methods can appear as recommendations where they fit. Approve the result and inputs before repair and keep them fixed across runs. Local execution uses no testing service, API key or model call. Interactive diagnosis and guidance use Kiro. Display verification as pending when the project lacks an approved runnable criterion.

**Judging.** Provide a downloadable release/test build and a standalone report. From an already downloaded build with supported Node and Git, a judge can regenerate the fixture, run the offline scan and replay the recorded before/after workflow with zero API keys or Kiro credits. Label stored Kiro outputs as replay and run the local checks live. The interactive diagnosis and task execution in Kiro use the user's Kiro access. In the video, show the failing behavior, one interview answer that establishes what to recover, the Kiro task and the unchanged check passing. Close with the shareable result and the mentor's comparison of two summaries if time allows. Link the test build and show one measured user outcome if available.

## Delivery priorities

| Internal target | Exit evidence |
| --- | --- |
| Nov 23 | Fixture regenerates and offline scan produces a valid casefile |
| Nov 26 | Kiro produces a validated diagnosis and plan, and task 1 passes the fixture check |
| Nov 29 | Offline replay, report and local mentor review verified from a clean copy |
| Dec 2 | Tester observations, English release instructions, Kiro write-up and video ready |
| Dec 3 | Devpost draft checked against the rules and submitted |

Keep the build evidence in `docs/evidence/` using sanitized command outcomes, test results and Kiro artifacts. Measure context bytes and agent passes before making savings claims. If the IDE exposes actual usage, record it with the model and version. A one-change proof and reproducible offline build take priority over optional report effects and bonus entries.
