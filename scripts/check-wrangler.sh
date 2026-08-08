#!/usr/bin/env bash
#
# 全環境の Cloudflare Workers 設定を「ビルド → wrangler deploy --dry-run」で検証する。
#
# wrangler.jsonc の main (workers/app.ts) を直接 dry-run すると、React Router が
# Vite プラグインで供給する `virtual:react-router/server-build` を wrangler の
# バンドラが解決できずに失敗する。実際のデプロイ (deploy:staging / deploy:production)
# と同じく、ビルド成果物とそれに付随する build/server/wrangler.json を対象にする。
set -euo pipefail

BUILT_CONFIG="build/server/wrangler.json"

for env in development staging production; do
  echo "==> ${env}"
  if [ "${env}" = "development" ]; then
    pnpm run build
  else
    CLOUDFLARE_ENV="${env}" pnpm run build
  fi

  if [ ! -f "${BUILT_CONFIG}" ]; then
    echo "✘ ${BUILT_CONFIG} が生成されていない (${env})" >&2
    exit 1
  fi

  wrangler deploy --dry-run -c "${BUILT_CONFIG}"
done

echo "✓ development / staging / production の設定を検証した"
