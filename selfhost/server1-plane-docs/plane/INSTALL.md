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

> ⚠️ **Onboarding 403/CSRF bloki — eng tez-tez uchraydigan xato.**
> Plane Django `CORS_ALLOWED_ORIGINS`dan `CSRF_TRUSTED_ORIGINS` yasaydi. Onboarding
> submit'da `Origin`/CSRF tekshiruvi o'tishi uchun origin **aniq mos** kelishi shart:
> - `https://` (http emas), oxirida **slash yo'q**, `www` yo'q.
> - Bir nechta bo'lsa vergul bilan, bo'sh joysiz: `https://plane.adam.uz,https://www.plane.adam.uz`
> - Caddy `X-Forwarded-Proto https` yuborishi shart (Caddyfile'da sozlangan) — busiz
>   backend req'ni HTTP deb biladi va POST 403 bo'ladi.
> O'zgartirgandan keyin: `./setup.sh` -> 4 (Restart).

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

## Troubleshooting — onboarding 403 / CSRF / CORS

Submit'da 403 yoki "CSRF/Origin checking failed" chiqsa:

```bash
# 1) Env to'g'rimi? (https, slash yo'q, mos)
grep -E 'WEB_URL|CORS_ALLOWED_ORIGINS' plane.env

# 2) Caddy proto yuboryaptimi? (X-Forwarded-Proto: https bo'lsin)
curl -sI https://plane.adam.uz/ | head
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy

# 3) API container CSRF log'i
docker compose --env-file plane.env -f plane-app/docker-compose.yaml logs api | grep -i csrf | tail

# 4) Env o'zgartirilsa -> qayta yuklash SHART
./setup.sh   # 4 = Restart
```

Sabablar tartibi (ehtimoldan): (a) `CORS_ALLOWED_ORIGINS` http/slash/typo, (b) Caddy
`X-Forwarded-Proto` yo'q, (c) browser eski cookie — incognito'da sina yoki cookie tozala.
