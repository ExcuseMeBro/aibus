# Self-Host Stack — adam.uz

Atlassian/Gmail o'rniga ochiq-kod, SaaS litsenziya to'lovisiz, to'liq self-host stack. Hermes ADLC agentlari shu API va mail protokollariga ulanadi.

## Topologiya (3 server)

| Server | Servis | Subdomen | Almashtiradi | AIBUS baseline |
|--------|--------|----------|--------------|----------------|
| **server1** | Plane + Docmost (+ Caddy TLS) | `plane.adam.uz`, `docs.adam.uz` | Jira + Confluence | 4 vCPU / 8 GB |
| **server2** | GitLab CE | `gitlab.adam.uz` | Bitbucket + CI/CD | 4 vCPU / 8 GB |
| **server3** | Stalwart + Bulwark (+ Caddy TLS) | `mail.adam.uz`, `webmail.adam.uz` | Gmail / Mailcow | 2 vCPU / 6 GB, pilotda o'lchash |

Server3'da Stalwart SMTP/IMAP/JMAP/CalDAV/CardDAV/WebDAV va mail ma'lumotlarini boshqaradi. Bulwark esa Stalwart JMAP ustidagi webmail/calendar/contacts/files klientidir. Port 25 ochiq bo'lishi va `mail.adam.uz` uchun PTR majburiy.

## Deploy tartibi (ketma-ket)

1. **DNS** — `dns/records.md`: A yozuvlar, `webmail`, MX/SPF/DMARC/PTR; mail cutoverdan oldin TTL'ni pasaytir.
2. **server3 (Stalwart + Bulwark)** — `server3-stalwart-bulwark/DEPLOY.md`: avval parallel pilot/migratsiya, keyin alohida tasdiqlangan cutover. Stalwart DNS zone'dan DKIM qiymatini DNS'ga qo'sh.
3. **server1 (Plane + Docmost)** — `server1-plane-docs/DEPLOY.md`. Caddy auto-TLS.
4. **server2 (GitLab)** — `server2-gitlab/DEPLOY.md`. SMTP credential = Stalwart'dagi `gitlab@adam.uz`.
5. **Backup** — server1 uchun `backup/backup.sh`; GitLab o'z backup'i; server3 uchun `server3-stalwart-bulwark/backup.sh`. Har bir restore alohida hostda sinovdan o'tsin.

## Struktura

```
selfhost/
├── README.md
├── dns/records.md
├── server1-plane-docs/
│   ├── DEPLOY.md
│   ├── Caddyfile
│   ├── docmost/
│   └── plane/INSTALL.md
├── server2-gitlab/
│   ├── DEPLOY.md
│   ├── docker-compose.yml
│   └── .env.example
├── server3-stalwart-bulwark/
│   ├── DEPLOY.md
│   ├── docker-compose.yml
│   ├── Caddyfile
│   ├── .env.example
│   └── backup.sh
└── backup/backup.sh
```

## Hermes ADLC integratsiyasi

| Agent | Tizim | Ulanish |
|-------|-------|---------|
| PO inbound | Stalwart IMAP 993 `hermes@adam.uz` | yangi xat → Plane Story |
| Marketing/notify | Stalwart SMTP submission 587 + STARTTLS | authenticated outbound |
| Odamlar | Bulwark `https://webmail.adam.uz` | JMAP web client |
| PO/PM | Plane REST API + webhook | Story/cycle CRUD |
| Dev | GitLab API + git ssh:2222 | branch, MR, CI |
| DevOps | GitLab CI/CD runner | pipeline, deploy |
| Docs | Docmost API | spec, retro |

Email avtomatizatsiyasi Stalwartning standart IMAP/SMTP/JMAP interfeysiga yoziladi; Bulwark API adapter yoki mail server emas.

## Xavfsizlik

- UFW faqat har `DEPLOY.md` dagi portlarni ochadi; DB va lokal upstream portlar internetga ochilmaydi.
- SSH key-only, `PermitRootLogin no`, fail2ban.
- `.env`, provider tokenlari va cert private key'lari git'ga kirmaydi.
- Production image'lari test qilingan tag va digest bilan pin qilinadi.
- Backup off-host shifrlanadi va restore muntazam drill qilinadi.
- Mailcow migratsiya manbasi rollback oynasi tugamaguncha o'chirilmaydi; live ma'lumotni yo'q qilish alohida human gate talab qiladi.
