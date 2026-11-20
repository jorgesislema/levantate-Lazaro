# Devpost submission draft

Fill the bracketed items with real, measured values before submitting. Remove anything that is not true.

## Category
Resurrection. Bonus: [Startup / Kiro Crew App / Blog / Social, only the ones that apply].

## Inspiration
Every developer has an abandoned repo. Lack of time, money, knowledge or context kills projects. Reviewers also inherit repos nobody remembers.

## What it does
Levántate Lázaro recovers a stalled repo in four moves: scan Git history offline, recover intent from the README and the owner's memory, fix the first blocker inside approved paths, and prove the fix with the same check that failed before. A mentor view compares many projects in one table.

## How we built it with Kiro
Answer each topic with what actually happened. Source notes: `docs/KIRO-USAGE.md`.
- Kiro IDE, CLI, Web, Crew: [which you used and how they differed]
- Custom agents: five agents in `.kiro/agents/` (guide, forense, arquitecto, obrero, verificador). [Impact on the build]
- Agent hooks: `typecheck-on-edit` and `lazarus-verify-after-task`. [Trigger observed in the IDE? yes/no]
- Spec-driven development: specs in `.kiro/specs/revival-kit/`, tasks T1-T7. [Spec vs vibe coding: measured difference]
- Steering: always-on `lazarus.md` and `lazaro-voice.md`, manual phase prompts. [What made the biggest difference]
- MCP: [server and what it enabled, or "not used"]
- Property-based testing: seven score properties (P1-P7) and a seeded fixture property. [Bugs found]
- Kiro powers: [which, or "not used"]

## Challenges
Keeping the verifier independent of the editor. Making claims bound to evidence IDs. Redacting secrets in every output.

## What we are proud of
The failing check and the passing check are the same file with the same data, and the harness is hashed so it cannot change in between.

## What is next
GitHub Action, VS Code panel, live advisories, more languages, team view.

## Try it
Release folder, Node 24 and Git only: `node dist/levantate.mjs demo --out demo-out`. Stored Kiro outputs are labeled replay. Checks run live.
