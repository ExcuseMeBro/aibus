# ✅ DONE

- [x] 🟢 🚀 Observability: structured JSONL log + stuck-issue monitor + escalation; wired into pipeline (commit 0b3544d)
- [x] 🟡 🚀 Real Dev (credsiz): sandbox workspace + LocalCI (real test exec) + LocalRepo (real git, izolyatsiya bug fix) + dev-agent jonli TDD; `local` mode — slugify e2e isbot, 52 test (commit b14fd34)

- [x] 🟠 📐 Hermes ADLC: to'liq arxitektura design → `~/hermes-adlc/ARCHITECTURE.md`
- [x] 🟠 🔨 Plane + Docmost self-host: compose + nginx + SSL + backup → `~/selfhost/`
- [x] 🟠 🔨 Self-host 3-server (Plane+Docmost / GitLab / Mailcow) + Caddy + DNS + backup → `~/selfhost/`
- [x] 🟠 🔨 Self-host: reverse proxy (Caddy/Traefik) + SSL (Let's Encrypt) bazasi → `selfhost/server1-plane-docs/Caddyfile`
- [x] 🟠 🔨 Self-host: Plane compose stack → `selfhost/server1-plane-docs/plane/INSTALL.md`
- [x] 🟡 🔨 Self-host: Docmost compose stack → `selfhost/server1-plane-docs/docmost/docker-compose.yml`
- [x] 🟡 🔨 Self-host: GitLab CE compose stack → `selfhost/server2-gitlab/docker-compose.yml`
- [x] 🟠 🔨 Self-host: Mailcow (alohida, mail portlar + DNS/PTR) → `selfhost/server3-mailcow/DEPLOY.md`
- [x] 🟢 🔨 Self-host: backup script (Postgres dumps + volume) → `selfhost/backup/backup.sh`
- [x] 🟠 🔍 Hermes ADLC: ARCHITECTURE.md to'liq review + kamchilik tuzatish (tool stack Plane/Docmost/GitLab/Mailcow ga moslandi + secrets/observability/ingest/dedup/deploy section qo'shildi)
- [x] 🟡 🔍 ARCHITECTURE.md: MCP holati to'g'irlandi — Plane/Docmost/Mailcow rasmiy MCP MAVJUD (custom emas), ulanish buyruqlari + Faza 0 yengillashtirildi
- [x] 🟠 🚀 Repo push → github.com/ExcuseMeBro/aibus (main, .todos kiritildi, secret himoya)
- [x] 🟠 📐 Hermes ADLC: arxitekturani qotirish + PO slice spec (Path A, Telegram ingest, real Plane MCP) → `docs/superpowers/specs/2026-06-12-hermes-po-slice-design.md`
- [x] 🟠 🔨 Hermes ADLC: PO slice ingest (Telegram→signal) — TDD, live-verified, subagent-driven review → `ingest/`
- [x] 🟠 🔨 Hermes MVP pipeline (fake mode, prod keysiz): adapters seam + state machine + 7 agent + orchestrator, e2e offline, 26 test → `adapters/` `pipeline/` `.claude/`
