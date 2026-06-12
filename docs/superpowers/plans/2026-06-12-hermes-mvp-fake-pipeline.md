# Hermes MVP Pipeline (fake mode) Implementation Plan

> **For agentic workers:** Use subagent-driven-development. TDD. Checkbox steps.

**Goal:** Full ADLC pipeline (Telegram → Plane → PO → PM → Dev → QA → DevOps) runnable end-to-end **offline with no prod keys**, via a fake adapter layer. Real MCP swaps in later behind the same interface.

**Architecture:** An **adapter seam** decouples agents from external systems. `adapters/` define interfaces with in-memory `fake` impls (persisted to `.hermes/fake/*.json`); a factory selects `fake` vs `real` via `HERMES_MODE`. A deterministic `pipeline/` state machine drives an item through stages using injected adapters. Role agents (`.claude/agents/*.md`) make the judgment calls; the orchestrator command wires signal → stages → human gates.

**Tech:** Node ≥18 ESM, `node:test`, zero deps. Existing `ingest/` (Telegram) feeds signals in.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `adapters/plane.mjs` | Issue store interface + fake (create/get/update/list issues, states) |
| `adapters/repo.mjs` | Repo/MR interface + fake (branch, MR open/merge) |
| `adapters/ci.mjs` | CI interface + fake (run pipeline → pass/fail verdict) |
| `adapters/notify.mjs` | Notify interface + fake (append to log) |
| `adapters/index.mjs` | factory: `getAdapters(mode)` → `{plane, repo, ci, notify}` |
| `adapters/*.test.mjs` | unit tests per adapter |
| `pipeline/stages.mjs` | stage constants + legal transitions |
| `pipeline/pipeline.mjs` | `advance(item, adapters, agentFns)` state machine |
| `pipeline/pipeline.test.mjs` | state machine tests (fake adapters) |
| `.claude/agents/{pm,dev,qa,devops,design,marketing}-agent.md` | role subagents |
| `.claude/commands/hermes-run.md` | orchestrator: signal → stages → gates |
| `.hermes/fake/` | gitignored fake state |

---

## Task 1: Adapter layer (TDD)

**Files:** Create `adapters/plane.mjs`, `adapters/repo.mjs`, `adapters/ci.mjs`, `adapters/notify.mjs`, `adapters/index.mjs` + `*.test.mjs`.

Each fake persists to a JSON file under `.hermes/fake/` (path injectable for tests). Use a tiny shared store helper.

- [ ] **Step 1: Write `adapters/plane.test.mjs` (failing)**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakePlane } from './plane.mjs'

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'plane-'))
  return { plane: new FakePlane(join(dir, 'plane.json')), dir }
}

