#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed. Please install jq."
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <database_name> [wrangler flags...]"
  echo "  e.g. $0 my-db --remote --env staging"
  exit 1
fi

# 1 番目を DB 名として取り出し、残りは wrangler d1 execute へそのまま透過する。
# --remote だけでなく --env staging / --env production も渡せるようにし、
# migrate と同じ解決コンテキストで drop する (reset の drop/migrate 不整合を防ぐ)。
DB_NAME="$1"
shift
wrangler_args=("$@")

tables=$(pnpm exec wrangler d1 execute "$DB_NAME" \
  --json \
  "${wrangler_args[@]}" \
  --command "SELECT * FROM sqlite_master WHERE type='table';" \
  | jq -r ".[0].results[].name")

sql_file=$(mktemp)
trap 'rm -f "$sql_file"' EXIT

echo "PRAGMA foreign_keys = OFF;" > "$sql_file"
for table in $tables; do
  if [[ $table != _cf_* && $table != "sqlite_sequence" ]]; then
    echo "DROP TABLE IF EXISTS \"$table\";" >> "$sql_file"
  fi
done
echo "DELETE FROM sqlite_sequence;" >> "$sql_file"

pnpm exec wrangler d1 execute "$DB_NAME" "${wrangler_args[@]}" --file "$sql_file"

echo "All tables dropped (except _cf_* and sqlite_sequence) from database '$DB_NAME'."
