#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <database_name> [--remote]"
  exit 1
fi

DB_NAME="$1"
REMOTE_FLAG=""

if [ "$#" -eq 2 ] && [ "$2" = "--remote" ]; then
  REMOTE_FLAG="--remote"
fi

tables=$(pnpm exec wrangler d1 execute "$DB_NAME" \
  --json \
  $REMOTE_FLAG \
  --command "SELECT * FROM sqlite_master WHERE type='table';" \
  | jq -r ".[0].results[].name")

sql_file=$(mktemp)

echo "PRAGMA foreign_keys = OFF;" > "$sql_file"
for table in $tables; do
  if [[ $table != _cf_* && $table != "sqlite_sequence" ]]; then
    echo "DROP TABLE IF EXISTS \"$table\";" >> "$sql_file"
  fi
done
echo "DELETE FROM sqlite_sequence;" >> "$sql_file"

pnpm exec wrangler d1 execute "$DB_NAME" $REMOTE_FLAG --file "$sql_file"

echo "All tables dropped (except _cf_* and sqlite_sequence) from database '$DB_NAME'."
