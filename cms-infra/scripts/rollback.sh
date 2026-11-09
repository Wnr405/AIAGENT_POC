#!/usr/bin/env bash
# 07-OPS-ARCH §11.3 — re-point `current` to a previous release and recreate containers.
# Works only because every migration is backward compatible (§12.2).
set -euo pipefail
PREV_VERSION="${1:-$(basename "$(cat /opt/cms/shared/previous-release)")}"
TARGET="/opt/cms/releases/${PREV_VERSION}"
[[ -d "${TARGET}" ]] || { echo "release ${PREV_VERSION} not found" >&2; exit 1; }
ENV_FILE="/opt/cms/shared/env/.env.production"
sed -i "s|^CMS_API_IMAGE=.*|CMS_API_IMAGE=${CMS_API_IMAGE_REPO:-ghcr.io/org/cms-api}:${PREV_VERSION}|" "${ENV_FILE}"
ln -sfn "${TARGET}" /opt/cms/current
cd /opt/cms/current
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d
./scripts/wait-for-healthy.sh cms-api 120
./scripts/smoke-test.sh "https://$(grep ^SERVER_NAME= .env | cut -d= -f2)"
echo "Rolled back to ${PREV_VERSION}"
