#!/usr/bin/env python3
"""collectiond — local helper that manages Steam collections on a Steam Deck.

Listens on 127.0.0.1:8731. Steam exposes no collection API, so the helper stops
Steam, edits localconfig.vdf, then starts Steam again (Desktop Mode only).

  GET  /status        -> mode (desktop/gaming), steam state, collections
  GET  /collections   -> [{id, name, count, added}]
  POST /apply         -> stop Steam, optionally upsert {"name","appids"}, restart
  POST /collections   -> write immediately (Steam must be stopped by the caller)
"""
import json
import os
import pathlib
import random
import shutil
import string
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8731
HOME = pathlib.Path.home()
USERDATA = HOME / ".steam/steam/userdata"
CONFIG = "config/localconfig.vdf"
LOG = HOME / "Games/_tools/collectiond.log"


def log(msg):
    try:
        with open(LOG, "a") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    except OSError:
        pass


def localconfig() -> pathlib.Path:
    for d in sorted(USERDATA.iterdir()):
        p = d / CONFIG
        if p.is_file():
            return p
    raise FileNotFoundError("localconfig.vdf not found")


def read_collections(path):
    text = path.read_text(errors="surrogateescape")
    i = text.find('"user-collections"')
    if i < 0:
        return text, None, None, {}
    j = text.index('"', i + len('"user-collections"'))
    j = text.index('"', text.index('{', j) - 1)
    k = j + 1
    while not (text[k] == '"' and text[k - 1] != '\\'):
        k += 1
    return text, j, k, json.loads(text[j + 1:k].replace('\\"', '"'))


def write_collections(path, text, j, k, data):
    raw = json.dumps(data, separators=(',', ':'), ensure_ascii=False).replace('"', '\\"')
    path.write_text(text[:j + 1] + raw + text[k:], errors='surrogateescape')


def unsigned(a):
    a = int(a)
    return a + 2**32 if a < 0 else a


def gaming_mode():
    return subprocess.run(["pgrep", "-f", "start-gamescope-session"],
                          capture_output=True).returncode == 0


def steam_running():
    return subprocess.run(["pgrep", "-x", "steam"], capture_output=True).returncode == 0


def stop_steam():
    subprocess.run(["systemctl", "--user", "stop", "steam-launcher.service"],
                   capture_output=True)
    for _ in range(30):
        if not steam_running():
            return True
        time.sleep(1)
    subprocess.run(["pkill", "-9", "-x", "steam"], capture_output=True)
    time.sleep(3)
    return not steam_running()


def start_steam():
    r = subprocess.run(["systemctl", "--user", "start", "steam-launcher.service"],
                       capture_output=True)
    if r.returncode != 0:
        subprocess.run(["systemd-run", "--user", "--collect",
                        f"--unit=steam-{int(time.time())}", "/usr/bin/steam"],
                       capture_output=True)
    log("steam restarted")


def upsert(name, appids):
    path = localconfig()
    text, j, k, data = read_collections(path)
    ids = [unsigned(a) for a in appids]
    existing = next((c for c in data.values() if c.get("name") == name), None)
    if existing:
        added = existing.setdefault("added", [])
        new = [i for i in ids if i not in added]
        added.extend(new)
        result = {"created": False, "name": name, "added": len(new), "total": len(added)}
    else:
        cid = "uc-" + "".join(random.choice(string.ascii_letters + string.digits) for _ in range(12))
        data[cid] = {"id": cid, "name": name, "added": ids, "removed": []}
        result = {"created": True, "name": name, "added": len(ids), "total": len(ids)}
    shutil.copy2(path, path.with_suffix(f".vdf.bak-{int(time.time())}"))
    write_collections(path, text, j, k, data)
    log(f"collection '{name}': {result}")
    return result


def list_collections():
    path = localconfig()
    _, _, _, data = read_collections(path)
    return [{"id": c.get("id"), "name": c.get("name", ""),
             "count": len(c.get("added", [])), "added": c.get("added", [])}
            for c in data.values()]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.startswith("/status"):
            return self._send(200, {"mode": "gaming" if gaming_mode() else "desktop",
                                    "steam": steam_running(),
                                    "collections": list_collections()})
        if self.path.startswith("/collections"):
            return self._send(200, {"collections": list_collections()})
        self._send(404, {"error": "unknown path", "error_code": "path"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._send(400, {"error": "invalid JSON", "error_code": "json"})

        if self.path.startswith("/collections"):
            name = (body.get("name") or "").strip()
            if not name:
                return self._send(400, {"error": "name is required", "error_code": "name"})
            try:
                return self._send(200, upsert(name, body.get("appids") or []))
            except Exception as e:
                return self._send(500, {"error": str(e), "error_code": "write"})

        if self.path.startswith("/apply"):
            if gaming_mode():
                return self._send(409, {
                    "error": "Gaming Mode: switch to Desktop Mode",
                    "error_code": "gaming"})
            if not stop_steam():
                return self._send(500, {"error": "Steam could not be stopped",
                                        "error_code": "steam"})
            name = (body.get("name") or "").strip()
            result = None
            if name:
                try:
                    result = upsert(name, body.get("appids") or [])
                except Exception as e:
                    start_steam()
                    return self._send(500, {"error": str(e), "error_code": "write"})
            start_steam()
            return self._send(200, {"ok": True, "result": result})

        self._send(404, {"error": "unknown path", "error_code": "path"})


if __name__ == "__main__":
    log(f"listening on {PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
