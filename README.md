<div align="center">

# 🪽 Hermes ADLC

### AI-Agent SDLC Orchestration — *80% machine, 20% you*

An orchestrator where AI agents run the whole software lifecycle — triage, plan,
build, test, ship — and you only step in at the decision gates.

[![status](https://img.shields.io/badge/status-MVP%20in%20progress-yellow)](#-status)
[![tests](https://img.shields.io/badge/tests-15%20passing-brightgreen)](#-quickstart)
[![stack](https://img.shields.io/badge/stack-self--hosted-blue)](#-self-host-stack)
[![node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](#-quickstart)

</div>

---

## 💡 What is this?

**Hermes** is the lead orchestrator agent. It receives a signal (a Telegram
message, an email, a manual note), routes it to the right **role agent**
(Product Owner, Project Manager, Dev crew, QA, DevOps…), and shepherds the work
through the full SDLC. Every external system is **self-hosted** and reached
through MCP.

> **The 80/20 idea:** AI does 80% of the work. You spend your 20% only at four
> human gates — *roadmap · design · merge · prod deploy*. As the product matures,
> those gates batch into a once-a-day review.

```
   Telegram ─┐
   Email ────┼──►  HERMES  ──►  PO ──► PM ──► DEV crew ──► QA ──► DEVOPS
   Manual ───┘   (router /        triage  plan   build      test    deploy
                  gatekeeper)        │       │      │          │        │
                                     └───────┴──────┴──── SHARED STATE ──┘
                                          Plane · Docmost · GitLab
                                                    │
                                              loop ◄┘  (SDLC repeats)
```

**Single source of truth:** every agent reads from and writes to **Plane**.
Hermes only routes and runs the gates.

---

## 🤖 Agent roster

| Agent | Role | Output | Human gate |
|-------|------|--------|:---:|
| **Hermes** | Orchestrator / router | dispatch to role agent | — |
| **PO** | Triage, priority, acceptance criteria | Plane issue + AC | 🟢 roadmap |
| **PM** | Breakdown, plan, sprint | sub-issues + plan | 🟢 plan |
| **Dev crew** | Backend · Frontend · Mobile (parallel TDD) | Merge Request | 🔴 merge |
| **Design** | UI/UX prototype | Figma/Pencil + spec | 🟢 design |
| **QA** | Test + review | verdict | 🟡 auto, fail→you |
| **DevOps** | CI/CD, deploy | release | 🔴 prod |
| **Marketing** | Copy, launch, GTM | landing, posts | 🟢 publish |

🔴 always human · 🟡 conditional · 🟢 batch-approved

---

## 🔭 Pipeline & gates

```
[0] SIGNAL      Telegram / Email / manual         → Hermes ingest      (AI 100%)
[1] PO TRIAGE   classify · prioritize · dedup      → Plane issue + AC
    🟢 GATE 1   admit to roadmap? (batch, daily)
[2] PM PLAN     issue → sub-issues, cycle
    🟢 GATE 2   plan ok? (big epics only)
[3] DESIGN      Pencil/Figma prototype (if UI)
    🟢 GATE 3   design ok?
[4] DEV CREW    parallel test-first code           → Merge Request      (AI 100%)
[5] QA          run tests (GitLab CI) + review
    🟡 GATE 4   PASS → auto · FAIL → escalate
[6] CODE REVIEW AI reviewer + diff
    🔴 GATE 5   merge approval ← the key gate
[7] DEVOPS      staging auto → smoke → prod
    🔴 GATE 6   prod deploy approval
[8] MARKETING   release notes, launch
    🟢 GATE 7   publish
[9] LOOP        retro → new issue → back to [1]
```

---

## 🚦 Status

The full MVP pipeline runs **end-to-end offline** in fake mode — no prod keys.
External systems sit behind an adapter seam (`fake` now, real MCP later).

| Component | State |
|-----------|:---:|
| `ingest/*` — Telegram filter · parse · dedup · poll | ✅ TDD, **live-verified** |
| `adapters/*` — plane · repo · ci · notify + factory seam | ✅ TDD |
| `pipeline/*` — ADLC state machine + runner | ✅ TDD, **fake e2e** |
| `.claude/agents/*` — po · pm · dev · qa · devops · design · marketing | ✅ |
| `.claude/commands/hermes-{ingest,run}.md` — orchestrators + gates | ✅ |
| Real MCP wiring (`HERMES_MODE=real`) | ⏸ awaiting prod creds |

> ✅ `HERMES_MODE=fake node pipeline/run.mjs <issueId>` drives a backlog issue
> through plan → dev → CI → merge-gate against in-memory fakes. **26 tests green.**
> Swapping in real Plane/GitLab is a single adapter impl behind the same interface.

---

## ⚡ Quickstart

```bash
# 1. clone
git clone https://github.com/ExcuseMeBro/aibus.git && cd aibus

# 2. secrets (gitignored — never committed)
cp .env.example .env
#   fill: TELEGRAM_BOT_TOKEN, PLANE_BASE_URL, PLANE_API_KEY, PLANE_WORKSPACE_SLUG

# 3. tests (zero dependencies — pure Node)
npm test                       # 15 passing

# 4. one ingest tick (poll Telegram → fresh signals as JSON)
set -a; . ./.env; set +a; node ingest/poll.mjs

# 5. live Hermes (inside Claude Code)
/loop 2m /hermes-ingest        # poll → PO triage → Gate 1, every 2 min
```

**Connect Plane MCP** (self-host):

```bash
claude mcp add plane --transport http "$PLANE_BASE_URL/mcp" \
  --header "x-api-key: $PLANE_API_KEY" \
  --header "x-workspace-slug: $PLANE_WORKSPACE_SLUG"
```

---

## 🧱 Self-host stack

Everything runs on your own servers. No SaaS lock-in.

| System | Replaces | MCP | Server |
|--------|----------|:---:|:---:|
| **Plane** | Jira | ✅ official | server1 |
| **Docmost** | Confluence | ✅ official | server1 |
| **GitLab CE** | GitHub | ✅ official | server2 |
| **Mailcow** | Gmail | ✅ community | server3 |

Compose stacks, Caddy + Let's Encrypt, DNS records, and a backup script live in
[`selfhost/`](selfhost/README.md).

---

## 📁 Repo layout

```
aibus/
├── README.md                 ← you are here
├── ARCHITECTURE.md           full system design + decisions
├── ingest/                   Telegram → signal (pure, tested Node modules)
│   ├── telegram.mjs          filter + parse + offset
│   ├── dedup.mjs             atomic fingerprint seen-set
│   └── poll.mjs              IO glue
├── adapters/                 external-system seam (fake now, real MCP later)
│   ├── plane.mjs repo.mjs ci.mjs notify.mjs
│   └── index.mjs             getAdapters(HERMES_MODE)
├── pipeline/                 ADLC state machine
│   ├── stages.mjs pipeline.mjs run.mjs
├── .claude/
│   ├── agents/*.md           po · pm · dev · qa · devops · design · marketing
│   └── commands/             hermes-ingest.md · hermes-run.md
├── selfhost/                 3-server infra (Plane/Docmost/GitLab/Mailcow)
├── docs/superpowers/
│   ├── specs/                design docs
│   └── plans/                implementation plans
└── .todos/                   task board (todo / inprogress / done)
```

---

## 🛠️ Tech

`Node ≥18 (ESM)` · `node:test` · zero runtime deps · Claude Code subagents +
slash commands · Plane / Docmost / GitLab / Mailcow MCP · Telegram Bot API

**Conventions:** all timestamps UTC ISO-8601 · secrets only in `.env` (gitignored)
· TDD red→green · frequent commits.

---

## 🗺️ Roadmap

- [x] **−1 · Infra** — 3-server self-host stack + Caddy + backup
- [x] **PO slice (ingest)** — Telegram → signal, live-verified
- [x] **Fake pipeline** — adapters + state machine + agents + orchestrator, e2e offline
- [~] **1–4 · PO→PM→Dev→QA→DevOps** — scaffolded & runnable in fake mode
- [ ] **0 · Setup** — swap fake adapters for real Plane/Docmost/GitLab/Mailcow MCP
- [ ] **6 · Hermes** — observability + escalation hardening
- [ ] **7 · Design + Marketing** — wire Pencil + launch agents

**MVP = phases 0–4** (Telegram → Plane → PO → PM → Dev → MR → QA) —
*logic complete in fake mode; phase 0 swaps in real backends.*

---

<div align="center">

📖 [Architecture](ARCHITECTURE.md) · 🏗️ [Self-host](selfhost/README.md) · 📋 [Specs](docs/superpowers/specs/) · 🗂️ [Plans](docs/superpowers/plans/)

</div>
