#!/bin/sh
# Usage: new.sh <dir>  scaffold a narrated video dir (script.json, video.tsx, assets/) and install the kit once.
set -e
skill=$(cd "$(dirname "$0")/.." && pwd)
[ -n "$1" ] || { echo "usage: new.sh <dir>" >&2; exit 1; }
mkdir -p "$1/assets"
[ -d "$skill/node_modules/remotion" ] || (cd "$skill" && npm ci --no-audit --no-fund >/dev/null && npx playwright install --only-shell chromium)
[ -x "$skill/.venv/bin/python" ] || { python3 -m venv "$skill/.venv" && "$skill/.venv/bin/pip" install -q numpy faster-whisper; } || { rm -rf "$skill/.venv" && uv venv -q "$skill/.venv" && uv pip install -q --python "$skill/.venv/bin/python" numpy faster-whisper; }
[ -e "$1/script.json" ] || cp "$skill/template/script.json" "$1/"
[ -e "$1/video.tsx" ] || cp "$skill/template/video.tsx" "$1/"
echo "$1: write script.json, then: $skill/.venv/bin/python $skill/scripts/voice.py $1 (background) and node $skill/scripts/dev.mjs $1 --port <p>"
