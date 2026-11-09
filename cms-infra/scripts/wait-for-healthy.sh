#!/usr/bin/env bash
# 07-OPS-ARCH §22.3
set -euo pipefail
SVC="${1:?service required}"
TIMEOUT="${2:-60}"
status="missing"
deadline=$(( SECONDS + TIMEOUT ))
while (( SECONDS < deadline )); do
  status=$(docker inspect --format='{{.State.Health.Status}}' "${SVC}" 2>/dev/null || echo "missing")
  if [[ "${status}" == "healthy" ]]; then
    echo "${SVC} is healthy"
    exit 0
  fi
  sleep 2
done
echo "Timed out waiting for ${SVC} (last status: ${status})" >&2
docker logs --tail=100 "${SVC}" >&2 || true
exit 1
