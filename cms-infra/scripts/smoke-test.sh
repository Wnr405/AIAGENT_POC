#!/usr/bin/env bash
# 07-OPS-ARCH §22.2 / 06-TEST-STRATEGY §9.3 — post-deploy smoke checks (gate G-06/G-08).
set -euo pipefail
BASE="${1:-https://cms.example.com}"
KEY="${SMOKE_API_KEY:-$(grep -s ^SMOKE_API_KEY= /opt/cms/current/.env | cut -d= -f2 || true)}"

check() { printf '%-55s' "$1"; shift; if "$@" >/dev/null 2>&1; then echo ok; else echo FAIL; exit 1; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "1. /healthz responds ok"                      curl -fsS "${BASE}/healthz"
check "2. public API without key → 401"              test "$(code "${BASE}/api/v1/articles")" = "401"
if [[ -n "${KEY}" ]]; then
  check "3. public API with key → 200 + envelope"    bash -c "curl -fsS -H 'X-API-Key: ${KEY}' '${BASE}/api/v1/articles' | jq -e '.pagination.page == 1'"
fi
check "4. admin API without token → 401"             test "$(code "${BASE}/api/admin/content")" = "401"
check "5. admin SPA served"                          bash -c "curl -fsS '${BASE}/' | grep -qi '<title'"
check "6. security headers present (SEC-02)"         bash -c "curl -sI '${BASE}/' | grep -qi 'strict-transport-security'"
check "7. OpenAPI published (FR-PUBAPI-07)"          bash -c "curl -fsS '${BASE}/api/docs/openapi.json' | jq -e '.openapi'"
check "8. /api/dev is not exposed"                   test "$(code "${BASE}/api/dev/storage/x")" = "404"
echo "All smoke checks passed."
