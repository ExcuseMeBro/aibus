# Hermes ADLC — AI Agent SDLC Orchestration Architecture

> **Maqsad:** Whiteboard'dagi SDLC pipeline'ni AI agentlar bilan avtomatlashtirish.
> **80/20 modeli:** 80% ishni AI agentlar qiladi, 20% — siz (faqat gate/qaror nuqtalarida).
> **Hermes** = bosh orchestrator agent. Qolganlari = role sub-agentlar.
> **Infra:** to'liq self-hosted (Plane / Docmost / GitLab / Mailcow) — `selfhost/` ga qarang.

---

## 1. Yuqori darajadagi ko'rinish

```
                          ┌─────────────────────────────────────┐
   Email ──┐              │            HERMES                    │
   Slack ──┼──► Ingest ──►│  (Orchestrator / Router / Gatekeeper)│
   Manual ─┘              └──────────────┬──────────────────────┘
                                         │ vazifani role agentga marshrutlaydi
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼              ▼                  ▼              ▼                  ▼
     ┌─────┐       ┌─────┐            ┌──────┐       ┌────┐            ┌────────┐
     │ PO  │──────►│ PM  │───────────►│ DEV  │──────►│ QA │───────────►│ DEVOPS │
     └─────┘       └─────┘            │ crew │       └────┘            └────────┘
   triage,       roadmap,         back/front/        test,            CI/CD,
   prioritet     plan, breakdown   mobile/design     review           release
        │              │            + marketing         │                  │
        └──────────────┴────────────────┬───────────────┴──────────────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  SHARED STATE        │
                              │  Plane = manba       │
                              │  Docmost = docs      │
                              │  GitLab = kod        │
                              └─────────────────────┘
                                         │
                                   loop ◄─┘  (SDLC qaytadi)
```

**Asosiy g'oya:** Plane = yagona haqiqat manbai (single source of truth). Har bir agent Plane'dan o'qiydi, ishlaydi, Plane'ga yozadi. Hermes faqat marshrutlash + gate'larni boshqaradi.

---

## 2. Agent rosteri

Har bir agent = alohida system prompt + cheklangan tool to'plami + aniq "Definition of Done" + gate. Bu Claude Code'da **subagent** (Task tool) yoki **Claude Agent SDK** orqali quriladi.

| Agent | Rol | Kirish | Chiqish | Tool'lar | Gate (human?) |
|-------|-----|--------|---------|----------|---------------|
| **Hermes** | Orchestrator | har qanday signal | role agentga marshrut | barcha MCP | — |
| **PO** (Product Owner) | Triage, prioritet, acceptance criteria | raw muammo/feature | Plane Cycle/Issue + AC | Plane, Docmost, Mailcow | 🟢 Roadmapga qo'shishdan oldin |
| **PM** (Project Manager) | Breakdown, reja, sprint | Epic/Module | Plane sub-issue + reja | Plane, Docmost | 🟢 Reja tasdiqlash |
| **Backend** | Server kod | task | MR (merge request) | GitLab, IDE, CI | 🔴 MR merge |
| **Frontend** | Web UI | task + design | MR | GitLab, Pencil/Figma | 🔴 MR merge |
| **Mobile** | iOS/Android | task + design | MR | GitLab | 🔴 MR merge |
| **Design** | UI/UX, prototip | task | Figma/Pencil + spec | Pencil MCP | 🟢 Design tasdiqlash |
| **Marketing** | Copy, launch, GTM | release | landing, post, email | Web, Docmost, Mailcow | 🟢 Publish |
| **QA** | Test, review | MR | test natija + verdict | GitLab, CI, browser | 🟡 avtomatik, fail→human |
| **DevOps** | CI/CD, deploy | merged kod | release | GitLab CI API, Git | 🔴 Prod deploy |

