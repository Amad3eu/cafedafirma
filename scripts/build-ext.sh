#!/usr/bin/env bash
# Regenera os ícones e empacota a extensão para Chrome/Edge e Firefox.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/make-icons.cjs

rm -f public/extensao-cafe-chrome.zip public/extensao-cafe-firefox.zip
mkdir -p public

(cd extension/chrome && zip -r -q ../../public/extensao-cafe-chrome.zip . -x '.*')
(cd extension/firefox && zip -r -q ../../public/extensao-cafe-firefox.zip . -x '.*')

echo "zips gerados em public/:"
ls -lh public/*.zip
