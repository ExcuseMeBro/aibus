# Server 3 — Mailcow (mail server)

Hostname: `mail.adam.uz`. MX for `adam.uz`. Mailcow o'z compose + nginx + acme'sini boshqaradi.

## 0. Talab (KRITIK)
- 2+ vCPU / **6 GB RAM** + 1GB swap, Docker + compose
- **Port 25 ochiq** (chiquvchi mail) — tasdiqlandi ✓
- **rDNS / PTR**: server IP → `mail.adam.uz` (provayder panelida sozlang — deliverability uchun SHART)
- DNS A: `mail.adam.uz` → shu server IP
- `adam.uz` da boshqa MX bo'lmasin (eski Google/CF mail o'chir)

## 1. O'rnatish
```bash
sudo apt update && sudo apt install -y git
cd /opt
sudo git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
sudo ./generate_config.sh
#   Mail server hostname (FQDN): mail.adam.uz
#   Timezone: Asia/Tashkent
#   Branch: 1 (stable)
sudo docker compose pull
sudo docker compose up -d
```
Birinchi yuklash ~5-10 daqiqa (rasmlar katta).

## 2. Admin panel
`https://mail.adam.uz` → login `admin` / parol `moohoo` → **darhol o'zgartir**.

## 3. Domen + qutilar
Panel → Configuration → Mail Setup → Domains → `adam.uz` qo'sh.
Keyin Mailboxes qo'sh (Hermes agentlari uchun kerakli):
- `hermes@adam.uz` (inbound triage — PO agent o'qiydi)
- `gitlab@adam.uz` (GitLab SMTP — server2 .env paroli shu)
- `noreply@adam.uz`, `postmaster@adam.uz`

## 4. DKIM
Panel → Configuration → ARC/DKIM keys → `adam.uz` uchun key generatsiya qil →
chiqgan TXT yozuvni `dns/records.md` dagi DKIM qatoriga ko'chir va DNS'ga qo'sh.

## 5. Firewall
```bash
sudo ufw allow 25,80,443,143,465,587,993,995,4190/tcp
sudo ufw allow OpenSSH
sudo ufw enable
```

## 6. Verify (deliverability)
- https://www.mail-tester.com — test xat yubor, **10/10** maqsad
- https://mxtoolbox.com — MX, SPF, DKIM, DMARC, PTR yashil bo'lsin
- Port 25: `telnet mail.adam.uz 25` tashqaridan
- IP blacklist'da emasligini tekshir (mxtoolbox blacklist check)

## Update
```bash
cd /opt/mailcow-dockerized && sudo ./update.sh
```

## Hermes ulanishi
- Inbound: PO agent IMAP `mail.adam.uz:993` `hermes@adam.uz` → yangi xat = Plane Story.
- Outbound: agentlar SMTP `mail.adam.uz:587` orqali xabar yuboradi.
