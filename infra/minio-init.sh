#!/bin/sh
set -eu

alias_ready=0
i=0
while [ "$i" -lt 30 ]; do
  if mc alias set local http://minio:9000 "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"; then
    alias_ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$alias_ready" -ne 1 ]; then
  echo "MinIO did not become ready" >&2
  exit 1
fi

mc mb --ignore-existing "local/$S3_BUCKET"
mc anonymous set none "local/$S3_BUCKET"
