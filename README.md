# Collection Creator (Decky plugin)

Create and fill **Steam collections** from the Quick Access Menu, **live** — no Steam restart, no file editing.

It uses Steam's own in-client `collectionStore` module (the same one ROM Sync uses): a collection is created with
`NewUnsavedCollection()`, games are added through `AsDragDropCollection().AddApps()`, then `Save()`. Steam updates its
library immediately.

## Features

- list of your Steam collections with game counts,
- create a collection and fill it from a **title filter** (e.g. name `Zelda`, filter `zelda` → every game whose title
  contains “zelda”),
- bilingual **French / English** (follows the Steam client language),
- works in Gaming Mode and Desktop Mode.

## Install

Requires [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader).

```bash
git clone https://github.com/foXaCe/decky-collection-creator.git
cd decky-collection-creator
./install.sh          # builds nothing: uses plugin/dist/index.js
```

Or build and install by hand:

```bash
cd plugin && pnpm install && pnpm build
```

then copy `plugin/plugin.json`, `plugin/main.py`, `plugin/package.json` and `plugin/dist/` to
`~/homebrew/plugins/collection-creator/` (owner `root`, readable by all), and restart Decky.

## Use

Quick Access Menu → **Decky** → **Collection Creator**:

| Field | Meaning |
|---|---|
| **Collection name** | the collection to create (or to add to, if it already exists) |
| **Games whose title contains** | optional filter; defaults to the collection name |

Press **Create / fill**. Games are matched against your **non-Steam shortcuts** (your emulated library, the recomps,
etc.). The collection appears in the library sidebar right away.

## How it works

```
collectionStore.userCollections.find(c => c.displayName === name)
  ?? collectionStore.NewUnsavedCollection(name, undefined, [])
collection.AsDragDropCollection().AddApps([{ appid }, …])
await collection.Save()
```

`collectionStore` is not in the `@decky/ui` typings: it is a global of the Steam client. The plugin is defensive about
its shape (`deckDesktopApps` / `localGamesCollection` / `allAppsCollection`) because those names have moved between
Steam versions.

## Layout

```
plugin/          Decky plugin (TypeScript + @decky/ui, built with rollup)
  src/index.tsx  panel, i18n, collectionStore calls
  dist/index.js  built bundle
install.sh       copies the plugin into ~/homebrew/plugins
```

## Limitations

- Relies on an **undocumented Steam module**; a future client update may rename it (the code degrades with a message
  instead of crashing).
- Game matching is by **title substring** on non-Steam shortcuts only.
- Collections are per Steam account.

## Licence

MIT.
