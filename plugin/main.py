"""Backend du plugin Collection Manager : relaie vers collectiond (127.0.0.1:8731).

Steam n'expose aucune API de collection : le service arrête Steam, écrit
localconfig.vdf puis le relance (mode Bureau uniquement).
"""
import json
import urllib.error
import urllib.request

import decky

BASE = "http://127.0.0.1:8731"


def _req(path: str, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json"},
        method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.load(r)
        decky.logger.info(f"{path} -> ok")
        return out
    except urllib.error.HTTPError as e:
        try:
            out = json.loads(e.read().decode())
        except Exception:
            out = {"error": str(e), "error_code": "service"}
        decky.logger.warning(f"{path} -> HTTP {e.code}: {out}")
        return out
    except Exception as e:
        decky.logger.error(f"{path} -> unreachable: {e}")
        return {"error": f"collectiond unreachable ({e})", "error_code": "service"}


class Plugin:
    async def _main(self):
        decky.logger.info("Collection Manager backend ready")

    async def _unload(self):
        pass

    async def get_state(self):
        return _req("/status")

    async def create(self, name: str):
        return _req("/apply", {"name": name, "appids": []})

    async def apply(self):
        return _req("/apply", {})
