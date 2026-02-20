#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <bucket_name>"
  exit 1
fi

BUCKET_NAME="$1"
STORAGE_DIR="./storage"

if [ ! -d "$STORAGE_DIR" ]; then
  echo "Error: storage/ directory not found"
  exit 1
fi

file_count=0

while IFS= read -r -d '' file; do
  key="${file#"$STORAGE_DIR"/}"
  content_type=$(file --brief --mime-type "$file")

  echo "Uploading: $key (${content_type})"
  pnpm exec wrangler r2 object put "${BUCKET_NAME}/${key}" \
    --file "$file" \
    --content-type "$content_type" \
    --local

  file_count=$((file_count + 1))
done < <(find "$STORAGE_DIR" -type f -not -name ".gitkeep" -print0)

echo "Done: ${file_count} file(s) uploaded to '${BUCKET_NAME}' (local)."
