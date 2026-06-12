---
description: One Hermes ingest tick — poll Telegram, triage fresh signals into Plane, gate to roadmap.
allowed_tools: [Bash, Agent, AskUserQuestion]
---

Run one ingest tick:

1. Run: `set -a; . ./.env; set +a; node ingest/poll.mjs`
   Parse stdout as a JSON array of signals. If `[]` → report "no new signals" and stop.
2. For EACH signal, spawn the `po-agent` subagent (Agent tool) with that single
   signal as input. Collect each result.
3. Collect all `action: "created"` issues into one batch.
4. GATE 1 — AskUserQuestion (batch): list the created triage issues
   (title · type · priority) and ask which to admit to the roadmap.
   - approved → ask Plane MCP to move issue state triage → backlog/active.
   - rejected → ask Plane MCP to close/cancel the issue.
5. Report a one-line summary: N polled, M created, K admitted, rest closed.

If poll.mjs exits non-zero, report the error and stop — do not advance silently.

Continuous mode: `/loop 2m /hermes-ingest` (start when you want Hermes live).
