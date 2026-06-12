# Self-Host Stack — adam.uz

Atlassian o'rniga ochiq-kod, litsenziyasiz, to'liq self-host. Hermes ADLC agentlari shu API'larga ulanadi.

## Topologiya (3 server)

| Server | Servis | Subdomen | Almashtiradi | Min spec |
|--------|--------|----------|--------------|----------|
| **server1** | Plane + Docmost (+ Caddy TLS) | `plane.adam.uz`, `docs.adam.uz` | Jira + Confluence | 4 vCPU / 8 GB |
| **server2** | GitLab CE | `gitlab.adam.uz` | Bitbucket + CI/CD | 4 vCPU / 8 GB |
| **server3** | Mailcow | `mail.adam.uz` (MX adam.uz) | Email | 2 vCPU / 6 GB |

Port 25 ochiq ✓. SSL = Let's Encrypt (server1 Caddy, server2 omnibus, server3 mailcow-acme).

## Deploy tartibi (KETMA-KET)

1. **DNS** — `dns/records.md` → A yozuvlar + mail (MX/SPF/DMARC) + **PTR**. Tarqalishini kut.
2. **server3 (Mailcow)** — `server3-mailcow/DEPLOY.md`. DKIM generatsiyadan keyin DNS'ga qo'sh, qutilar yarat (`hermes@`, `gitlab@`).
3. **server1 (Plane+Docmost)** — `server1-plane-docs/DEPLOY.md`. Caddy auto-TLS.
4. **server2 (GitLab)** — `server2-gitlab/DEPLOY.md`. SMTP paroli = Mailcow'dagi `gitlab@adam.uz`.
5. **Backup** — har serverda cron (`backup/backup.sh` + GitLab/Mailcow o'z skriptlari, izoh skript ichida).

## Struktura

```
selfhost/
├── README.md                    # ← shu
├── dns/records.md               # barcha DNS (A/MX/SPF/DKIM/DMARC/PTR)
├── server1-plane-docs/
│   ├── DEPLOY.md
│   ├── Caddyfile                # TLS front: plane.* + docs.*
│   ├── docmost/                 # docker-compose + .env.example
│   └── plane/INSTALL.md         # Plane rasmiy setup.sh + Caddy
├── server2-gitlab/
│   ├── DEPLOY.md
│   ├── docker-compose.yml       # omnibus + LE + SMTP→Mailcow
│   └── .env.example
├── server3-mailcow/
│   └── DEPLOY.md                # mailcow installer + DKIM + deliverability
└── backup/backup.sh
```

## Hermes ADLC integ (keyingi faza)

| Agent | Tizim | Ulanish |
|-------|-------|---------|
| PO inbound | Mailcow IMAP 993 `hermes@adam.uz` | yangi xat → Plane Story |
| PO/PM | Plane REST API + webhook | Story/cycle CRUD |
| Dev | GitLab API + git ssh:2222 | branch, PR (MR), CI |
| DevOps | GitLab CI/CD runner | pipeline, deploy |
| Docs | Docmost API | spec, retro |

> Plane/GitLab/Mailcow uchun rasmiy MCP yo'q → yengil MCP adapter yoziladi (REST wrapper). `~/hermes-adlc/` ga qarang.

## Xavfsizlik (har server)
- UFW: faqat kerakli portlar (har DEPLOY.md da ko'rsatilgan).
- SSH key-only, `PermitRootLogin no`, fail2ban.
- `.env` git'ga kirmaydi (`.gitignore`).
- DB portlari (5432/6379) tashqariga ochiq EMAS — compose internal network.
- Backup restore'ni bir marta test qil.
