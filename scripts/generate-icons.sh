#!/usr/bin/env bash
#
# public/icons/icon.svg から各種アイコンを起こす。
#
# 素材を差し替えたときに走らせる。生成物もリポジトリに入れてあるので、普段の開発や
# CI で実行する必要はない (rsvg-convert と ImageMagick が要るため、環境を選ぶ)。
#
#   ./scripts/generate-icons.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

readonly SOURCE="public/icons/icon.svg"
readonly OUT_DIR="public/icons"

for cmd in rsvg-convert magick; do
  if ! command -v "$cmd" > /dev/null; then
    echo "$cmd が要る (rsvg-convert: librsvg / magick: ImageMagick 7)" >&2
    exit 1
  fi
done

echo "→ ${OUT_DIR}/icon-192.png"
rsvg-convert -w 192 -h 192 "$SOURCE" -o "${OUT_DIR}/icon-192.png"

echo "→ ${OUT_DIR}/icon-512.png"
rsvg-convert -w 512 -h 512 "$SOURCE" -o "${OUT_DIR}/icon-512.png"

# iOS はホーム画面で角を丸めるが余白は足さないので、素材をそのまま使う。
echo "→ ${OUT_DIR}/apple-touch-icon.png"
rsvg-convert -w 180 -h 180 "$SOURCE" -o "${OUT_DIR}/apple-touch-icon.png"

# maskable 用の別画像は作らない。Android は円などに切り抜くが、素材は顔が中央にあり、
# 安全域 (中央 80% の円) で切っても目も口も残る。余白を足すと顔が縮んで弱くなるだけなので、
# icon-512.png を maskable としても使う (manifest 側で purpose を指定)。

# favicon はタブに出る小ささなので、複数の大きさを 1 つに束ねる。
echo "→ public/favicon.ico"
magick "${OUT_DIR}/icon-512.png" -define icon:auto-resize=48,32,16 public/favicon.ico

echo "できあがり:"
ls -la "${OUT_DIR}"/*.png public/favicon.ico
