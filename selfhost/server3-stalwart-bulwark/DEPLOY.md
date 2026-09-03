# Server 3 — Stalwart + Bulwark

`mail.adam.uz` — Stalwart mail/JMAP/admin; `webmail.adam.uz` — Bulwark web client. MX remains `mail.adam.uz`.

- **Stalwart** is the protocol and data server: SMTP, IMAP, POP3, JMAP, CalDAV, CardDAV, WebDAV, ManageSieve, DKIM/DMARC/spam filtering and admin WebUI.
- **Bulwark** is a JMAP webmail/groupware client (mail, calendar, contacts and files), not a second mail server.
- Deployment baseline: Stalwart `v0.16.20`, Bulwark `1.9.2`; Compose pins their verified multi-platform index digests. Review release notes and deliberately update both tag and digest together.

Primary sources: [Stalwart Docker](https://stalw.art/docs/install/platform/docker/), [Stalwart repository](https://github.com/stalwartlabs/stalwart), [Bulwark repository](https://github.com/bulwarkmail/webmail).

## 0. Requirements

- Existing server3 allocation (AIBUS baseline): 2+ vCPU, 6 GB RAM, swap and enough disk for mail plus backups. Stalwart does not publish this as a universal minimum; measure after the pilot.
- Docker Engine + Compose; host Caddy; outbound TCP 25 confirmed open.
- PTR: `S3_IP` → `mail.adam.uz`; A records for both `mail` and `webmail` → `S3_IP`.
- Public ports: 25, 80, 443, 465, 587, 143, 993, 110, 995, 4190. Remove POP3 ports 110/995 if no client needs them.
- Never commit `.env`, DNS-provider credentials, recovery credentials or mailbox passwords.

## 1. Prepare without changing MX

Keep Mailcow authoritative during preparation and pilot migration. Lower the relevant DNS TTL to 300 seconds at least one old-TTL window before cutover. Record every domain, account, alias, quota, Sieve rule, calendar and address book, then take and test a Mailcow backup.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin caddy
sudo usermod -aG docker "$USER"  # log out/in once before using Docker without sudo
sudo install -d -o "$USER" -g "$(id -gn)" /opt/aibus
git clone https://github.com/ExcuseMeBro/aibus.git /opt/aibus
cd /opt/aibus/selfhost/server3-stalwart-bulwark
cp .env.example .env
openssl rand -base64 32  # use once for STALWART_RECOVERY_ADMIN
openssl rand -base64 32  # use a different value for BULWARK_SESSION_SECRET
sudoedit .env
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
```

Do **not** start this stack on Mailcow's live IP/ports while Mailcow still owns them. Preferred pilot: use a temporary server plus `mail-pilot.adam.uz` / `webmail-pilot.adam.uz`; change `MAIL_HOSTNAME`, `MAIL_PUBLIC_URL` and every production hostname/origin in `Caddyfile`. Do not grant the pilot authority to rewrite production `adam.uz` MX/A records. Otherwise schedule a controlled port handover while keeping the old server intact for rollback.

## 2. Start and bootstrap

```bash
cd /opt/aibus/selfhost/server3-stalwart-bulwark
docker compose pull
docker compose up -d
docker compose logs -f stalwart
```

Open `http://127.0.0.1:8080/admin` through an SSH tunnel for bootstrap:

```bash
ssh -L 8080:127.0.0.1:8080 admin@S3_IP
```

In Stalwart's five-step wizard:

1. Production handover uses hostname `mail.adam.uz`, default domain `adam.uz`, and generated DKIM keys. A parallel pilot uses `mail-pilot.adam.uz` and a delegated test domain; add `adam.uz` later without publishing or changing its production zone.
2. Use local RocksDB stores for this single-node deployment unless an external-store design has been approved.
3. Use the internal directory initially.
4. Send logs to the console.
5. Stalwart's mail listeners need a trusted certificate. With host Caddy occupying public TCP 443, use a DNS-01 ACME provider scoped to the intended pilot/production zone, or upload a separately managed certificate; TLS-ALPN-01 cannot reach Stalwart behind Caddy. During a pilot, do not enable automatic DNS changes for production `adam.uz`.

After the wizard, save the permanent admin credential, restart Stalwart, remove `STALWART_RECOVERY_ADMIN` from `.env`, and recreate only that service:

```bash
docker compose restart stalwart
sudoedit .env
docker compose up -d --force-recreate stalwart
```

Keep `127.0.0.1:8080` private: Caddy needs it for JMAP/admin, but UFW must not expose it.

## 3. Configure domain and accounts

In `https://mail.adam.uz/admin`:

- Confirm domain `adam.uz` and copy Stalwart's generated DNS zone values into the DNS provider.
- Create `hermes@adam.uz`, `gitlab@adam.uz`, `noreply@adam.uz`, `postmaster@adam.uz` plus all real users and aliases.
- Match old quotas and required Sieve rules.
- Enable Stalwart's `Use X-Forwarded` HTTP setting only while port 8080 remains loopback-bound and Caddy is its sole proxy; this preserves real client IPs for logging and rate limits.
- Keep Stalwart's global permissive-CORS switch off. `Caddyfile` allowlists only `https://webmail.adam.uz` for Bulwark's browser-side JMAP calls; update and test that origin when using pilot hostnames.
- Keep automatic spam/phishing filtering, SPF, DKIM, DMARC and ARC verification enabled; tune only from measured false positives.

Start/reload Caddy after both public A records resolve to server3:

```bash
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl -fsS https://mail.adam.uz/.well-known/jmap
curl -fsS https://webmail.adam.uz/api/health
```

Open `https://webmail.adam.uz`, finish Bulwark's setup, and confirm its fixed JMAP server is `https://mail.adam.uz`. Persistent admin/settings/state volumes are already declared in Compose; telemetry is off.

## 4. Reversible Mailcow migration

Mailcow backup archives cannot be restored directly into Stalwart. Migrate messages over IMAP; export/import calendars and contacts separately (ICS/vCard) and compare them before cutover.

1. **Pilot:** migrate one non-critical mailbox with `imapsync`; use password files, not command-line passwords.
2. Compare folder/message counts, flags, internal dates, attachments, special folders, calendars and contacts.
3. Run inbound/outbound tests with external providers and verify SPF, DKIM, DMARC, PTR and TLS.
4. Migrate all accounts while Mailcow remains authoritative.
5. At the approved cutover gate, pause writes/clients, run a final IMAP delta, switch A/MX and SMTP clients, then resume on Stalwart.
6. Keep the old Mailcow host powered off but recoverable, with its DNS and tested backup, until the acceptance window ends. Do not delete its data as part of this deployment.

If rollback is required **after** users have written to Stalwart, restoring DNS alone would lose those changes. Enter maintenance mode, freeze user SMTP submission/IMAP/JMAP writes, reverse-sync every mailbox from Stalwart to Mailcow, and export/import all changed calendars and contacts. Verify counts and samples before restoring MX/A/client settings. Keep Stalwart receiving during DNS cache expiry and run another reverse IMAP delta for mail that still reached it; retire it only after both sides and external delivery agree.

Representative pilot command:

```bash
imapsync \
  --host1 OLD_MAILCOW_HOST --ssl1 --user1 pilot@adam.uz --passfile1 /run/secrets/old-pass \
  --host2 mail-pilot.adam.uz --ssl2 --user2 pilot@adam.uz --passfile2 /run/secrets/new-pass \
  --automap --syncinternaldates
```

Use hostnames only after they point to the intended source/target. Run the same command again for the final delta; `imapsync` is designed for repeat runs, but verify counts each time.

## 5. Firewall and verification

```bash
sudo ufw allow 25,80,443,143,465,587,993,995,4190/tcp
sudo ufw allow 110/tcp       # only if plaintext POP3 + STARTTLS is required
sudo ufw allow OpenSSH
sudo ufw enable

docker compose ps
curl -fsS https://webmail.adam.uz/api/health
curl -fsS https://mail.adam.uz/.well-known/jmap
openssl s_client -connect mail.adam.uz:993 -servername mail.adam.uz </dev/null
openssl s_client -starttls smtp -connect mail.adam.uz:587 -servername mail.adam.uz </dev/null
```

Also verify:

- external SMTP 25 receive and delivery;
- authenticated GitLab submission on 587/STARTTLS;
- IMAP 993, JMAP, CalDAV, CardDAV, WebDAV and ManageSieve 4190;
- Bulwark login, send/reply/search, calendar, contacts and files;
- MX, SPF, DKIM, DMARC and PTR with `dig`, mail-tester and MXToolbox;
- an external reply reaches `hermes@adam.uz` and Hermes can send a notification.

## 6. Backup and restore drill

`backup.sh` briefly stops both containers for a consistent snapshot of all named volumes:

```bash
cd /opt/aibus/selfhost/server3-stalwart-bulwark
sudo chmod 0750 backup.sh
sudo BACKUP_ROOT=/var/backups/aibus-mail ./backup.sh
# daily at 02:00 UTC:
# 0 2 * * * BACKUP_ROOT=/var/backups/aibus-mail /opt/aibus/selfhost/server3-stalwart-bulwark/backup.sh >> /var/log/aibus-mail-backup.log 2>&1
```

Copy backups off-host and encrypt them. Restore only into an isolated drill host first. A real restore is destructive: stop the stack, clear each target named volume, extract its matching archive, then start and repeat all protocol/data checks. Never overwrite the live volumes without explicit approval and a second copy of the current state.

## 7. Update and rollback

```bash
cd /opt/aibus/selfhost/server3-stalwart-bulwark
docker compose pull
docker compose up -d
```

Read Stalwart's upgrade guide before changing minor versions. Test new Stalwart/Bulwark versions against a restored backup, pin the accepted tags/digests in `docker-compose.yml`, back up, deploy, and rerun §5. Rollback means restoring the previous images **and** their compatible pre-upgrade volume snapshot; downgrading binaries against newer data is not assumed safe.
