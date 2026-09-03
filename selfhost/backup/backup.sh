#!/usr/bin/env bash
# Backup — RUNS ON SERVER 1 (Plane + Docmost): postgres dumps + storage volumes.
# GitLab (server2) and Stalwart + Bulwark (server3) have their OWN backups.
# Cron misol (har kuni 03:00):
#   0 3 * * * /Users/bro/hermes-adlc/selfhost/backup/backup.sh >> /var/log/selfhost-backup.log 2>&1
set -euo pipefail

BACKUP_ROOT="/var/backups/selfhost"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"
RETENTION_DAYS=14
mkdir -p "${DEST}"

DOCMOST_DIR="/Users/bro/hermes-adlc/selfhost/server1-plane-docs/docmost"

echo "[$(date)] backup start -> ${DEST}"

# --- Docmost: postgres dump ---
docker compose -f "${DOCMOST_DIR}/docker-compose.yml" exec -T db \
  pg_dump -U docmost docmost | gzip > "${DEST}/docmost-db.sql.gz"

# --- Docmost: storage volume (attachments) ---
docker run --rm \
  -v docmost_docmost:/data:ro \
  -v "${DEST}":/backup alpine \
  tar czf /backup/docmost-storage.tar.gz -C /data .

# --- Plane: use its own backup, then copy out ---
# setup.sh menu 7 dumps to plane-app/backup; here we tar the data volumes directly.
for vol in $(docker volume ls -q | grep -E '^plane-app_'); do
  docker run --rm -v "${vol}":/data:ro -v "${DEST}":/backup alpine \
    tar czf "/backup/${vol}.tar.gz" -C /data . 2>/dev/null || true
done

# --- retention ---
find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

echo "[$(date)] backup done. size: $(du -sh "${DEST}" | cut -f1)"

# ---------------------------------------------------------------------------
# SERVER 2 (GitLab):  sudo docker exec gitlab gitlab-backup create
#   -> /var/lib/gitlab backups; cron: 0 2 * * * docker exec gitlab gitlab-backup create CRON=1
#   + /etc/gitlab config'ni alohida nusxala (gitlab-secrets.json, gitlab.rb).
# SERVER 3 (Stalwart + Bulwark):
#   /opt/aibus/selfhost/server3-stalwart-bulwark/backup.sh
#   cron: 0 2 * * * BACKUP_ROOT=/var/backups/aibus-mail /opt/aibus/selfhost/server3-stalwart-bulwark/backup.sh
# ---------------------------------------------------------------------------
