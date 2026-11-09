# Collection Manager (plugin Decky)

Petit plugin pour Steam Deck qui crée et applique les **collections Steam** depuis le menu d'accès rapide, accompagné
d'un service local pilotable par script.

Steam n'expose **aucune API pour les collections** (contrairement aux raccourcis et artworks, qu'un plugin Decky peut
modifier à chaud). Les collections ne vivent que dans `localconfig.vdf`, que Steam réécrit depuis sa mémoire pendant
qu'il tourne. D'où le service compagnon qui :

1. arrête Steam,
2. écrit la collection dans `localconfig.vdf` (sauvegarde préalable),
3. relance Steam.

Conséquence : l'application n'est possible qu'en **mode Bureau**. En mode Gaming, Steam est supervisé et relancé
immédiatement — le panneau vous invite donc à basculer.

## Prérequis

- Steam Deck / SteamOS avec **Decky Loader**
- Python 3 (présent sur SteamOS)

## Installation

```bash
git clone <ce dépôt> && cd decky-collection-creator
./install.sh
```

Puis redémarrez Decky (ou Steam). Le plugin apparaît dans le menu d'accès rapide sous **Collection Manager**.

Installation manuelle : copier `plugin/` vers `~/homebrew/plugins/collection-creator/`, `service/collectiond.py` vers
`~/Games/_tools/`, `service/collectiond.service` vers `~/.config/systemd/user/`, puis
`systemctl --user enable --now collectiond`.

## Utilisation

Menu d'accès rapide → **Collection Manager** :

- la liste de vos collections (nom + nombre de jeux),
- **Nouvelle collection** : saisir un nom, *Créer et appliquer* → Steam redémarre avec la collection (vide),
- **Appliquer** : redémarre Steam pour prendre en compte les changements faits via l'API.

Les jeux s'ajoutent par l'API (le panneau crée des collections vides ; l'interface Steam permet ensuite d'y ajouter
des jeux, ou un script peut passer des appids).

## API (localhost:8731)

| Méthode | Chemin | Corps | Effet |
|---|---|---|---|
| GET | `/status` | – | `{mode, steam, collections[]}` |
| GET | `/collections` | – | `{collections[]}` |
| POST | `/apply` | `{}` | arrête puis relance Steam |
| POST | `/apply` | `{"name": "Mario", "appids": [...]}` | crée/complète pendant l'arrêt, puis relance |
| POST | `/collections` | `{"name": "...", "appids": [...]}` | écrit tout de suite (Steam doit déjà être arrêté) |

Les appids sont acceptés signés (ids de raccourcis Steam, ex. `-1436474168`) ou non signés (`2858493128`).

```bash
# créer/compléter une collection sans passer par le panneau
curl -X POST 127.0.0.1:8731/apply \
     -H 'Content-Type: application/json' \
     -d '{"name":"Mario","appids":[-1436474168,-2021531861]}'
```

## Fichiers

```
plugin/          plugin Decky (plugin.json, main.py, dist/index.js)
service/         collectiond.py + unité systemd utilisateur
install.sh       installeur
```

`collectiond` journalise dans `~/Games/_tools/collectiond.log` ; chaque écriture laisse un
`localconfig.vdf.bak-<horodatage>` à côté de l'original.

## Limites

- Mode Bureau uniquement (voir plus haut).
- Steam redémarre à l'application — inévitable, il lit les collections au démarrage.
- Les collections sont par compte Steam, dans `userdata/<id>/config/localconfig.vdf`.

## Licence

MIT.
