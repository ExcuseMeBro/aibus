#!/usr/bin/env bash
# Consistent single-node backup for Stalwart + Bulwark named volumes.
# Restoring is a manual, destructive operation documented in DEPLOY.md.
set -euo pipefail
umask 077

DEFAULT_STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_DIR="${STACK_DIR:-${DEFAULT_STACK_DIR}}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/aibus-mail}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
DEST="${BACKUP_ROOT}/${STAMP}"
ALPINE_IMAGE="alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce"
VOLUMES=(
  aibus-stalwart-config
  aibus-stalwart-data
  aibus-bulwark-settings
  aibus-bulwark-admin
  aibus-bulwark-admin-state
  aibus-bulwark-telemetry
)

mkdir -p "${DEST}"
chmod 0700 "${BACKUP_ROOT}" "${DEST}"
cd "${STACK_DIR}"

restart_stack() {
  status=$?
  trap - EXIT
  if ! docker compose start; then
    echo "[$(date -u +%FT%TZ)] ERROR: mail stack restart failed" >&2
    exit 1
  fi
  exit "${status}"
}

trap restart_stack EXIT
echo "[$(date -u +%FT%TZ)] stopping mail stack for a consistent snapshot"
docker compose stop

for volume in "${VOLUMES[@]}"; do
  docker volume inspect "${volume}" >/dev/null
  docker run --rm \
    -v "${volume}:/data:ro" \
    -v "${DEST}:/backup" \
    "${ALPINE_IMAGE}" \
    tar czf "/backup/${volume}.tar.gz" -C /data .
done

docker compose start
trap - EXIT
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf -- {} +
echo "[$(date -u +%FT%TZ)] backup complete: ${DEST}"
