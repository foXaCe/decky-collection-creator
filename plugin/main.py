"""Collection Creator — backend minimal : nom par défaut + mémoire des collections sans nom."""
import json
import pathlib

import decky

TOOLS = pathlib.Path.home() / "Games/_tools"
NAME_FILE = TOOLS / "cc_name.txt"
MAP_FILE = TOOLS / "cc_names.json"


def _load() -> dict:
    try:
        return json.loads(MAP_FILE.read_text())
    except Exception:
        return {}


def _save(m: dict) -> None:
    try:
        TOOLS.mkdir(parents=True, exist_ok=True)
        MAP_FILE.write_text(json.dumps(m, indent=1, sort_keys=True))
    except OSError as e:
        decky.logger.warning(f"cannot write {MAP_FILE}: {e}")


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
        m[signature] = name
        _save(m)
        decky.logger.info(f"remembered '{name}' for {len(signature.split(','))} apps")
