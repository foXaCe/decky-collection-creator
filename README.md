# Collection Manager (Decky plugin)

A small Steam Deck plugin that creates and applies **Steam collections** from the Quick Access Menu, plus a local
service you can drive from a script.

Steam exposes **no API for collections** (unlike shortcuts and artwork, which Decky plugins can change live). The only
place collections live is `localconfig.vdf`, which Steam rewrites from memory while it runs. So this plugin ships a
companion service that:

1. stops Steam,
2. writes the collection into `localconfig.vdf` (backup made first),
3. starts Steam again.

Because of that, collections can only be applied in **Desktop Mode**. In Gaming Mode Steam is supervised and restarted
instantly, so the panel tells you to switch.

## Requirements

- Steam Deck / SteamOS with **Decky Loader**
- Python 3 (already present on SteamOS)

## Install

```bash
git clone <this repo> && cd decky-collection-creator
./install.sh
```

Then restart Decky (or Steam). The plugin appears in the Quick Access Menu as **Collection Manager**.

Manual install: copy `plugin/` to `~/homebrew/plugins/collection-creator/`, copy `service/collectiond.py` to
`~/Games/_tools/`, copy `service/collectiond.service` to `~/.config/systemd/user/`, then
`systemctl --user enable --now collectiond`.

## Use

Open the Quick Access Menu → **Collection Manager**:

- the list of your collections (name + number of games),
- **New collection**: type a name, *Create and apply* → Steam restarts with the new (empty) collection,
- **Apply**: restart Steam to pick up changes made through the API.

Games are added through the API (the panel creates empty collections; Steam's own UI can add games afterwards, or a
script can pass appids).

## API (localhost:8731)

| Method | Path | Body | Effect |
|---|---|---|---|
| GET | `/status` | – | `{mode, steam, collections[]}` |
| GET | `/collections` | – | `{collections[]}` |
| POST | `/apply` | `{}` | stop Steam, restart Steam |
| POST | `/apply` | `{"name": "Mario", "appids": [...]}` | upsert collection during the stopped window, then restart |
| POST | `/collections` | `{"name": "...", "appids": [...]}` | write immediately (caller must have stopped Steam) |

App ids are accepted signed (Steam shortcut ids, e.g. `-1436474168`) or unsigned (`2858493128`).

```bash
# create/patch a collection without touching the panel
curl -X POST 127.0.0.1:8731/apply \
     -H 'Content-Type: application/json' \
     -d '{"name":"Mario","appids":[-1436474168,-2021531861]}'
```

## Files

```
plugin/          Decky plugin (plugin.json, main.py, dist/index.js)
service/         collectiond.py + systemd user unit
install.sh       installer
```

`collectiond` logs to `~/Games/_tools/collectiond.log`; every write leaves
`localconfig.vdf.bak-<timestamp>` next to the original.

## Limitations

- Desktop Mode only (see above).
- Steam restarts when you apply — that is unavoidable, Steam reads collections at startup.
- Collections are per Steam account, stored in `userdata/<id>/config/localconfig.vdf`.

## Licence

MIT.
