---
description: Drive one issue through the ADLC pipeline (fake mode) with human gates.
allowed_tools: [Bash, Agent, AskUserQuestion]
---
Given an issue id (or the latest backlog issue):

1. GATE: PM plan — dispatch pm-agent for the issue, show sub-tasks, AskUserQuestion to approve the plan. On approve, set issue state `backlog` (ready to advance).
2. Run `node pipeline/run.mjs <issueId>` — it auto-advances planned→in_dev→in_qa using dev-agent (test-first) + fake CI.
3. If state = in_qa (CI pass): GATE 5 — show the MR + diff, AskUserQuestion to approve merge. On approve, mark merged.
4. If escalated (CI fail / in_dev): show the CI report, ask the human how to proceed.
5. After merge: dispatch devops-agent → staging. GATE 6 — prod is a separate explicit approval (not in fake mode).
6. Report the issue's journey: stages passed, MR id, CI status, gates hit.

All state lives in `.hermes/fake/*.json` (HERMES_MODE=fake). No prod keys used.
