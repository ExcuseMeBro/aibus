# Hermes PO Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Telegram message to `@brodyone_bot` becomes a triaged Plane issue with acceptance criteria, behind a human gate.

**Architecture:** Path A subagent crew — Claude Code session is Hermes. A `/loop` poll runs `node ingest/poll.mjs`, which fetches Telegram `getUpdates`, filters to `@bot`/`/task` signals, dedups, and emits fresh signals as JSON. The CC command then spawns the PO subagent per signal, which classifies and writes a Plane issue via the real Plane MCP, then asks Gate 1 for batch approval.

**Tech Stack:** Node ≥18 (ESM `.mjs`, built-in `fetch`, `node:test`, `node:crypto`), Plane MCP, Telegram Bot API, Claude Code subagents + slash command.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | ESM project, `npm test` → `node --test` |
| `ingest/dedup.mjs` | fingerprint a signal + persist seen set (`.hermes/seen.json`) |
| `ingest/dedup.test.mjs` | unit tests for dedup |
| `ingest/telegram.mjs` | pure: filter messages, map to signals, parse `getUpdates` → `{signals, nextOffset}` |
| `ingest/telegram.test.mjs` | unit tests for telegram parsing/filter |
| `ingest/poll.mjs` | thin glue: read offset → fetch getUpdates → parse → dedup → emit fresh signals JSON → advance offset |
| `.claude/agents/po-agent.md` | PO subagent definition (classify → Plane Issue + AC → stop at gate) |
| `.claude/commands/hermes-ingest.md` | `/loop` runner: run poll.mjs, dispatch PO agent per signal, Gate 1 |
| `.hermes/` | gitignored runtime state (offset, seen.json) |

---

## Task 1: Project skeleton

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "hermes-adlc",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Add `.hermes/` to `.gitignore`**

Append to `.gitignore`:

```
# runtime state
.hermes/
```

- [ ] **Step 3: Verify Node version ≥18**

Run: `node --version`
Expected: `v18.x` or higher (need built-in `fetch` + `node:test`).

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: node esm skeleton + ignore .hermes runtime state"
```

---

## Task 2: Dedup module (TDD)

**Files:**
- Create: `ingest/dedup.test.mjs`
- Create: `ingest/dedup.mjs`

- [ ] **Step 1: Write the failing test**

`ingest/dedup.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalize, fingerprint, isSeen, markSeen } from './dedup.mjs'

test('normalize trims, lowercases, collapses whitespace', () => {
  assert.equal(normalize('  Fix   The  BUG\n'), 'fix the bug')
})

