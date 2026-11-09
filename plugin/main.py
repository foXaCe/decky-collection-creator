"""Backend du plugin Collections : relaie vers collectiond (127.0.0.1:8731).

Steam n'expose aucune API de collection : le service arrête Steam, écrit
localconfig.vdf puis le relance (mode Bureau uniquement).
"""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8731"


def _req(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json"},
        method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return {"error": json.loads(e.read().decode()).get("error", str(e))}
        except Exception:
            return {"error": str(e)}
    except Exception as e:
        return {"error": f"collectiond injoignable ({e})"}


class Plugin:
    async def _main(self):
        pass

    async def _unload(self):
        pass

    async def get_state(self):
        return _req("/status")

    async def create(self, name):
        return _req("/apply", {"name": name, "appids": []})

    async def apply(self):
        return _req("/apply", {})