🔴 = doim human gate · 🟡 = shartli (fail bo'lsa) · 🟢 = batch tasdiqlash (siz ko'rib o'tasiz)

> **Eslatma — terminologiya mosligi:** Jira→Plane (Issue/Cycle/Module), Confluence→Docmost (page/space), GitHub→GitLab (MR=Merge Request, PR emas), Gmail→Mailcow (IMAP/SMTP). Hujjat davomida self-host nomlari ishlatiladi.

---

## 3. Pipeline oqimi + 80/20 gate'lar

Whiteboard oqimi: `Futures → Plane → PO → PM → Dev → QA → DevOps → PM → PO → Release → loop`.

```
[0] SIGNAL           Email (Mailcow) / Slack / manual  → Hermes ingest
                     │  (AI: 100%) — ingest mexanizmi: §4.1
[1] PO TRIAGE        muammo? feature? bug? prioritet?
                     AI Plane Issue + acceptance criteria yozadi
                     dedup: fingerprint tekshiruvi (§4.2)
     🟢 GATE 1 ──────  SIZ: roadmapga kiritamizmi? (batch, kuniga 1x)
                     │
[2] PM PLAN          Issue → sub-issue, bog'liqliklar, cycle
     🟢 GATE 2 ──────  SIZ: reja to'g'rimi? (faqat katta epic uchun)
                     │
[3] DESIGN           (UI kerak bo'lsa) Pencil/Figma prototip
     🟢 GATE 3 ──────  SIZ: dizayn ma'qulmi?
                     │
[4] DEV CREW         Backend/Frontend/Mobile parallel TDD
                     AI: test-first kod yozadi → MR ochadi
                     │  (AI: 100%)
[5] QA               AI testlarni ishga tushiradi (GitLab CI), kod review
     🟡 GATE 4 ──────  test PASS → avtomatik o'tadi
                       test FAIL → SIZGA eskalatsiya
                     │
[6] CODE REVIEW      AI reviewer (cavecrew/code-review) + diff
     🔴 GATE 5 ──────  SIZ: MR merge tasdiqlash (eng muhim gate)
                     │
[7] DEVOPS DEPLOY    staging avtomatik → smoke test → prod (gate bilan)
     🔴 GATE 6 ──────  SIZ: PROD deploy tasdiqlash (rollback rejasi: §7.1)
                     │
[8] MARKETING        release notes, landing, launch posts
     🟢 GATE 7 ──────  SIZ: publish
                     │
[9] LOOP             PM/PO retro → yangi Issue → [1]ga qaytadi
```

**80/20 hisob:** 9 bosqichdan 5 tasi to'liq AI (signal, plan-detail, dev, qa-run, staging). Siz faqat 4 qaror nuqtasida: roadmap, design, merge, prod. Mahsulot pishganda 🟢 gate'lar batch (kuniga bir marta hammasini ko'rib chiqasiz) — shunda real 20% vaqtingiz ketadi.

---

## 4. Integratsiya qatlami (MCP serverlar)

Har bir tashqi tizim = MCP server. Agentlar tool orqali kiradi.

| Tizim | MCP holati | Vazifa | Server (selfhost) |
|-------|-----------|--------|-------------------|
| **Plane** | ✅ rasmiy MCP (100+ tool, 20 modul) | Issue/cycle/module CRUD, status, comment, worklog | server1 |
| **Docmost** | ✅ rasmiy MCP (18 tool: page/space/comment) | spec, roadmap, retro docs | server1 |
| **GitLab** | ✅ rasmiy MCP / `glab` CLI | branch, commit, MR, review | server2 |
| **GitLab CI** | GitLab REST `/ci` | pipeline, deploy, status | server2 |
| **Mailcow** | ✅ jamoaviy MCP (mcpmarket) | inbound→ticket, outbound notify | server3 |
| **Design** | ✅ Pencil MCP (mavjud) / Figma | prototip, screenshot | — |

> **MCP reallik:** Plane/Docmost/GitLab/Mailcow uchun **tayyor MCP serverlar bor** — custom yozish shart emas, faqat ulanish + token. Faza 0 = config + scoped token, kod emas.
>
> **Ulanish (self-host):**
> - **Plane** — self-host → stdio transport, env: `x-api-key` (PAT) + `x-workspace-slug`. Yoki HTTP/PAT (CI/avtomatlashtirish uchun): `x-api-key` header.
> - **Docmost** — `claude mcp add Docmost --transport http https://docs.DOMAIN/mcp --header "Authorization: Bearer <API_KEY>"`. MCP web app permission'larini hurmat qiladi (least-privilege tayyor).
> - **GitLab** — rasmiy GitLab MCP yoki `glab` CLI, scoped PAT.
> - **Mailcow** — jamoaviy MCP (mcpmarket), API key. Ingest trigger uchun §4.1 ga qarang (MCP = pull; signal push hali ham kerak).

**Naming/Timezone:** RTK.md qoidalari amal qiladi — barcha vaqt UTC (ISO 8601 Z), API JSON snake_case, kod camelCase.

### 4.1 Ingest mexanizmi (signal → Hermes)

Email signal qanday vazifaga aylanadi:

```
Mailcow (server3) ──IMAP IDLE/poll──► ingest-worker ──► Hermes dispatch
   yangi xat              har 60s yoki push        REST→Plane PO triage
```

- **Xat o'qish:** Mailcow MCP (yoki IMAP) — agent inbox'ni o'qiydi.
- **Trigger:** MCP = pull (agent so'rashi kerak), shuning uchun signal'ni push qiluvchi yengil worker baribir kerak:
  - **MVP:** ingest-worker poll 60s → yangi xat bo'lsa Hermes'ga `Agent` chaqirig'i.
  - **Production:** Mailcow → webhook/Sieve → HTTP endpoint → Hermes router (Agent SDK).
- Slack/manual: bir xil dispatch interfeysi (`signal` obyekt: `{source, from, subject, body, ts}`).

### 4.2 Dedup / idempotentlik

PO agent har emailni Issue qilmasligi uchun:
- Har signal uchun **fingerprint** = `hash(from + normalized_subject + thread_id)`.
- Hermes memory (`agentmemory` MCP) da ko'rilgan fingerprintlar saqlanadi.
- Mavjud thread → yangi Issue emas, mavjud Issue'ga komment.
- Reply/auto-reply (`Re:`, `Auto-Submitted` header) → triage'dan o'tkazib yuboriladi.

---

## 4.5 Secrets va autentifikatsiya

Self-host = ko'p maxfiy kalit. Markazlashtirilgan boshqaruv:

| Maxfiy | Qayerda | Kim ishlatadi |
|--------|---------|---------------|
| Plane/Docmost API token | `.env` (gitignore) / Docker secret | PO, PM agentlar |
| GitLab PAT (scoped) | `.env` / CI variable | Dev crew, QA, DevOps |
| Mailcow IMAP/SMTP cred | `.env` / Docker secret | ingest-worker, Marketing |
| SSH deploy key | server keyring | DevOps |

**Qoidalar:**
- Token'lar **hech qachon** kodga yoki Plane/Docmost'ga yozilmaydi (RTK.md: secret commit qilmaslik).
- Har agent **scoped** token oladi (least privilege) — masalan QA read-only CI, DevOps deploy-only.
- `.env` → `.gitignore` da (selfhost stack allaqachon shunday).
- Rotatsiya: tokenlar 90 kunda yangilanadi; ssh key per-server.
- Production'da: Docker secrets yoki Vault, oddiy `.env` emas.

---

## 5. Shared state & memory

- **Plane = operatsion holat** (qaysi task qaysi bosqichda). Agentlar bu yerdan sinxron.
- **Docmost = bilim** (spec, qaror, retro).
- **GitLab = artefakt** (kod, MR, CI).
- **Agent memory** (`agentmemory`/`mnemosyne` MCP mavjud) = agentlararo lesson, pattern, kontekst + ingest fingerprint saqlash. Har bir agent o'tmish qarorlardan o'rganadi.
- **`.todos/` board** = lokal Hermes ish navbati (task-flow skill).

Hermes har "turn"da Plane + board'ni qayta o'qiydi → stale ishlamaydi.

---

## 5.5 Observability (sokin fail'ga qarshi)

"Sokin fail bo'lmasin" qoidasini amalga oshirish:

- **Struktur log:** har agent harakati JSON log (UTC ts, agent, action, signal_id, verdict). Markaziy log (server tanlovi: GitLab yoki alohida Loki/stdout).
- **Status tracking:** har Issue Plane'da bosqich label'iga ega (`stage:triage`→`stage:dev`→...). Hermes yopilmagan/qotib qolgan Issue'larni kuzatadi.
- **Heartbeat:** uzoq agent (dev crew) timeout bilan — N daqiqada javob yo'q → Hermes eskalatsiya.
- **Alert:** GATE fail yoki agent xato → Mailcow orqali sizga xabar (yoki Slack).
- **`.todos/monitoring.md`** = lokal dashboard (auto-generated, task-flow).

---

## 6. Claude Code'da implementatsiya

Ikki variant:

### A) Subagent crew (tez MVP — bugun ishlaydi)
- Hermes = asosiy Claude Code sessiyasi.
- Har role = `Agent` tool (Task) bilan spawn qilingan subagent + maxsus system prompt.
- Parallel dev = bitta xabarda bir nechta `Agent` chaqirig'i.
- Worktree isolation = parallel kod yozishda konflikt yo'q.
- Gate = `AskUserQuestion` (siz tasdiqlaysiz).

### B) Claude Agent SDK (production — doimiy servis)
- Har agent = alohida SDK process, MCP tool'lar ulangan.
- Hermes = router servis (webhook: Mailcow/Plane → agent dispatch).
- Holat Plane'da, memory MCP'da.
- 24/7 ishlaydi, event-driven.

**Tavsiya:** A bilan boshlash (1 hafta), pattern ishlaganda B'ga ko'chirish.

### Subagent ta'rif misoli (`.claude/agents/po-agent.md`)
```yaml
---
name: po-agent
description: Product Owner — triages raw input into Plane issues with acceptance criteria
allowed_tools: [Read, mcp__plane__*, mcp__docmost__*, mcp__mailcow__*]
---
Sen Product Owner agentisan. Kiruvchi muammoni:
1. Tasnifla: bug / feature / debt / savol
2. Prioritet ber (RICE yoki MoSCoW)
3. Plane Issue yoz: title, description, acceptance criteria (Given/When/Then)
4. Cycle/Module'ga bog'la
5. Yozishdan oldin fingerprint dedup tekshir (§4.2)
Roadmapga qo'shishdan OLDIN to'xta — human gate kerak.
```

---

## 7. Repo strukturasi

```
hermes-adlc/
├── ARCHITECTURE.md          # ← shu hujjat
├── selfhost/                # 3-server infra (Plane/Docmost/GitLab/Mailcow) — TAYYOR
│   ├── server1-plane-docs/  # Plane + Docmost + Caddy
│   ├── server2-gitlab/      # GitLab CE
│   ├── server3-mailcow/     # Mailcow
│   ├── dns/  backup/
│   └── README.md
├── .claude/
│   ├── agents/              # role subagent ta'riflari
│   │   ├── hermes.md
│   │   ├── po-agent.md
│   │   ├── pm-agent.md
│   │   ├── backend-agent.md
│   │   ├── frontend-agent.md
│   │   ├── mobile-agent.md
│   │   ├── design-agent.md
│   │   ├── qa-agent.md
│   │   ├── devops-agent.md
│   │   └── marketing-agent.md
│   ├── workflows/           # deterministik orkestratsiya (Workflow tool)
│   │   └── adlc-pipeline.js
│   └── settings.json        # MCP serverlar, permissions, gate hook'lari
├── integrations/            # MCP ulanish config (tayyor MCP, custom emas)
│   ├── mcp.md               # Plane/Docmost/GitLab/Mailcow MCP add buyruqlar + token
│   └── mailcow-ingest/      # faqat signal-trigger worker (poll/webhook)
└── docs/
    └── gates.md             # 80/20 gate ta'riflari + eskalatsiya qoidalari
```

---

## 7.1 Deploy xavfsizligi (DevOps gate)

- **Staging avval:** har merge → staging auto-deploy → smoke test (QA). Prod faqat staging yashil bo'lsa.
- **Rollback:** har release teglanadi (`v1.2.3`); prod deploy oldin oldingi image saqlanadi. Fail → bir buyruq bilan oldingi tegga qaytish.
- **DB migration:** orqaga mos (backward-compatible) — expand/contract pattern. Migration prod gate'da alohida tasdiqlanadi.
- **Backup:** deploy oldin Postgres dump (selfhost `backup/backup.sh` allaqachon bor).

---

## 8. Roadmap (qurilish tartibi)

| Faza | Natija | Vaqt | Holat |
|------|--------|------|-------|
| **−1. Infra** | 3-server self-host (Plane/Docmost/GitLab/Mailcow) + Caddy + backup | — | ✅ DONE (`selfhost/`) |
| **0. Setup** | Plane/Docmost/GitLab/Mailcow MCP ulanish (tayyor MCP, config+token) + repo skeleton | 1 kun | ⏭ keyingi |
| **1. PO agent** | Email(Mailcow)→Plane Issue (gate + dedup bilan) | 1-2 kun | |
| **2. PM agent** | Issue→sub-issue breakdown | 1 kun | |
| **3. Dev crew** | task→TDD kod→MR (1 til bilan boshlash) | 3-5 kun | |
| **4. QA + review** | GitLab CI test + AI review gate | 2 kun | |
| **5. DevOps** | CI/CD + staging auto deploy + rollback | 2 kun | |
| **6. Hermes orchestrator** | uchidan-uchiga oqim, gate'lar, observability | 3 kun | |
| **7. Design + Marketing** | Pencil + launch agentlari | keyin | |

**MVP = Faza 0-4** (Email→Plane→PO→PM→Dev→MR→QA). Bu allaqachon haqiqiy 80/20 beradi. Infra (Faza −1) tugadi — keyingi qadam: integ spec + MCP ulanish (Faza 0, tayyor MCP'lar bilan ~1 kun).

---

## 9. Xavf va cheklovlar

- **Gate'larni o'tkazib yubormang:** merge va prod deploy — DOIM human. AI o'zi merge qilmasin.
- **MCP versiya mosligi:** tayyor MCP'lar (Plane/Docmost/GitLab/Mailcow) self-host versiyaga mos bo'lishi shart — API o'zgarsa MCP buzilishi mumkin. Pin qilingan versiya ishlat.
- **Token narxi:** parallel crew qimmat. Workflow tool bilan boshqarib, kerakli joyda model tier tanlang.
- **Plane spam:** PO agent har emailni Issue qilmasin — dedup/fingerprint filtri majburiy (§4.2).
- **Konflikt:** parallel dev = worktree isolation majburiy.
- **Secret oqishi:** self-host token'lar `.env`/Docker secret'da, hech qachon repo yoki Docmost'da (§4.5).
- **Self-host uptime:** server o'lsa butun pipeline to'xtaydi — backup + monitoring + (kelajakda) HA kerak.
- **Eskalatsiya:** har agent "ishonchsiz" bo'lsa → Hermes → siz. Sokin fail bo'lmasin (§5.5 observability).
```