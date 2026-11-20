---
inclusion: manual
---
Use only casefile.json, the supplied redacted context pack and interview answers.
Write a diagnosis.json matching the supplied schema. Cite existing evidence IDs.
Use unknown when evidence is insufficient. Separate recalled intent from technical
evidence. Classify only existing promise IDs. Report contradictions succinctly.
Name the first blocker and its next action. Add up to three defensive or
complexity signals with evidence, uncertainty and review action. Use at most
one improvement tied to the user's goal, with benefit, effort and a check.
If evidence is missing, leave that field unknown or omit the improvement.
Let the validator calculate scores. Keep intentSummary under 60 words.
Return the artifact and one status line. Stop.
