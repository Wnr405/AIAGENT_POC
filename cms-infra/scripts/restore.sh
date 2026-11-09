#!/usr/bin/env bash
# 07-OPS-ARCH §13.4 — restore Postgres from a restic snapshot (RTO ≤ 4 h).
# Usage: ./scripts/restore.sh <snapshot-id|latest>
set -euo pipefail
SNAPSHOT="${1:?usage: restore.sh <snapshot-id|latest>}"
set -a; source /opt/cms/current/.env; set +a
export RESTIC_REPOSITORY="s3:s3.${BACKUP_S3_REGION}.amazonaws.com/${BACKUP_S3_BUCKET}/postgres"
export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env)
cd /opt/cms/current

read -r -p "This REPLACES the production database with snapshot ${SNAPSHOT}. Type 'restore' to continue: " ok
[[ "${ok}" == "restore" ]] || exit 1

WORK=$(mktemp -d)
restic restore "${SNAPSHOT}" --target "${WORK}"
DUMP=$(find "${WORK}" -name 'cms-*.dump' | sort | tail -1)
[[ -f "${DUMP}" ]] || { echo "no dump in snapshot" >&2; exit 1; }

"${COMPOSE[@]}" stop cms-api cms-worker
docker exec cms-postgres dropdb -U "${POSTGRES_USER}" --if-exists "${POSTGRES_DB}"
docker exec cms-postgres createdb -U "${POSTGRES_USER}" "${POSTGRES_DB}"
docker exec -i cms-postgres pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner < "${DUMP}"
"${COMPOSE[@]}" run --rm --no-deps cms-api node dist/scripts/migrate.js   # re-apply grants
"${COMPOSE[@]}" up -d cms-api cms-worker
./scripts/wait-for-healthy.sh cms-api 120
./scripts/smoke-test.sh "https://${SERVER_NAME}"
rm -rf "${WORK}"
echo "Restore complete. Record the drill/incident in RESTORE-DRILLS.md."
