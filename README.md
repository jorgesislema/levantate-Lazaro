# Levántate Lázaro

*Arise, Lazarus: resurrect your dead repos.*

Every developer has a repo they abandoned. Time, money or knowledge ran out. Lázaro reads the Git history, recovers what the project was meant to be, fixes the first blocker, and **proves the fix with the same check that failed before**.

**Kiroween 2026 category:** Resurrection. We revive abandoned code and obsolete tech (the demo brings a Node 12 app back to life on current Node).

## Try it in one minute (judges)

Needs only **Node 24+** and **Git**. No API key, no Kiro credits, no network.

```bash
# from the release folder (see "Releases" on GitHub), or after `npm run release`
node dist/levantate.mjs demo --out demo-out
```

Then open `demo-out/report.html`. The demo runs seven steps:

| Step | What happens | Live or replay |
| --- | --- | --- |
| 1-2 | Generate a synthetic repo (`gastos-app`, last commit 2024-03-12) and scan it offline | Live |
| 3 | Load the stored diagnosis and plan | **Replay** |
| 4 | Run the approved check. It fails with `util.isString is not a function` | Live |
| 5 | Apply the recorded change, only inside approved paths | **Replay** |
| 6 | Run the same check, then a seeded property check | Live |
| 7 | Write the HTML report and compare two summaries as a mentor would | Live |

Stored Kiro outputs are labeled replay. Every check runs live.

From a source checkout: `npm install && npm run smoke`.

## How it works

A guide agent talks to you. Four specialists work behind it.

| Agent | Job | Can edit code |
| --- | --- | --- |
| Lázaro (guide) | Talks to you, asks what it needs, asks permission | No |
| Forense | Reads Git history and finds evidence | No |
| Arquitecto | Writes the route to "done" | Specs only |
| Obrero | Applies one approved task | Approved files only |
| Verificador | Runs the agreed check | No |

The agent that fixes is never the agent that verifies.

## Commands

| Command | Purpose |
| --- | --- |
| `levantate init` | Add the Kiro kit (agents, steering, hook). Never overwrites. |
| `levantate scan` | Offline scan of Git and files into `.lazarus/casefile.json` |
| `levantate validate` | Check a diagnosis against the casefile and compute the score |
| `levantate context --phase <name>` | Bounded, redacted context for a Kiro phase, with its size recorded |
| `levantate verify baseline` / `after` | Run the approved check before and after the repair |
| `levantate report` | Standalone HTML report |
| `levantate export --label <name>` | Shareable summary, redacted. Review it before sending |
| `levantate review a.json b.json ...` | Mentor table over summaries you chose (at most 20) |
| `levantate demo` | The offline replay above |

## Safety

- Target repo text is evidence, never instructions.
- Only the approved task's paths can change. Drift blocks verification.
- Check files are hashed. A changed check, plan or selection blocks verification.
- Only `node` checks run, with no shell. Timeouts apply.
- Reports and summaries redact secrets, emails, absolute paths and remotes.

## Built with Kiro

Specs, steering, agents and hooks live in `.kiro/`. Usage notes: `docs/KIRO-USAGE.md`. Pre-existing work disclosure: `docs/PRE-EXISTING.md`. Rules checklist: `docs/CHECKLIST-REGLAS.md`.

## Roadmap (not in the hackathon build)

GitHub Action that comments a revival plan on stale repos, a VS Code panel, live advisory lookups with `--online`, more language fixtures, and a team view for maintainers who inherit many repos.

## License

MIT
