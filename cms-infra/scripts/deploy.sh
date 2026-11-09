#!/usr/bin/env bash
# 07-OPS-ARCH §11.2 — blue/green-lite deploy on a single VM.
# Usage: ./scripts/deploy.sh <version>      (run as `deploy` from /opt/cms)
set -euo pipefail

VERSION="${1:?usage: deploy.sh <version>}"
REPO="${CMS_INFRA_REPO:-https://github.com/org/cms-infra.git}"
RELEASE_DIR="/opt/cms/releases/${VERSION}"
ENV_FILE="/opt/cms/shared/env/.env.production"
WEB_DIST_IMAGE="${CMS_WEB_DIST_IMAGE:-ghcr.io/org/cms-web-dist:${VERSION}}"
API_IMAGE="${CMS_API_IMAGE_REPO:-ghcr.io/org/cms-api}:${VERSION}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env)

if [[ "$(date -u +%u)" == "5" && "${ALLOW_FRIDAY:-no}" != "yes" ]]; then
  echo "Friday deploys are prohibited (§11.5). Set ALLOW_FRIDAY=yes for an emergency hotfix." >&2
  exit 1
fi

echo "==> Preparing release ${VERSION}"
if [[ ! -d "${RELEASE_DIR}/.git" ]]; then
  git clone --depth 1 --branch "v${VERSION}" "${REPO}" "${RELEASE_DIR}"
fi
ln -sf "${ENV_FILE}" "${RELEASE_DIR}/.env"
cd "${RELEASE_DIR}"
sed -i "s|^CMS_API_IMAGE=.*|CMS_API_IMAGE=${API_IMAGE}|" "${ENV_FILE}"

echo "==> Verifying image signature (cosign)"
cosign verify \
  --certificate-identity-regexp='^https://github.com/org/cms-api/' \
  --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
  "${API_IMAGE}" >/dev/null

echo "==> Pulling images"
CMS_API_IMAGE="${API_IMAGE}" "${COMPOSE[@]}" pull

echo "==> Extracting SPA assets"
rm -rf web-dist && mkdir web-dist
cid=$(docker create "${WEB_DIST_IMAGE}" /noop)
docker cp "${cid}:/." web-dist/ && docker rm "${cid}" >/dev/null

echo "==> Pre-deploy backup"
/opt/cms/current/scripts/backup-postgres.sh pre-deploy || { echo "backup failed — aborting" >&2; exit 1; }

echo "==> Running DB migrations (forward-compatible only, §12.2)"
CMS_API_IMAGE="${API_IMAGE}" "${COMPOSE[@]}" run --rm --no-deps \
  -e DATABASE_URL -e MIGRATION_DATABASE_URL cms-api node dist/scripts/migrate.js

PREVIOUS=$(readlink -f /opt/cms/current || true)
echo "==> Switching symlink (previous: ${PREVIOUS:-none})"
ln -sfn "${RELEASE_DIR}" /opt/cms/current
echo "${PREVIOUS}" > /opt/cms/shared/previous-release

echo "==> Starting services"
cd /opt/cms/current
CMS_API_IMAGE="${API_IMAGE}" "${COMPOSE[@]}" up -d --remove-orphans

echo "==> Waiting for health"
./scripts/wait-for-healthy.sh cms-api 120
./scripts/wait-for-healthy.sh cms-worker 120
./scripts/wait-for-healthy.sh cms-nginx 60

echo "==> Post-deploy smoke tests (G-08 starts now: watch dashboards for 15 min)"
if ! ./scripts/smoke-test.sh "${PUBLIC_URL:-https://$(grep ^SERVER_NAME= .env | cut -d= -f2)}"; then
  echo "Smoke tests failed — rolling back" >&2
  [[ -n "${PREVIOUS}" ]] && ./scripts/rollback.sh "$(basename "${PREVIOUS}")"
  exit 1
fi

echo "==> Deployment ${VERSION} complete"
echo "==> Pruning old releases (keep last 3)"
ls -1dt /opt/cms/releases/*/ | tail -n +4 | xargs -r rm -rf
