#!/usr/bin/env bash
# 07-OPS-ARCH §13.2 — hourly pg_dump, verified, shipped off-site with restic (RPO ≤ 1 h, NFR-AVAIL-02).
set -euo pipefail
set -a; source /opt/cms/current/.env; set +a
TAG="${1:-hourly}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
DIR="/var/lib/cms/backups/postgres/hourly"
FILE="${DIR}/cms-${TS}.dump"
mkdir -p "${DIR}"

docker exec cms-postgres pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --format=custom --compress=9 > "${FILE}"
docker exec -i cms-postgres pg_restore --list < "${FILE}" > /dev/null   # verify readable

export RESTIC_REPOSITORY="s3:s3.${BACKUP_S3_REGION}.amazonaws.com/${BACKUP_S3_BUCKET}/postgres"
export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}"
restic snapshots >/dev/null 2>&1 || restic init
restic backup "${FILE}" --tag "${TAG}" --tag "v${APP_VERSION}" --quiet
restic forget --keep-hourly "${BACKUP_RETENTION_HOURLY}" --keep-daily "${BACKUP_RETENTION_DAILY}" --keep-weekly "${BACKUP_RETENTION_WEEKLY}" --prune --quiet

find "${DIR}" -name 'cms-*.dump' -mmin +1440 -delete
# node-exporter textfile collector → BackupMissing alert (07-OPS-ARCH §15.3)
mkdir -p /var/lib/cms/backups/metrics
echo "cms_backup_last_success_timestamp_seconds{target=\"postgres\"} $(date -u +%s)" > /var/lib/cms/backups/metrics/cms_backup.prom.tmp
mv /var/lib/cms/backups/metrics/cms_backup.prom.tmp /var/lib/cms/backups/metrics/cms_backup.prom
echo "backup ok: ${FILE}"
