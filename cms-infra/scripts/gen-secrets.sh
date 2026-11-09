#!/usr/bin/env bash
# 07-OPS-ARCH §8.3 — prints freshly generated secrets for a new .env. Never commit the output.
set -euo pipefail
pw() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }
PG=$(pw); APP=$(pw); REDIS=$(pw)
cat <<OUT
POSTGRES_PASSWORD=${PG}
POSTGRES_APP_PASSWORD=${APP}
DATABASE_URL=postgresql://cms_app:${APP}@postgres:5432/cms?schema=public&connection_limit=10
MIGRATION_DATABASE_URL=postgresql://cms:${PG}@postgres:5432/cms?schema=public
REDIS_PASSWORD=${REDIS}
REDIS_URL=redis://default:${REDIS}@redis:6379
JWT_SECRET=$(openssl rand -hex 32)
MINIO_ROOT_USER=cms-$(pw 8)
MINIO_ROOT_PASSWORD=$(pw 32)
RESTIC_PASSWORD=$(pw 40)
OUT
