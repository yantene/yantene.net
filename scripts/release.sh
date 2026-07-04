#!/usr/bin/env bash
set -euo pipefail

# --- Safety checks ---

# 1. Must be on main branch
CURRENT_BRANCH=$(git symbolic-ref -q --short HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Release must be run from the 'main' branch (current: $CURRENT_BRANCH)" >&2
  exit 1
fi

# 2. Must be up to date with remote
git fetch --tags origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "Error: Local main is not up to date with origin/main." >&2
  echo "  local:  $LOCAL" >&2
  echo "  remote: $REMOTE" >&2
  echo "Run 'git pull' first." >&2
  exit 1
fi

# 3. Working tree must be clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree has uncommitted changes (including untracked files). Commit, add, or stash them first." >&2
  exit 1
fi

# --- Determine tag ---

TODAY=$(date +%Y.%m.%d)

LATEST_SEQ=$(git tag -l "v${TODAY}.*" | sed -n 's/.*\.\([0-9][0-9]*\)$/\1/p' | sort -n | tail -1)
if [ -z "$LATEST_SEQ" ]; then
  SEQ=1
else
  SEQ=$((LATEST_SEQ + 1))
fi

TAG="v${TODAY}.${SEQ}"

# 4. Confirmation prompt (skip with --yes)
if [ "${1:-}" != "--yes" ]; then
  read -r -p "Create release ${TAG}? [y/N] " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

# --- Create release ---

echo "Creating release ${TAG}..."
git tag -a "$TAG" -m "$TAG"
git push origin "$TAG"
gh release create "$TAG" \
  --title "$TAG" \
  --generate-notes \
  --latest
