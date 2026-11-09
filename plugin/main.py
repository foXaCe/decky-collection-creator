"""Collection Creator — pas de backend : tout passe par le collectionStore de Steam."""
import decky


class Plugin:
    async def _main(self):
        decky.logger.info("Collection Creator ready (collectionStore path)")

    async def _unload(self):
        pass
