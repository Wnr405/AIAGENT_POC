#!/usr/bin/env bash
# 07-OPS-ARCH §13.3 — daily mirror of the media bucket off-site.
set -euo pipefail
set -a; source /opt/cms/current/.env; set +a
if [[ "${OBJECT_STORAGE_PROVIDER}" == "minio" ]]; then
  docker run --rm --network cms_cms-internal \
    -e MC_HOST_src="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
    -e MC_HOST_dst="https://${BACKUP_S3_ACCESS_KEY}:${BACKUP_S3_SECRET_KEY}@s3.${BACKUP_S3_REGION}.amazonaws.com" \
    minio/mc:RELEASE.2024-11-21T17-21-54Z mirror --overwrite --remove "src/${OBJECT_STORAGE_BUCKET}" "dst/${BACKUP_S3_BUCKET}/media"
else
  aws s3 sync "s3://${OBJECT_STORAGE_BUCKET}" "s3://${BACKUP_S3_BUCKET}/media" --delete
fi
date -u +%s > /var/lib/cms/backups/.media-last-success
