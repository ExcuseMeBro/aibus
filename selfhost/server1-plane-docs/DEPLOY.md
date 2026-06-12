# Server 1 — Plane + Docmost

Subdomenlar: `plane.adam.uz`, `docs.adam.uz`. TLS = Caddy (auto Let's Encrypt).

```
Internet :443
   │
 Caddy (host)
   ├── plane.adam.uz → 127.0.0.1:8082  (Plane proxy container)
   └── docs.adam.uz  → 127.0.0.1:3000  (Docmost container)
```

## 0. Talab
- 4 vCPU / 8 GB RAM, Ubuntu/Debian
- DNS A: `plane.adam.uz`, `docs.adam.uz` → shu server IP
- Docker + compose: `curl -fsSL https://get.docker.com | sh`

## 1. Caddy (TLS front)
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo cp /Users/bro/hermes-adlc/selfhost/server1-plane-docs/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy      # certlarni 80/443 ochiq bo'lsa avtomatik oladi
```

## 2. Docmost (wiki)
```bash
cd /Users/bro/hermes-adlc/selfhost/server1-plane-docs/docmost
cp .env.example .env
# .env to'ldir:
#   APP_URL=https://docs.adam.uz
#   APP_SECRET=$(openssl rand -hex 32)
#   DB_PASSWORD=<strong>
nano .env
docker compose up -d
docker compose logs -f docmost      # "Nest application successfully started"
curl -I http://127.0.0.1:3000       # 200
```

## 3. Plane (project mgmt)
```bash
cd /Users/bro/hermes-adlc/selfhost/server1-plane-docs/plane
curl -fsSL -o setup.sh https://github.com/makeplane/plane/releases/latest/download/setup.sh
chmod +x setup.sh
./setup.sh            # 1 = Install
nano plane.env        # LISTEN_HTTP_PORT=8082 · WEB_URL=https://plane.adam.uz · CORS_ALLOWED_ORIGINS=https://plane.adam.uz
./setup.sh            # 2 = Start
curl -I http://127.0.0.1:8082
```

## 4. Firewall
```bash
sudo ufw allow 80,443/tcp
sudo ufw allow OpenSSH
sudo ufw deny 8082         # Plane faqat localhost orqali
sudo ufw deny 3000         # Docmost faqat localhost orqali
sudo ufw enable
```

## 5. Verify
- `https://docs.adam.uz` → Docmost wizard
- `https://plane.adam.uz` → Plane signup
- SSL: https://www.ssllabs.com/ssltest/

## Update
```bash
cd .../docmost && docker compose pull && docker compose up -d
cd .../plane   && ./setup.sh   # 5 = Upgrade
```
