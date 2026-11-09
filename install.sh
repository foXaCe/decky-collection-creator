#!/usr/bin/env bash
# Collection Creator — installer (Steam Deck / SteamOS, Decky Loader required)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$HOME/homebrew/plugins/collection-creator"

if [ ! -f "$HERE/plugin/dist/index.js" ]; then
  echo "plugin/dist/index.js missing — build it first: cd plugin && pnpm install && pnpm build"
  exit 1
fi

echo "→ plugin : $PLUGIN_DIR"
sudo rm -rf "$PLUGIN_DIR"
sudo mkdir -p "$PLUGIN_DIR"
sudo cp -r "$HERE/plugin/plugin.json" "$HERE/plugin/main.py" "$HERE/plugin/package.json" "$HERE/plugin/dist" "$PLUGIN_DIR/"
sudo chown -R root:root "$PLUGIN_DIR"
sudo chmod -R a+rX "$PLUGIN_DIR"

echo "Done. Restart Decky (or Steam) so the panel loads."
