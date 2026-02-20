#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <bucket_name> [--remote]"
  exit 1
fi

BUCKET_NAME="$1"
IS_REMOTE=false

if [ "$#" -eq 2 ]; then
  if [ "$2" = "--remote" ]; then
    IS_REMOTE=true
  else
    echo "Error: second argument must be --remote"
    exit 1
  fi
fi

if [ "$IS_REMOTE" = true ]; then
  if ! command -v aws &> /dev/null; then
    echo "Error: aws CLI is required but not installed."
    echo "Install it: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
  fi

  ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
  if [ -z "$ACCOUNT_ID" ]; then
    ACCOUNT_ID=$(node -e "
      const fs = require('fs');
      try {
        const data = JSON.parse(fs.readFileSync('node_modules/.cache/wrangler/wrangler-account.json', 'utf8'));
        process.stdout.write(data.account.id);
      } catch { process.exit(1); }
    " 2>/dev/null) || true
  fi

  if [ -z "$ACCOUNT_ID" ]; then
    echo "Error: CLOUDFLARE_ACCOUNT_ID is required for remote operations."
    echo "Set it via environment variable or run 'wrangler whoami' first."
    exit 1
  fi

  if [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
    echo "Error: R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for remote operations."
    echo "Create R2 API tokens at: https://dash.cloudflare.com/ > R2 > Manage R2 API Tokens"
    exit 1
  fi

  ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

  echo "Emptying remote bucket '${BUCKET_NAME}'..."
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 rm "s3://${BUCKET_NAME}" --recursive --endpoint-url "$ENDPOINT"
  echo "Done: remote bucket '${BUCKET_NAME}' emptied."
else
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
fi
