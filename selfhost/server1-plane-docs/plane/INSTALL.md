# Plane (Jira alternative) — Community Edition self-host

Plane manage qiladi o'z compose'ini `setup.sh` orqali. Biz uni host Caddy ortida (TLS) ishlatamiz.

## 1. O'rnatish

```bash
cd /Users/bro/hermes-adlc/selfhost/server1-plane-docs/plane         # serverda: shu papka ichida
curl -fsSL -o setup.sh https://github.com/makeplane/plane/releases/latest/download/setup.sh
chmod +x setup.sh
./setup.sh
# menu -> 1 (Install). amd64 server uchun. arm64 bo'lsa shuni tanlaydi.
```

Bu `plane-app/` papka + `plane.env` yaratadi.

## 2. plane.env tahrirlash (MUHIM)

nginx host :80/:443 ni egallaydi, shuning uchun Plane'ni ichki portga ko'chir:

```bash
nano plane.env
```

O'zgartir:
```
LISTEN_HTTP_PORT=8082
LISTEN_HTTPS_PORT=8443
WEB_URL=https://plane.adam.uz
CORS_ALLOWED_ORIGINS=https://plane.adam.uz
```

> Plane proxy konteyneri faqat localhost'ga bind bo'lsin — agar setup `0.0.0.0:8082` ochsa,
> firewall (ufw) bilan 8082'ni tashqaridan yop: `ufw deny 8082`.

## 3. Ishga tushir

```bash
./setup.sh   # menu -> 2 (Start)
# yoki to'g'ridan:  docker compose --env-file plane.env -f plane-app/docker-compose.yaml up -d
```

## 4. Tekshir

```bash
curl -I http://127.0.0.1:8082      # 200/302 kelishi kerak
./setup.sh                          # menu -> 6 (View Logs)
```

## Boshqaruv (setup.sh menu)
- 2 Start · 3 Stop · 4 Restart · 5 Upgrade · 6 Logs · 7 Backup

## Birinchi kirish
`https://plane.adam.uz` -> admin akkaunt yarat -> workspace yarat.
Jira'dagi project/sprint = Plane'da project/cycle/module.
