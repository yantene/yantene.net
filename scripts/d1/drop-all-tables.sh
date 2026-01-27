#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed. Please install jq."
  exit 1
fi

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <database_name> [--remote]"
  exit 1
fi

DB_NAME="$1"
remote_args=()

if [ "$#" -eq 2 ] && [ "$2" = "--remote" ]; then
  remote_args+=("--remote")
fi

tables=$(pnpm exec wrangler d1 execute "$DB_NAME" \
  --json \
  "${remote_args[@]}" \
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

pnpm exec wrangler d1 execute "$DB_NAME" "${remote_args[@]}" --file "$sql_file"

echo "All tables dropped (except _cf_* and sqlite_sequence) from database '$DB_NAME'."
