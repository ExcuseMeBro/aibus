# Deploy hermesd — Telegram-driven orchestrator on `31.40.29.203`

Everything runs over Telegram: you send a task, PO/PM/dev/etc reasoning is done by
Claude (`claude -p`, your Max subscription), and every human gate is an inline
**✅ Approve / ❌ Reject** button. The self-host backends (Plane/Docmost/GitLab/
Mailcow) are already up — this guide only stands up the **orchestrator daemon**.

```
Telegram  ──►  hermesd (systemd, 24/7)  ──►  Plane (REST)
  task/gate        │  ├─ claude -p  = reasoning (PO/PM/dev/marketing)
  buttons          │  └─ owns all IO = Plane writes + telegram gates + state
                   └── gate ladder: roadmap → plan → design → merge → prod → publish
```

Run the numbered blocks **as the `hermes` user on the server** unless it says otherwise.

---

## 0. Prereqs on the server

```bash
# as root / sudo
adduser --disabled-password --gecos "" hermes        # dedicated service user
apt update && apt install -y git curl

# Node 20+ (repo is pure Node, zero deps)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version        # v20+ expected

# Claude Code CLI (the reasoning engine)
curl -fsSL https://claude.ai/install.sh | bash          # installs `claude`
#   (or: npm i -g @anthropic-ai/claude-code)
```

## 1. Claude Max auth on the server (one-time)

`hermesd` calls `claude -p` as the `hermes` user, so that user must be logged in.

```bash
su - hermes
claude            # opens interactive; run /login → choose "Claude account (Max/Pro)"
                  # it prints a URL — open on your laptop, approve, paste the code back
/exit
# verify headless works:
claude -p 'reply with the single word OK' --output-format json | grep -o '"result":"[^"]*"'
```

> The token is stored in `/home/hermes/.claude`. The systemd unit sets
> `HOME=/home/hermes` so the daemon uses this same auth.

## 2. Get the code

```bash
sudo mkdir -p /opt/aibus && sudo chown hermes:hermes /opt/aibus
su - hermes
git clone https://github.com/ExcuseMeBro/aibus.git /opt/aibus
cd /opt/aibus
npm test          # 107 passing — proves the box is sane before wiring secrets
```

## 3. Telegram bot

1. **@BotFather** → `/newbot` (or reuse `@brodyone_bot`) → copy the **token**.
2. **@BotFather** → `/setprivacy` → your bot → **Disable** — so `/task ...` is seen in groups.
3. Get numeric user ids (yours + each approver): DM **@userinfobot** → it replies your `id`.
4. Get the chat id for daemon status messages: your own `id` (DM) or the group id.

## 4. Plane API access

In Plane (`https://plane.<yourdomain>`):
- **Profile → Settings → API tokens → Add** → copy `PLANE_API_KEY`.
- **Workspace slug** = the `/<slug>/` segment in the Plane URL.
- Open the target **project** → the `PLANE_PROJECT_ID` is the UUID in the project URL
  (`.../projects/<THIS-UUID>/issues`).

## 5. Fill `.env`

```bash
cd /opt/aibus
cp .env.example .env
nano .env
```

Fill:

| Key | Value |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | from BotFather (step 3.1) |
| `BOT_USERNAME` | e.g. `brodyone_bot` (no `@`) |
| `HERMES_CHAT_ID` | your DM/group id (step 3.4) |
| `HERMES_ROLES` | `{"<your_id>":"admin"}` to start — admin approves every gate |
| `HERMES_MODEL` | `sonnet` (fast/cheap) or `opus` (deepest) |
| `PLANE_BASE_URL` | `https://plane.<yourdomain>` |
| `PLANE_API_KEY` `PLANE_WORKSPACE_SLUG` `PLANE_PROJECT_ID` | step 4 |

## 6. Dry run (foreground) — prove it end to end

```bash
cd /opt/aibus
set -a; . ./.env; set +a
HERMES_MODE=real node server/hermesd.mjs
# logs: "[hermesd] online · mode=real ..." and a telegram "🪽 hermesd online" message
```

Now, **from Telegram** (DM the bot, or in a group: `/task <text>`):

1. Send: `login page crashes on empty password`
2. Bot replies `📥 got it — triaging…`, then posts **🚦 GATE: roadmap** with buttons.
3. Tap **✅ Approve** → bot runs PM, posts **🚦 GATE: plan**.
4. Keep approving → `plan → (design if UI) → merge → prod → publish` → `🎉 shipped & published`.
5. Check Plane — the issue is there with stage comments.

`Ctrl-C` to stop the dry run once the ladder works.

> Only the user id whose role owns a gate can approve it (admin approves all). A
> wrong-role tap gets a `⛔ denied` toast. Roles: roadmap→po · plan→pm ·
> design→design · merge→reviewer · prod→devops · publish→marketing.

## 7. Run 24/7 under systemd

```bash
# as root
cp /opt/aibus/server/hermesd.service /etc/systemd/system/hermesd.service
# the unit already targets User=hermes, WorkingDirectory=/opt/aibus, HOME=/home/hermes
systemctl daemon-reload
systemctl enable --now hermesd
systemctl status hermesd          # active (running)
journalctl -u hermesd -f          # live logs
```

Update later:

```bash
su - hermes -c 'cd /opt/aibus && git pull && npm test'
sudo systemctl restart hermesd
```

---

## What is live now vs next

| Stage | Status |
|-------|--------|
| Telegram ingest → PO triage → Plane issue | ✅ live |
| Gates over Telegram buttons (role-authz) | ✅ live |
| PM plan · design · marketing (claude reasoning) | ✅ live |
| Dev stage = MR **plan** (branch/title reasoning) | ✅ live (no code push yet) |
| Real GitLab MR push + CI + staging/prod deploy | ⏭ next (roadmap) |
| Docmost release-notes page · Mailcow email ingest | ⏭ next |

The dev stage currently produces the MR intent (branch + title) via Claude and
advances to the merge gate; it does **not** yet push code to GitLab or run CI.
That is the next slice — wire `adapters/repo-git` to a GitLab remote + `glab`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No telegram reply | `journalctl -u hermesd -f`; check `TELEGRAM_BOT_TOKEN`; bot privacy OFF for groups |
| `⛔ denied` on every button | your id/role missing in `HERMES_ROLES`; use `{"<id>":"admin"}` |
| `RealPlane: ... required` | `PLANE_PROJECT_ID` / slug / key / base url unset in `.env` |
| Issue created but not in Plane | token scope or project id wrong; daemon keeps a local record and logs the failure — it never drops the issue |
| `claude` errors in logs | re-auth: `su - hermes -c 'claude'` → `/login` |
| Duplicate task ignored | same text = same fingerprint (dedup). Change wording to force a new issue |

State lives in `/opt/aibus/.hermes/` (offset, seen-set, pending gates, issue
mirror). Back it up with the rest of the server.
