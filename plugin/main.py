"""Collection Creator — backend minimal (aucune logique Steam ici)."""
import pathlib

import decky

NAME_FILE = pathlib.Path.home() / "Games/_tools/cc_name.txt"


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