test('fingerprint stable across case/whitespace, varies by chat', () => {
  const a = fingerprint({ chat_id: 1, text: 'Fix the bug' })
  const b = fingerprint({ chat_id: 1, text: '  fix   the BUG ' })
  const c = fingerprint({ chat_id: 2, text: 'Fix the bug' })
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('isSeen/markSeen persist across reload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dedup-'))
  const path = join(dir, 'seen.json')
  const fp = 'abc123'
  try {
    assert.equal(isSeen(fp, path), false)
    markSeen(fp, path)
    assert.equal(isSeen(fp, path), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test ingest/dedup.test.mjs`
Expected: FAIL — `Cannot find module './dedup.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`ingest/dedup.mjs`:

```js
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SEEN_PATH = '.hermes/seen.json'

export function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function fingerprint(signal) {
  return createHash('sha256')
    .update(`${signal.chat_id}:${normalize(signal.text)}`)
    .digest('hex')
}

function load(path = SEEN_PATH) {
  if (!existsSync(path)) return new Set()
  return new Set(JSON.parse(readFileSync(path, 'utf8')))
}

function save(set, path = SEEN_PATH) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify([...set]))
}

export function isSeen(fp, path = SEEN_PATH) {
  return load(path).has(fp)
}

export function markSeen(fp, path = SEEN_PATH) {
  const set = load(path)
  set.add(fp)
  save(set, path)
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test ingest/dedup.test.mjs`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add ingest/dedup.mjs ingest/dedup.test.mjs
git commit -m "feat: dedup fingerprint + persistent seen set"
```

---

## Task 3: Telegram parse/filter module (TDD)

**Files:**
- Create: `ingest/telegram.test.mjs`
- Create: `ingest/telegram.mjs`

- [ ] **Step 1: Write the failing test**

`ingest/telegram.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filter, toSignal, parseUpdates } from './telegram.mjs'

const groupChatter = { chat: { id: -10, type: 'group' }, text: 'lunch?', message_id: 1, from: { username: 'al' }, date: 1700000000 }
const groupMention = { chat: { id: -10, type: 'supergroup' }, text: '@brodyone_bot fix login bug', message_id: 2, from: { username: 'al' }, date: 1700000000 }
const groupCommand = { chat: { id: -10, type: 'group' }, text: '/task add dark mode', message_id: 3, from: { username: 'al' }, date: 1700000000 }
const dm = { chat: { id: 55, type: 'private' }, text: 'hello', message_id: 4, from: { username: 'al' }, date: 1700000000 }

test('filter: group chatter rejected', () => {
  assert.equal(filter(groupChatter), false)
})
test('filter: group @mention accepted', () => {
  assert.equal(filter(groupMention), true)
})
test('filter: group /task command accepted', () => {
  assert.equal(filter(groupCommand), true)
})
test('filter: bot DM always accepted', () => {
  assert.equal(filter(dm), true)
})
test('filter: missing text rejected', () => {
  assert.equal(filter({ chat: { id: 1, type: 'group' } }), false)
})

test('toSignal strips mention/command, sets ISO UTC ts', () => {
  const s = toSignal(groupMention)
  assert.equal(s.chat_id, -10)
  assert.equal(s.msg_id, 2)
  assert.equal(s.from, 'al')
  assert.equal(s.text, 'fix login bug')
  assert.equal(s.ts, '2023-11-14T22:13:20.000Z')
})

test('parseUpdates returns fresh signals + nextOffset', () => {
  const json = { ok: true, result: [
    { update_id: 100, message: groupChatter },
    { update_id: 101, message: groupCommand },
  ] }
  const { signals, nextOffset } = parseUpdates(json)
  assert.equal(signals.length, 1)
  assert.equal(signals[0].text, 'add dark mode')
  assert.equal(nextOffset, 102)
})

test('parseUpdates empty result → no signals, null offset', () => {
  const { signals, nextOffset } = parseUpdates({ ok: true, result: [] })
  assert.deepEqual(signals, [])
  assert.equal(nextOffset, null)
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `node --test ingest/telegram.test.mjs`
Expected: FAIL — `Cannot find module './telegram.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`ingest/telegram.mjs`:

```js
const BOT_USERNAME = 'brodyone_bot'

export function filter(message, botUsername = BOT_USERNAME) {
  if (!message || typeof message.text !== 'string') return false
  if (message.chat?.type === 'private') return true
  const text = message.text
  if (/^\/task(@\w+)?(\s|$)/.test(text)) return true
  return text.includes(`@${botUsername}`)
}

export function toSignal(message, botUsername = BOT_USERNAME) {
  const text = (message.text || '')
    .replaceAll(`@${botUsername}`, '')
    .replace(/^\/task(@\w+)?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    chat_id: message.chat.id,
    msg_id: message.message_id,
    from: message.from?.username || message.from?.first_name || 'unknown',
    text,
    ts: new Date(message.date * 1000).toISOString(),
  }
}

export function parseUpdates(json, botUsername = BOT_USERNAME) {
  const updates = json?.result || []
  const signals = []
  let maxId = -1
  for (const u of updates) {
    if (typeof u.update_id === 'number') maxId = Math.max(maxId, u.update_id)
    const msg = u.message
    if (msg && filter(msg, botUsername)) signals.push(toSignal(msg, botUsername))
  }
  return { signals, nextOffset: maxId >= 0 ? maxId + 1 : null }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `node --test ingest/telegram.test.mjs`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add ingest/telegram.mjs ingest/telegram.test.mjs
git commit -m "feat: telegram filter + signal parse with offset"
```

---

## Task 4: Poll glue script

**Files:**
- Create: `ingest/poll.mjs`

- [ ] **Step 1: Write `ingest/poll.mjs`**

```js
// Thin IO glue: offset -> getUpdates -> parse -> dedup -> emit fresh signals JSON.
// Network + filesystem only; pure logic lives in telegram.mjs / dedup.mjs.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseUpdates } from './telegram.mjs'
import { fingerprint, isSeen, markSeen } from './dedup.mjs'

const OFFSET_PATH = '.hermes/tg-offset'

function getOffset() {
  if (!existsSync(OFFSET_PATH)) return 0
  return Number(readFileSync(OFFSET_PATH, 'utf8')) || 0
}
function setOffset(n) {
  mkdirSync('.hermes', { recursive: true })
  writeFileSync(OFFSET_PATH, String(n))
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN missing')
    process.exit(1)
  }
  const offset = getOffset()
  let json
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=0`)
    json = await res.json()
  } catch (err) {
    console.error(`getUpdates failed: ${err.message}`)
    process.exit(2) // offset NOT advanced — retried next loop
  }
  if (!json.ok) {
    console.error(`telegram error: ${JSON.stringify(json)}`)
    process.exit(2)
  }
  const { signals, nextOffset } = parseUpdates(json)
  const fresh = []
  for (const s of signals) {
    const fp = fingerprint(s)
    if (isSeen(fp)) continue
    markSeen(fp)
    fresh.push(s)
  }
  if (nextOffset != null) setOffset(nextOffset)
  process.stdout.write(JSON.stringify(fresh, null, 2))
}

main()
```

- [ ] **Step 2: Smoke run (no new messages)**

Run: `set -a; . ./.env; set +a; node ingest/poll.mjs`
Expected: prints `[]` (no fresh messages), exit 0. Creates `.hermes/tg-offset`.

- [ ] **Step 3: Smoke run with a real message**

Send `/task test ingest` to `@brodyone_bot` (DM), then run the same command.
Expected: JSON array with one signal `{chat_id, msg_id, from, text: "test ingest", ts}`. Run again → `[]` (dedup + offset).

- [ ] **Step 4: Commit**

```bash
git add ingest/poll.mjs
git commit -m "feat: telegram poll glue (offset + dedup + emit fresh signals)"
```

---

## Task 5: Connect Plane MCP + smoke

**Files:**
- Modify: `.env` (real Plane creds — NOT committed)
- Create: `integrations/mcp.md` (connection notes)

- [ ] **Step 1: Fill Plane creds in `.env`**

Set `PLANE_BASE_URL`, `PLANE_API_KEY`, `PLANE_WORKSPACE_SLUG` (from Plane → Settings → API tokens). `.env` is gitignored.

- [ ] **Step 2: Add the Plane MCP server (self-host = stdio/HTTP-PAT)**

Run (HTTP/PAT transport for self-host):

```bash
claude mcp add plane --transport http "$PLANE_BASE_URL/mcp" \
  --header "x-api-key: $PLANE_API_KEY" \
  --header "x-workspace-slug: $PLANE_WORKSPACE_SLUG"
```

Expected: server `plane` listed by `claude mcp list`.

- [ ] **Step 3: Smoke — create then close a throwaway issue**

In a Claude Code prompt, ask the Plane MCP to create an issue titled `hermes-smoke-test` in a test project, then close/delete it.
Expected: issue appears in Plane UI, then is closed. Confirms read+write.

- [ ] **Step 4: Record connection in `integrations/mcp.md`**

```markdown
# MCP connections

## Plane (server1, self-host)
- transport: HTTP/PAT
- headers: x-api-key, x-workspace-slug
- add: `claude mcp add plane --transport http "$PLANE_BASE_URL/mcp" --header "x-api-key: $PLANE_API_KEY" --header "x-workspace-slug: $PLANE_WORKSPACE_SLUG"`
- creds: `.env` (gitignored)
```

- [ ] **Step 5: Commit**

```bash
git add integrations/mcp.md
git commit -m "docs: record Plane MCP connection (creds stay in .env)"
```

---

## Task 6: PO agent definition

**Files:**
- Create: `.claude/agents/po-agent.md`

- [ ] **Step 1: Write the PO subagent**

`.claude/agents/po-agent.md`:

```markdown
---
name: po-agent
description: Product Owner — triages one inbound signal into a Plane issue with acceptance criteria, then stops at the human roadmap gate.
allowed_tools: [Read, mcp__plane__*]
---

You are the Product Owner agent. You receive ONE signal:
`{ chat_id, msg_id, from, text, ts }`.

Do exactly this, then return — do NOT loop or fetch more signals:

1. Classify the signal: `bug` | `feature` | `debt` | `question`.
   - If it is small talk / not actionable → return `{ action: "ignore", reason }`. Create nothing.
2. Prioritize: RICE or MoSCoW. Give a one-line justification.
3. Write a Plane issue via the Plane MCP:
   - `name`: concise imperative title.
   - `description`: the ask + context (quote the original `text`).
   - Acceptance criteria as Given/When/Then bullets.
   - state: `triage` (NOT active — the human gate decides roadmap).
   - label with the classification.
4. Return a compact result:
   `{ action: "created", issue_id, type, priority, title }`.

Rules:
- One issue per signal. Never create duplicates (caller already deduped).
- Do not move the issue into a sprint/cycle — that is the PM agent + gate, later.
- If the Plane MCP write fails, return `{ action: "error", reason }` — do NOT swallow it.
```

- [ ] **Step 2: Classification eval (manual)**

Feed these 5 texts to the PO agent one at a time and check the classification:

| Text | Expected |
|------|----------|
| `login button does nothing on Safari` | bug |
| `add CSV export to reports` | feature |
| `refactor the auth module, it's a mess` | debt |
| `how do I reset my password?` | question |
| `gm team great work yesterday` | ignore |

Expected: matches the table; first four create a `triage` Plane issue, last creates nothing.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/po-agent.md
git commit -m "feat: PO triage subagent (signal -> Plane triage issue + AC)"
```

---

## Task 7: Ingest runner command + Gate 1

**Files:**
- Create: `.claude/commands/hermes-ingest.md`

- [ ] **Step 1: Write the runner command**

`.claude/commands/hermes-ingest.md`:

```markdown
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
```

- [ ] **Step 2: Dry run with a seeded message**

Send `/task add dark mode toggle` to `@brodyone_bot`, then run `/hermes-ingest`.
Expected: poll emits 1 signal → PO agent creates 1 Plane `triage` issue → Gate 1 lists it → approve → issue moves to backlog.

- [ ] **Step 3: Wire the loop (manual start)**

Document in the command output that continuous mode is: `/loop 2m /hermes-ingest`.
(Do not auto-start; the user starts the loop when they want Hermes live.)

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/hermes-ingest.md
git commit -m "feat: hermes-ingest runner (poll -> PO triage -> Gate 1)"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Full run from a group**

Add `@brodyone_bot` to a test group. Send `@brodyone_bot the export page crashes on empty data`.
Run `/hermes-ingest`.
Expected: 1 signal (privacy mode delivers the mention), classified `bug`, Plane triage issue with Given/When/Then AC, Gate 1 → approve → backlog.

- [ ] **Step 2: Dedup / idempotency check**

Run `/hermes-ingest` again with no new messages.
Expected: "no new signals" — no duplicate issue (offset advanced + fingerprint seen).

- [ ] **Step 3: Negative check**

Send plain group chatter (no mention). Run `/hermes-ingest`.
Expected: privacy mode means Telegram never delivers it → 0 signals.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all unit tests pass (dedup 3 + telegram 9 = 12).

- [ ] **Step 5: Final commit + board update**

```bash
git add -A
git commit -m "test: PO slice end-to-end verified (Telegram -> Plane triage -> gate)"
```

Move the PO-slice task to `.todos/done.md`.

---

## Self-Review notes

- **Spec coverage:** ingest/filter/dedup (Tasks 3-4), PO agent + AC (Task 6), real Plane MCP (Task 5), Gate 1 (Task 7), error handling — offset-after-success + escalate (Task 4 poll.mjs, Task 7 step), tests 1-4 from spec §8 (Tasks 2-3), eval §8.5 (Task 6 step 2), e2e §8.6 (Task 8). Covered.
- **Privacy-mode** enforcement verified in Task 8 step 3 (negative check).
- **Open dependency:** Tasks 5/7/8 require Plane creds in `.env`. Tasks 1-4 + 6 run without Plane.
- **Type consistency:** Signal shape `{chat_id, msg_id, from, text, ts}` identical across telegram.mjs, dedup fingerprint input, poll.mjs, po-agent input.
