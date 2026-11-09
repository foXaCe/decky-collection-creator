# Collection Creator (plugin Decky)

Créer et remplir des **collections Steam** depuis le menu d'accès rapide, **à chaud** — sans redémarrer Steam, sans
toucher aux fichiers.

Le plugin utilise le module interne `collectionStore` du client Steam (celui qu'utilise aussi ROM Sync) : la collection
est créée avec `NewUnsavedCollection()`, les jeux sont ajoutés via `AsDragDropCollection().AddApps()`, puis `Save()`.
La bibliothèque Steam se met à jour immédiatement.

## Fonctions

- liste de tes collections Steam avec le nombre de jeux,
- création d'une collection remplie par **filtre sur le titre** (nom `Zelda`, filtre `zelda` → tous les jeux dont le
  titre contient « zelda »),
- **français / anglais** (suit la langue du client Steam),
- fonctionne en mode Gaming et en mode Bureau.

## Installation

Nécessite [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader).

```bash
git clone https://github.com/foXaCe/decky-collection-creator.git
cd decky-collection-creator
./install.sh
```

Ou à la main :

```bash
cd plugin && pnpm install && pnpm build
```

puis copier `plugin/plugin.json`, `plugin/main.py`, `plugin/package.json` et `plugin/dist/` dans
`~/homebrew/plugins/collection-creator/` (propriétaire `root`, lisible par tous), et redémarrer Decky.

## Utilisation

Menu d'accès rapide → **Decky** → **Collection Creator** :

| Champ | Rôle |
|---|---|
| **Nom de la collection** | la collection à créer (ou à compléter si elle existe) |
| **Jeux dont le titre contient** | filtre optionnel ; par défaut, le nom de la collection |

Appuie sur **Créer / remplir**. Les jeux sont cherchés parmi tes **raccourcis non-Steam** (jeux émulés, recomps, …).
La collection apparaît aussitôt dans la barre latérale de la bibliothèque.

## Fonctionnement

```
collectionStore.userCollections.find(c => c.displayName === name)
  ?? collectionStore.NewUnsavedCollection(name, undefined, [])
collection.AsDragDropCollection().AddApps([{ appid }, …])
await collection.Save()
```

`collectionStore` n'est pas dans les typings `@decky/ui` : c'est un global du client Steam. Le code est prudent sur sa
forme (`deckDesktopApps` / `localGamesCollection` / `allAppsCollection`) car ces noms ont bougé selon les versions.

## Arborescence

```
plugin/          plugin Decky (TypeScript + @decky/ui, construit avec rollup)
  src/index.tsx  panneau, i18n, appels collectionStore
  dist/index.js  bundle compilé
install.sh       copie le plugin dans ~/homebrew/plugins
```

## Limites

- Repose sur un **module Steam non documenté** : une future mise à jour du client peut le renommer (le plugin affiche
  alors un message au lieu de planter).
- La sélection des jeux se fait par **sous-chaîne du titre**, sur les raccourcis non-Steam uniquement.
- Les collections sont liées au compte Steam.

## Licence

MIT.
