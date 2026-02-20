#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <bucket_name>"
  exit 1
fi

BUCKET_NAME="$1"
R2_STATE_DIR=".wrangler/state/v3/r2"

if [ ! -d "$R2_STATE_DIR" ]; then
  echo "No local R2 state found. Nothing to empty."
  exit 0
fi

echo "Emptying local bucket '${BUCKET_NAME}'..."

# Remove bucket-specific blob storage
if [ -d "${R2_STATE_DIR}/${BUCKET_NAME}" ]; then
  rm -rf "${R2_STATE_DIR}/${BUCKET_NAME}"
  echo "Removed blob storage: ${R2_STATE_DIR}/${BUCKET_NAME}/"
fi

# Remove miniflare R2 metadata (shared SQLite for all local buckets)
if [ -d "${R2_STATE_DIR}/miniflare-R2BucketObject" ]; then
  rm -rf "${R2_STATE_DIR}/miniflare-R2BucketObject"
  echo "Removed metadata: ${R2_STATE_DIR}/miniflare-R2BucketObject/"
fi

echo "Done: local R2 state cleared."
echo "Note: the dev server will recreate the state directory on next start."