test('createIssue assigns id + defaults state triage', () => {
  const { plane, dir } = fresh()
  try {
    const i = plane.createIssue({ title: 'Fix bug', type: 'bug', priority: 'high' })
    assert.ok(i.id)
    assert.equal(i.state, 'triage')
    assert.equal(i.title, 'Fix bug')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('updateIssue persists across reload', () => {
  const { plane, dir } = fresh()
  const path = join(dir, 'plane.json')
  try {
    const i = plane.createIssue({ title: 'X' })
    plane.updateIssue(i.id, { state: 'backlog' })
    const reloaded = new FakePlane(path)
    assert.equal(reloaded.getIssue(i.id).state, 'backlog')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('listIssues filters by state', () => {
  const { plane, dir } = fresh()
  try {
    plane.createIssue({ title: 'A' })
    const b = plane.createIssue({ title: 'B' })
    plane.updateIssue(b.id, { state: 'backlog' })
    assert.equal(plane.listIssues({ state: 'triage' }).length, 1)
    assert.equal(plane.listIssues({ state: 'backlog' }).length, 1)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run, verify fail** — `node --test adapters/plane.test.mjs` → FAIL (no module).

- [ ] **Step 3: Implement `adapters/plane.mjs`**

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

function load(path) {
  if (!existsSync(path)) return { seq: 0, issues: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { seq: 0, issues: {} } }
}
function save(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, path)
}

export class FakePlane {
  constructor(path = '.hermes/fake/plane.json') { this.path = path }
  _db() { return load(this.path) }
  createIssue({ title, description = '', type = 'feature', priority = 'medium', state = 'triage', acceptance = [] }) {
    const db = this._db()
    const id = `ISS-${++db.seq}`
    db.issues[id] = { id, title, description, type, priority, state, acceptance, sub: [], ts: new Date().toISOString() }
    save(this.path, db)
    return db.issues[id]
  }
  getIssue(id) { return this._db().issues[id] || null }
  updateIssue(id, patch) {
    const db = this._db()
    if (!db.issues[id]) throw new Error(`no issue ${id}`)
    db.issues[id] = { ...db.issues[id], ...patch }
    save(this.path, db)
    return db.issues[id]
  }
  listIssues(filter = {}) {
    return Object.values(this._db().issues).filter(i =>
      Object.entries(filter).every(([k, v]) => i[k] === v))
  }
}
```

- [ ] **Step 4: Run, verify pass** — 3 tests pass.

- [ ] **Step 5: Write `adapters/repo.test.mjs` (failing)**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeRepo } from './repo.mjs'

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'))
  return { repo: new FakeRepo(join(dir, 'repo.json')), dir }
}

test('openMR returns open MR tied to issue', () => {
  const { repo, dir } = fresh()
  try {
    const mr = repo.openMR({ title: 'feat: x', branch: 'feature/x', issueId: 'ISS-1' })
    assert.ok(mr.id)
    assert.equal(mr.state, 'open')
    assert.equal(mr.issueId, 'ISS-1')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('mergeMR flips state to merged', () => {
  const { repo, dir } = fresh()
  try {
    const mr = repo.openMR({ title: 't', branch: 'b', issueId: 'ISS-1' })
    repo.mergeMR(mr.id)
    assert.equal(repo.getMR(mr.id).state, 'merged')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 6: Run fail, then implement `adapters/repo.mjs`**

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'

function load(path) {
  if (!existsSync(path)) return { seq: 0, mrs: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { seq: 0, mrs: {} } }
}
function save(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`; writeFileSync(tmp, JSON.stringify(data, null, 2)); renameSync(tmp, path)
}

export class FakeRepo {
  constructor(path = '.hermes/fake/repo.json') { this.path = path }
  _db() { return load(this.path) }
  openMR({ title, branch, issueId }) {
    const db = this._db()
    const id = `MR-${++db.seq}`
    db.mrs[id] = { id, title, branch, issueId, state: 'open', ts: new Date().toISOString() }
    save(this.path, db); return db.mrs[id]
  }
  getMR(id) { return this._db().mrs[id] || null }
  mergeMR(id) {
    const db = this._db()
    if (!db.mrs[id]) throw new Error(`no MR ${id}`)
    db.mrs[id].state = 'merged'; save(this.path, db); return db.mrs[id]
  }
}
```

- [ ] **Step 7: Run pass. Write `adapters/ci.test.mjs` (failing)**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FakeCI } from './ci.mjs'

test('runPipeline passes by default', () => {
  const ci = new FakeCI()
  const r = ci.runPipeline({ title: 'feat: add x' })
  assert.equal(r.status, 'pass')
})
test('runPipeline fails when title flags fail', () => {
  const ci = new FakeCI()
  const r = ci.runPipeline({ title: 'broken [ci-fail]' })
  assert.equal(r.status, 'fail')
  assert.ok(r.report)
})
```

- [ ] **Step 8: Run fail, implement `adapters/ci.mjs`**

```js
// Deterministic fake CI: fails only when the MR title contains [ci-fail],
// so tests and demos can exercise both the pass and fail gate paths.
export class FakeCI {
  runPipeline(mr) {
    const fail = /\[ci-fail\]/i.test(mr.title || '')
    return fail
      ? { status: 'fail', report: 'fake CI: 1 test failed' }
      : { status: 'pass', report: 'fake CI: all green' }
  }
}
```

- [ ] **Step 9: Run pass. Implement `adapters/notify.mjs` (no separate test — trivial log)**

```js
import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

export class FakeNotify {
  constructor(path = '.hermes/fake/notify.log') { this.path = path }
  send(to, text) {
    const dir = dirname(this.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    appendFileSync(this.path, `${new Date().toISOString()} → ${to}: ${text}\n`)
    return true
  }
}
```

- [ ] **Step 10: Implement `adapters/index.mjs` factory**

```js
import { FakePlane } from './plane.mjs'
import { FakeRepo } from './repo.mjs'
import { FakeCI } from './ci.mjs'
import { FakeNotify } from './notify.mjs'

// Real impls (MCP-backed) land here later behind the same interface.
export function getAdapters(mode = process.env.HERMES_MODE || 'fake') {
  if (mode === 'fake') {
    return { mode, plane: new FakePlane(), repo: new FakeRepo(), ci: new FakeCI(), notify: new FakeNotify() }
  }
  throw new Error(`HERMES_MODE=${mode} not wired yet (only 'fake' available without prod keys)`)
}
```

- [ ] **Step 11: Run full suite + commit**

Run: `npm test` (all adapter + ingest tests pass).
```bash
git add adapters/
git commit -m "feat: fake adapter layer (plane/repo/ci/notify) + factory seam"
```

---

## Task 2: Pipeline state machine (TDD)

**Files:** Create `pipeline/stages.mjs`, `pipeline/pipeline.mjs`, `pipeline/pipeline.test.mjs`.

Stages: `triage → planned → in_dev → in_qa → ready_to_merge → merged → staged`. The state machine `advance` performs ONE transition using adapters + injected agent functions (so agents are mocked in tests).

- [ ] **Step 1: Write `pipeline/pipeline.test.mjs` (failing)**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakePlane } from '../adapters/plane.mjs'
import { FakeRepo } from '../adapters/repo.mjs'
import { FakeCI } from '../adapters/ci.mjs'
import { FakeNotify } from '../adapters/notify.mjs'
import { advance } from './pipeline.mjs'

function ctx() {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-'))
  const ad = { plane: new FakePlane(join(dir, 'p.json')), repo: new FakeRepo(join(dir, 'r.json')), ci: new FakeCI(), notify: new FakeNotify(join(dir, 'n.log')) }
  // agent stubs: deterministic
  const agents = {
    pm: async (issue) => [{ title: `${issue.title} - part 1` }],
    dev: async (sub) => ({ branch: 'feature/x', title: `feat: ${sub.title}` }),
  }
  return { ad, agents, dir }
}

test('planned: PM creates sub-issues, issue → planned', async () => {
  const { ad, agents, dir } = ctx()
  try {
    const issue = ad.plane.createIssue({ title: 'Build login', state: 'backlog' })
    const out = await advance(issue, ad, agents)
    const updated = ad.plane.getIssue(issue.id)
    assert.equal(updated.state, 'planned')
    assert.equal(updated.sub.length, 1)
    assert.equal(out.stage, 'planned')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('in_dev: dev opens MR, issue → in_qa after CI pass', async () => {
  const { ad, agents, dir } = ctx()
  try {
    const issue = ad.plane.createIssue({ title: 'Build login', state: 'planned' })
    ad.plane.updateIssue(issue.id, { sub: [{ title: 'part 1' }] })
    const out = await advance(ad.plane.getIssue(issue.id), ad, agents)
    assert.equal(out.stage, 'in_qa')
    assert.ok(out.mrId)
    assert.equal(out.ci.status, 'pass')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('in_qa CI fail → escalated, stays in_dev', async () => {
  const { ad, agents, dir } = ctx()
  const failAgents = { ...agents, dev: async () => ({ branch: 'b', title: 'broken [ci-fail]' }) }
  try {
    const issue = ad.plane.createIssue({ title: 'X', state: 'planned', sub: [{ title: 'p' }] })
    const out = await advance(ad.plane.getIssue(issue.id), ad, failAgents)
    assert.equal(out.stage, 'in_dev')
    assert.equal(out.escalated, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run fail. Implement `pipeline/stages.mjs`**

```js
export const STAGES = ['triage', 'backlog', 'planned', 'in_dev', 'in_qa', 'ready_to_merge', 'merged', 'staged']
export const NEXT = {
  backlog: 'planned',
  planned: 'in_dev',
  in_dev: 'in_qa',
  in_qa: 'ready_to_merge',
  ready_to_merge: 'merged',
  merged: 'staged',
}
```

- [ ] **Step 3: Implement `pipeline/pipeline.mjs`**

```js
// One transition of an issue through the ADLC, using adapters + agent fns.
// Pure orchestration: all side effects go through adapters; agents are injected.
export async function advance(issue, adapters, agents) {
  const { plane, repo, ci, notify } = adapters
  switch (issue.state) {
    case 'backlog': {
      const sub = await agents.pm(issue)
      plane.updateIssue(issue.id, { sub, state: 'planned' })
      return { stage: 'planned', sub }
    }
    case 'planned': {
      const sub = issue.sub?.[0] || { title: issue.title }
      const { branch, title } = await agents.dev(sub)
      const mr = repo.openMR({ title, branch, issueId: issue.id })
      const result = ci.runPipeline(mr)
      if (result.status === 'pass') {
        plane.updateIssue(issue.id, { state: 'in_qa', mrId: mr.id })
        return { stage: 'in_qa', mrId: mr.id, ci: result }
      }
      notify.send('human', `CI failed for ${issue.id} (${mr.id}): ${result.report}`)
      plane.updateIssue(issue.id, { state: 'in_dev', mrId: mr.id })
      return { stage: 'in_dev', mrId: mr.id, ci: result, escalated: true }
    }
    default:
      return { stage: issue.state, noop: true }
  }
}
```

NOTE: the test seeds `state: 'planned'` for the dev case and `state: 'backlog'` for the PM case; the second test's issue has `state: 'planned'` so it hits the dev branch — and the third (fail) also `planned`. The first test uses `state: 'backlog'`. Confirm the switch matches.

- [ ] **Step 4: Run pass (3 tests). Commit**

```bash
git add pipeline/
git commit -m "feat: ADLC pipeline state machine (backlog->planned->in_dev->in_qa, CI gate)"
```

---

## Task 3: Role agent definitions

**Files:** Create `.claude/agents/{pm,dev,qa,devops,design,marketing}-agent.md`. (po-agent.md already exists.) Each is a focused subagent with `allowed_tools` and a clear Definition of Done. They return structured results the orchestrator consumes.

- [ ] **Step 1: Create all six agent files** (full content):

`.claude/agents/pm-agent.md`:
```markdown
---
name: pm-agent
description: Project Manager — breaks one backlog issue into ordered sub-tasks with dependencies.
allowed_tools: [Read, mcp__plane__*]
---
You receive one Plane issue (backlog). Produce an ordered list of sub-tasks:
each `{ title, estimate, dependsOn? }`. Keep them small and independently shippable.
Return `{ sub: [...] }`. Do not start coding. Stop after breakdown — the plan gate is the human's.
```

`.claude/agents/dev-agent.md`:
```markdown
---
name: dev-agent
description: Developer — implements one sub-task test-first and opens a merge request.
allowed_tools: [Read, Write, Edit, Bash, mcp__gitlab__*]
---
You receive one sub-task. Work test-first (red→green→refactor). Then open an MR:
`{ branch, title, summary }`. Title MUST follow conventional commits. Do NOT merge —
merge is a human gate. If you cannot complete it, return `{ blocked: reason }`.
```

`.claude/agents/qa-agent.md`:
```markdown
---
name: qa-agent
description: QA — runs the CI pipeline for an MR and reviews the diff, returns a verdict.
allowed_tools: [Read, Bash, mcp__gitlab__*]
---
You receive one MR. Run its CI + review the diff. Return
`{ verdict: "pass"|"fail", findings: [...] }`. On fail, be specific so Dev can fix.
Pass is automatic; fail escalates to the human.
```

`.claude/agents/devops-agent.md`:
```markdown
---
name: devops-agent
description: DevOps — deploys a merged issue to staging and smoke-tests it.
allowed_tools: [Read, Bash, mcp__gitlab__*]
---
You receive a merged issue. Deploy to staging, run a smoke test, return
`{ staged: true, url }` or `{ staged: false, reason }`. PROD deploy is a separate human gate — never deploy prod yourself.
```

`.claude/agents/design-agent.md`:
```markdown
---
name: design-agent
description: Design — produces a UI prototype + spec for an issue that needs UI.
allowed_tools: [Read, mcp__pencil__*]
---
You receive one issue needing UI. Produce a prototype + a short spec
`{ prototypeRef, notes }`. Stop at the design gate — the human approves before dev.
```

`.claude/agents/marketing-agent.md`:
```markdown
---
name: marketing-agent
description: Marketing — drafts release notes + launch copy for a shipped issue.
allowed_tools: [Read, mcp__docmost__*]
---
You receive a shipped issue. Draft `{ releaseNotes, launchPost }`. Stop at the publish gate.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/
git commit -m "feat: role agent definitions (pm/dev/qa/devops/design/marketing)"
```

---

## Task 4: Orchestrator command + fake e2e

**Files:** Create `.claude/commands/hermes-run.md`, `pipeline/run.mjs` (drives advance() in a loop over an item until it needs a gate), `pipeline/run.test.mjs`.

- [ ] **Step 1: Write `pipeline/run.test.mjs` (failing)** — drives a backlog issue through to in_qa with stub agents:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakePlane } from '../adapters/plane.mjs'
import { FakeRepo } from '../adapters/repo.mjs'
import { FakeCI } from '../adapters/ci.mjs'
import { FakeNotify } from '../adapters/notify.mjs'
import { runToGate } from './run.mjs'

test('runToGate drives backlog issue to in_qa (auto stages)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-'))
  const ad = { plane: new FakePlane(join(dir, 'p.json')), repo: new FakeRepo(join(dir, 'r.json')), ci: new FakeCI(), notify: new FakeNotify(join(dir, 'n.log')) }
  const agents = { pm: async (i) => [{ title: `${i.title} - 1` }], dev: async (s) => ({ branch: 'b', title: `feat: ${s.title}` }) }
  try {
    const issue = ad.plane.createIssue({ title: 'Build X', state: 'backlog' })
    const final = await runToGate(issue.id, ad, agents)
    assert.equal(final.state, 'in_qa')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
```

- [ ] **Step 2: Run fail. Implement `pipeline/run.mjs`**

```js
import { advance } from './pipeline.mjs'

// Drive an issue through automatic stages until it reaches a state that needs
// a human gate (in_qa = merge gate, staged = done) or stops progressing.
const GATE_STATES = new Set(['in_qa', 'ready_to_merge', 'staged', 'in_dev'])

export async function runToGate(issueId, adapters, agents, maxSteps = 10) {
  for (let i = 0; i < maxSteps; i++) {
    const issue = adapters.plane.getIssue(issueId)
    if (!issue) throw new Error(`no issue ${issueId}`)
    if (GATE_STATES.has(issue.state)) return issue
    const before = issue.state
    await advance(issue, adapters, agents)
    const after = adapters.plane.getIssue(issueId).state
    if (after === before) return adapters.plane.getIssue(issueId) // no progress
  }
  return adapters.plane.getIssue(issueId)
}
```

- [ ] **Step 3: Run pass. Write `.claude/commands/hermes-run.md`**

```markdown
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
```

Wire `pipeline/run.mjs` to read `HERMES_MODE` adapters + a simple agent shim when run from CLI (agents that call the subagents are driven by the command, not the script; the script's CLI entry uses deterministic stub agents for a smoke demo).

- [ ] **Step 4: Add CLI entry to `pipeline/run.mjs`** (demo with stub agents):

```js
// CLI demo: HERMES_MODE=fake node pipeline/run.mjs <issueId>
if (import.meta.url === `file://${process.argv[1]}`) {
  const { getAdapters } = await import('../adapters/index.mjs')
  const ad = getAdapters()
  const agents = {
    pm: async (i) => [{ title: `${i.title} - 1` }],
    dev: async (s) => ({ branch: `feature/${s.title}`.replace(/\s+/g, '-'), title: `feat: ${s.title}` }),
  }
  const id = process.argv[2]
  const out = await runToGate(id, ad, agents)
  process.stdout.write(JSON.stringify(out, null, 2))
}
```

- [ ] **Step 5: Smoke run**

```bash
node -e "import('./adapters/index.mjs').then(async m => { const a=m.getAdapters(); const i=a.plane.createIssue({title:'Demo feature', state:'backlog'}); console.log(i.id) })"
# take the printed ISS-id, then:
HERMES_MODE=fake node pipeline/run.mjs ISS-1
```
Expected: JSON issue ending at `state: in_qa` with an `mrId`.

- [ ] **Step 6: Commit**

```bash
git add pipeline/run.mjs pipeline/run.test.mjs .claude/commands/hermes-run.md
git commit -m "feat: pipeline runner + hermes-run orchestrator (fake e2e to merge gate)"
```

---

## Task 5: Docs + final verification

- [ ] **Step 1: Update README status table** — mark adapters/pipeline/agents built; note fake mode.
- [ ] **Step 2: Full suite** — `npm test` (all green).
- [ ] **Step 3: Commit + board**

```bash
git add -A
git commit -m "docs: README reflects full MVP pipeline (fake mode)"
```
Move MVP pipeline task to `.todos/done.md`.

---

## Self-Review notes
- **No prod keys:** every external touch goes through `adapters/` fakes; `index.mjs` throws on `real` until MCP wired. Honest seam.
- **Coverage:** PO (existing) → PM (Task 3 pm-agent + pipeline planned) → Dev (dev-agent + in_dev) → QA (fake CI gate) → DevOps (devops-agent + staged). Phases 0-4 runnable; 5-7 have agent defs.
- **Type consistency:** issue shape `{id,title,description,type,priority,state,acceptance,sub,mrId,ts}`; MR shape `{id,title,branch,issueId,state}` — identical across adapters, pipeline, tests.
- **Tests:** adapters (plane 3, repo 2, ci 2), pipeline (3), run (1) + existing ingest (15) → ~26 total.
