#!/usr/bin/env bash
# Collection Manager — installer (Steam Deck / SteamOS, Decky Loader required)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$HOME/homebrew/plugins/collection-manager"

echo "→ plugin  : $PLUGIN_DIR"
sudo mkdir -p "$PLUGIN_DIR"
sudo rm -rf "$PLUGIN_DIR"/*
sudo cp -r "$HERE/plugin/." "$PLUGIN_DIR/"
sudo chown -R root:root "$PLUGIN_DIR"
sudo chmod -R a+rX "$PLUGIN_DIR"

echo "→ service : collectiond"
mkdir -p "$HOME/Games/_tools" "$HOME/.config/systemd/user"
cp "$HERE/service/collectiond.py" "$HOME/Games/_tools/collectiond.py"
chmod +x "$HOME/Games/_tools/collectiond.py"
cp "$HERE/service/collectiond.service" "$HOME/.config/systemd/user/collectiond.service"
systemctl --user daemon-reload
systemctl --user enable --now collectiond

echo "→ test    :"
sleep 1
curl -s 127.0.0.1:8731/status | head -c 200 || true
echo
echo "Done. Restart Decky (or Steam) so the panel loads."
