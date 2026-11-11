"""Collection Creator — backend minimal : nom par défaut, mémoire des collections sans nom et filtres de titre."""
import json
import pathlib

import decky

TOOLS = pathlib.Path.home() / "Games/_tools"
NAME_FILE = TOOLS / "cc_name.txt"
MAP_FILE = TOOLS / "cc_names.json"
RULES_FILE = TOOLS / "cc_rules.json"


def _load(path: pathlib.Path = MAP_FILE) -> dict:
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def _save(m: dict, path: pathlib.Path = MAP_FILE) -> None:
    try:
        TOOLS.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(m, indent=1, sort_keys=True))
    except OSError as e:
        decky.logger.warning(f"cannot write {path}: {e}")


class Plugin:
    async def _main(self):
        decky.logger.info("Collection Creator ready")

    async def _unload(self):
        pass

    async def default_name(self):
        try:
            return NAME_FILE.read_text().strip()
        except OSError:
            return ""

    async def nameless_map(self):
        return _load()

    async def remember_name(self, name: str, signature: str):
        if not name or not signature:
            return
        m = _load()
        # One signature per collection: drop the old one when the content changed.
        m = {sig: n for sig, n in m.items() if n != name}
        m[signature] = name
        _save(m)
        decky.logger.info(f"remembered '{name}' for {len(signature.split(','))} apps")

    async def rules(self):
        """Title filter of each collection, so Refresh can add newly matching games."""
        return _load(RULES_FILE)

    async def remember_rule(self, name: str, title_filter: str):
        if not name or not title_filter:
            return
        r = _load(RULES_FILE)
        r[name] = title_filter
        _save(r, RULES_FILE)
