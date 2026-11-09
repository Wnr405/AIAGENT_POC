#!/usr/bin/env bash
# One-time: create the media bucket, deny anonymous access (SEC-06), create the app's access key.
set -euo pipefail
set -a; source /opt/cms/current/.env; set +a
docker run --rm --network cms_cms-internal \
  -e MC_HOST_local="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  --entrypoint /bin/sh minio/mc:RELEASE.2024-11-21T17-21-54Z -c "
    mc mb --ignore-existing local/${OBJECT_STORAGE_BUCKET} &&
    mc anonymous set none local/${OBJECT_STORAGE_BUCKET} &&
    mc version enable local/${OBJECT_STORAGE_BUCKET} &&
    (mc admin user add local ${OBJECT_STORAGE_ACCESS_KEY} ${OBJECT_STORAGE_SECRET_KEY} || true) &&
    mc admin policy attach local readwrite --user ${OBJECT_STORAGE_ACCESS_KEY} || true"
