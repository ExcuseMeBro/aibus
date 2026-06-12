# Hermes ADLC — PO Slice Design (Telegram → Plane Issue)

> **Status:** approved design, ready for implementation plan
> **Date:** 2026-06-12
> **Scope:** First implementation slice of Hermes ADLC — PO agent only.
> Parent architecture: `ARCHITECTURE.md`.

---

## 1. Goal

Smallest working slice of the Hermes SDLC factory: a Telegram message becomes a
triaged Plane issue with acceptance criteria, behind a human gate. Proves the
ingest → agent → shared-state → gate loop end-to-end before adding PM/Dev/QA.

**Out of scope (later slices):** PM breakdown, Dev crew, QA, DevOps, Marketing,
Docmost/GitLab/Mailcow wiring. This slice touches only Telegram + Plane.

## 2. Locked decisions

| Fork | Decision |
|------|----------|
| Implementation path | **A — Subagent crew** (Claude Code session, no standalone service) |
| First slice | **PO-only deep** (Telegram → Plane Issue + AC + dedup + Gate 1) |
| Signal source | **Telegram bot** (`@brodyone_bot`), group + DM |
| Group filter | `@bot` mention / `/task` command only |
| Ingest trigger | Claude Code `/loop` poll (~2 min), `getUpdates` with saved offset |
| MCP wiring | **Real** — Plane MCP + Telegram bot API |

**Privacy-mode note:** `@brodyone_bot` has `can_read_all_group_messages: false`
(privacy mode ON). Telegram therefore delivers ONLY mentions, commands, and
replies-to-bot in groups. The chosen filter is enforced by Telegram itself —
no extra spam filter needed. (If full-group AI classification is ever wanted,
privacy mode must be disabled in BotFather. Not in this slice.)

## 3. Architecture (flow)

```
/loop ~2m  (Claude Code session = Hermes)
  └─ ingest/telegram: curl getUpdates?offset=<saved>
       └─ filter: keep group msgs that @mention bot or are /task ; keep all bot DMs
            └─ signal { chat_id, from, text, msg_id, ts }
                 └─ dedup: fingerprint(chat_id + normalized_text) seen? → skip
                      └─ PO agent  (.claude/agents/po-agent.md)
                           ├─ classify: bug | feature | debt | question
                           ├─ prioritize (RICE or MoSCoW)
                           ├─ Plane MCP → create Issue (state: triage) + AC (Given/When/Then)
                           └─ GATE 1: AskUserQuestion (batch)
                                ├─ approve → Issue moved to active/backlog
                                └─ reject  → Issue closed/cancelled
```

## 4. Components

Each unit has one purpose, a clear interface, and is independently testable.

| Component | File | Responsibility | Interface |
|-----------|------|----------------|-----------|
| Telegram ingest | `ingest/telegram.mjs` | fetch `getUpdates`, filter, map to signals, compute next offset | `parseUpdates(json) -> {signals[], nextOffset}` ; `filter(message) -> bool` |
| Dedup | `ingest/dedup.mjs` | fingerprint a signal, check/record seen set | `fingerprint(signal) -> string` ; `isSeen(fp)` / `markSeen(fp)` over `.hermes/seen.json` |
| Offset store | `.hermes/tg-offset` | persist last processed `update_id + 1` | plain integer file |
| PO agent | `.claude/agents/po-agent.md` | signal → classify → Plane Issue + AC ; stop before roadmap (gate) | subagent definition |
| Ingest runner | `.claude/commands/hermes-ingest.md` | one `/loop` iteration: ingest → dedup → dispatch PO agent per fresh signal | slash command |
| Gate 1 | inline `AskUserQuestion` | batch-approve issues into roadmap | — |

**Why a `.mjs` module, not pure agent prose:** the parse/filter/dedup logic is
deterministic and must be unit-tested (TDD). Keeping it in small Node modules
makes it verifiable and keeps the agent prompt focused on judgment, not parsing.

## 5. Data shapes

```
Signal = {
  chat_id:  number,      // telegram chat
  msg_id:   number,      // telegram message_id
  from:     string,      // username or first_name
  text:     string,      // message text (mention/command stripped for triage)
  ts:       string       // ISO 8601 UTC (from message date)
}

Fingerprint = sha256( chat_id + ":" + normalize(text) )   // normalize: trim, lowercase, collapse whitespace
```

Plane Issue created via MCP: `name` (title), `description_html` (body + AC),
`state` = triage. Acceptance criteria in Given/When/Then inside description.

## 6. State & secrets

- Offset: `.hermes/tg-offset` (gitignored).
- Dedup set: `.hermes/seen.json` (gitignored). Optionally migrate to `agentmemory` MCP later.
- `.env` (gitignored): `TELEGRAM_BOT_TOKEN`, `PLANE_BASE_URL`, `PLANE_API_KEY`, `PLANE_WORKSPACE_SLUG`.
- Repo carries only `.env.example`. No real secret committed.

## 7. Error handling

- `getUpdates` failure → log, return no signals, retry next loop. **Offset only
  advances after a batch is fully processed** — a crash mid-batch reprocesses,
  and dedup prevents duplicate issues. (At-least-once + idempotent.)
- Plane MCP failure on create → do NOT advance past that signal; log + escalate
  to user. Signal is not lost.
- Malformed update → skip that update, continue batch, log.
- Telegram `getUpdates` long-poll uses the standard `offset` ack so old updates
  are not re-fetched once acknowledged.

## 8. Testing (TDD — red first)

Unit (deterministic modules):
1. `dedup.fingerprint` — same text (varied case/whitespace) → same hash; different chat → different hash.
2. `dedup.isSeen/markSeen` — unseen→false, after mark→true; persists across reload.
3. `telegram.filter` — group msg with `@brodyone_bot` → true; `/task ...` → true; plain group chatter → false; bot DM → true.
4. `telegram.parseUpdates` — sample `getUpdates` JSON → correct signals[]; `nextOffset = max(update_id)+1`; empty result → [] and unchanged offset.

Integration / eval:
5. PO classification eval — 5 sample messages → expected {type, priority} (bug, feature, debt, question, noise→ignored).
6. End-to-end manual: real message to `@brodyone_bot` → Plane Issue appears in triage → Gate 1 prompt → approve → issue active.

## 9. Build order (for the plan)

1. Repo skeleton: `ingest/`, `.hermes/` (gitignored), `.claude/agents/`, `.claude/commands/`.
2. TDD `ingest/dedup.mjs` (tests → code).
3. TDD `ingest/telegram.mjs` (tests → code).
4. Plane MCP connect (real) + smoke: create + close a throwaway issue.
5. `.claude/agents/po-agent.md` PO subagent + classification eval.
6. `.claude/commands/hermes-ingest.md` runner wiring ingest → PO → Gate 1.
7. End-to-end manual run via `/loop`.

## 10. Open dependency

**Plane self-host must be deployed and reachable** with an API key + workspace
slug before steps 4–7. Telegram side is ready (token verified). If Plane is not
yet up, steps 1–3 + 5 (agent prompt) proceed; 4/6/7 block on Plane creds.
