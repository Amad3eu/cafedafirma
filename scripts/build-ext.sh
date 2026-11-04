#!/usr/bin/env bash
# Sincroniza os arquivos compartilhados da extensão (chrome -> firefox),
# regenera os ícones e empacota os zips para Chrome/Edge e Firefox.
#
# Regra: `extension/chrome` é a fonte da verdade. Em `extension/firefox` só o
# manifest.json é próprio (id do Gecko, background.scripts). Todo o resto é
# copiado daqui — então edite apenas em chrome/ e rode este script.
set -euo pipefail
cd "$(dirname "$0")/.."

SHARED=(background.js popup.html popup.css popup.js options.html options.css options.js)
for file in "${SHARED[@]}"; do
  cp "extension/chrome/$file" "extension/firefox/$file"
done

node scripts/make-icons.cjs

rm -f public/extensao-cafe-chrome.zip public/extensao-cafe-firefox.zip
mkdir -p public

# `zip` nem sempre existe (ex.: imagens mínimas); python3 traz zipfile de fábrica.
pack() {
  local src="$1" out="$2"
  if command -v zip >/dev/null 2>&1; then
    (cd "$src" && zip -r -q "../../$out" . -x '.*')
  else
    python3 - "$src" "$out" <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for name in sorted(files):
            if name.startswith("."):
                continue
            full = os.path.join(root, name)
            zf.write(full, os.path.relpath(full, src))
PY
  fi
}

pack extension/chrome public/extensao-cafe-chrome.zip
pack extension/firefox public/extensao-cafe-firefox.zip

echo "zips gerados em public/:"
ls -lh public/*.zip
