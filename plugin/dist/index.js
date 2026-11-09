const manifest = { name: "Collection Manager" };
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
let api;
try {
  api = internalAPIConnection.connect(API_VERSION, manifest.name);
} catch {
  api = internalAPIConnection.connect(1, manifest.name);
}

const call = (method) => (api.callable
  ? api.callable(method)
  : (...args) => api.call(method, ...args));

const getState = call("get_state");
const createCollection = call("create");
const applyNow = call("apply");

const { useState, useEffect } = SP_REACT;
const h = SP_JSX.jsx;

/* ---- i18n: Steam's CEF reports the UI language in navigator.language ---- */
const LANG = (navigator.language || "en").toLowerCase();
const STRINGS = {
  en: {
    title: "Collections",
    summary: (n, mode, steam) => `${n} collections · ${mode} mode · Steam ${steam}`,
    desktop: "desktop",
    gaming: "gaming",
    running: "running",
    stopped: "stopped",
    refresh: "Refresh",
    newTitle: "New collection",
    name: "Name",
    create: "Create and apply",
    needDesktopCreate: "Switch to Desktop Mode to create a collection.",
    applyTitle: "Apply",
    apply: "Restart Steam now",
    needDesktopApply: "Not available in Gaming Mode (Steam is supervised there).",
    created: (name, total) => `“${name}” created (${total} games). Steam is restarting…`,
    restarting: "Steam is restarting…",
    errGaming: "Gaming Mode: switch to Desktop Mode first.",
    errSteam: "Steam could not be stopped.",
    errName: "Enter a name first.",
    errWrite: "Could not write the Steam configuration.",
    errService: "collectiond is not reachable (is the service running?).",
    errGeneric: "Something went wrong.",
  },
  fr: {
    title: "Collections",
    summary: (n, mode, steam) => `${n} collections · mode ${mode} · Steam ${steam}`,
    desktop: "Bureau",
    gaming: "Gaming",
    running: "actif",
    stopped: "arrêté",
    refresh: "Rafraîchir",
    newTitle: "Nouvelle collection",
    name: "Nom",
    create: "Créer et appliquer",
    needDesktopCreate: "Passe en mode Bureau pour créer une collection.",
    applyTitle: "Appliquer",
    apply: "Redémarrer Steam maintenant",
    needDesktopApply: "Indisponible en mode Gaming (Steam y est supervisé).",
    created: (name, total) => `« ${name} » créée (${total} jeux). Steam redémarre…`,
    restarting: "Steam redémarre…",
    errGaming: "Mode Gaming : passe d'abord en mode Bureau.",
    errSteam: "Steam n'a pas pu être arrêté.",
    errName: "Saisis d'abord un nom.",
    errWrite: "Impossible d'écrire la configuration Steam.",
    errService: "collectiond injoignable (le service tourne-t-il ?).",
    errGeneric: "Une erreur est survenue.",
  },
};
const T = STRINGS[LANG.startsWith("fr") ? "fr" : "en"];

function errorText(res) {
  const code = res && res.error_code;
  if (code === "gaming") return T.errGaming;
  if (code === "steam") return T.errSteam;
  if (code === "name") return T.errName;
  if (code === "write") return T.errWrite;
  if (code === "service" || (res && typeof res.error === "string" && res.error.includes("unreachable"))) return T.errService;
  return (res && res.error) || T.errGeneric;
}

function Row({ children }) {
  return h(DFL.PanelSectionRow, null,
    h("div", { style: { fontSize: 13, lineHeight: 1.45, overflowWrap: "anywhere" } }, children));
}

function Content() {
  const [state, setState] = useState(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const s = await getState();
      setState(s.error ? null : s);
      if (s.error) setMsg(errorText(s));
    } catch (e) { setMsg(T.errService); }
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const r = await createCollection(name.trim());
      if (r.error) setMsg(errorText(r));
      else if (r.result) setMsg(T.created(r.result.name, r.result.total));
      else setMsg(T.restarting);
      setName("");
    } catch (e) { setMsg(T.errService); }
    setBusy(false);
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await applyNow();
      setMsg(r.error ? errorText(r) : T.restarting);
    } catch (e) { setMsg(T.errService); }
    setBusy(false);
  };

  const cols = (state && state.collections) || [];
  const gaming = state ? state.mode === "gaming" : false;
  const modeText = state ? (gaming ? T.gaming : T.desktop) : "…";
  const steamText = state ? (state.steam ? T.running : T.stopped) : "…";

  return h("div", null,
    h(DFL.PanelSection, { title: T.title },
      h(Row, null, T.summary(cols.length, modeText, steamText)),
      cols.map((c) => h(DFL.PanelSectionRow, { key: c.id },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 } },
          h("span", null, c.name), h("span", { style: { opacity: 0.6 } }, String(c.count))))),
      h(DFL.ButtonItem, { onClick: refresh, disabled: busy }, T.refresh)
    ),
    h(DFL.PanelSection, { title: T.newTitle },
      h(DFL.TextField, { label: T.name, value: name, onChange: (e) => setName(e.target.value) }),
      h(DFL.ButtonItem, { onClick: create, disabled: busy || gaming || !name.trim() }, T.create),
      gaming && h(Row, null, T.needDesktopCreate)
    ),
    h(DFL.PanelSection, { title: T.applyTitle },
      h(DFL.ButtonItem, { onClick: apply, disabled: busy || gaming }, T.apply),
      gaming && h(Row, null, T.needDesktopApply),
      msg && h(Row, null, msg)
    )
  );
}

const ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAFP0lEQVR42u3dsW1qQRBA0deHG6AEKnKdjijDNRA4fxYFkIHY2XuQbgF/Z+Z8B7Y4juGfr8v1lD7V4eO4JUg4eAkIjl6CgaOXYODwpTwEhipFITBIKYiA4UlRCAxMCiJgSFIUAoORoggYiBRFwCCkKAIGIEUR8PBSFAEPLkUR8NBSFAEPLEUR8LBSGAGPKkUB8KBSFAEPKYUR8IhSFAAPKEUR8HBSGAGPJkUB8GBSGAGPJUUB8FBSGAGPJAFAUg0ADySFEfA4EgAk1QDwMFIYAY8iAUASACRlAPAgUhiBHf9xt9/76MzDPAAQWa7dltA8AGDRgotnHgCwbNGlMw8AWLbo0pnFTARGAmDR1lo6M5iLwDgALNhaS+ftZyMwCgCLtdbSefP5CPjf38KZR/2nAMdv6cwj/FMAACyceQAAABbOPAAAAAtnHgAAgIUzDwA4fktnHnsjAAALZx4AAICFMw8AAMDCmQcAAGDhzAMAALBw5gEAAFg48wAAACyceQAAAAAQAAAAAAEAAAAQACwcAAQACwcAAcDCAUAAsHAAEAAsHADMAwAWDgDmAQALBwDzAICFA4B5AMDCAcA8AGDhAGAeALBwADAPAFg4AJgHACwcAMwDAJYIAOYBAAHAPAAgAJgHAAQA8wCAAAAAAAgAAACAAAAAAFg48wAAACyceQAAABbOPAAAAAtnHgAAgIUzDwAAwMKZBwAAYOHMAwAAsHDmAQAAWDjzAAAALJx5AAAAFs48AAAAC2ceAACAhTMPAADAwpkHAAAAAAEAAAAQACwcAAQAS1daNm+9x/EDwMKZBwAAYOHMAwAAsHDmAQAAWDjzAAAELJt5bH78ALBw5gGA6wkBy2YeveMfB4ClW2/ZzGDu8Y8EwNKtt2xmMfP4xwJg6e7mYR5tAMpLZx7mAYDg4pmHeQAgsoTmYR4AkAQASQCQBABJAJAEAEkAkAQASQCQBABJAJAEAEkAkAQASQCQACAJAJIAIAkAkgAgCQCSACAJAJIAIAkApy+i8EUUAoBjh4IA4PBBIAA4fggIAI4fAgKA44eAAOD4ISAAOH4ICAAAAIAA4PghIAAAAAACAAAAIAAAAAACAAAAoDIADhsCAoAAIAAIAAKAACAACAACgAAgAAgAAgAAJAAAQAIAACQAAEACAAAkAABgr75//hwzAFQC4HH0z3LYAABA9PghAAAAxI8fAgAAAAAcOAAAAAABAABJACAAAAAAQAAAAAAEAAAAQAAAAAAEAAAAAAAAAMDU435VAAAAAKLHX0cAAADIH38ZAQAAAAAAAAAAAAAAAAAgevxVBAAAAAj4CQAAAAAAAAAAAAAAAAAA8HsAAAAAAPwmIAAAAID9MPB3AAAAgD8GAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC+GAQAAAAAAAAAAAAAAAAAAICvBwcAAACwHAIOGwAACOXoNwYAAo5fABAABAABQAAQAAQAAUABACDg+PUmAB4fAABA0eOfAgAEHL/iAEDA8SsOAAQcv+IAQMDxKw5AGQHLKwAEIbC0AkAEBQsqAEh6PwAQkMLHDwAJAB5GAoCkHAAQkMLHDwAJAB5IqgIAASl8/ACQAOChpCoAEJDCxw8AKQ4ABKTw8QNAigMAASl8/BCQ4scPACkOAASk8PFDQIofPwCkOAAQkMLHDwEpfvwQkOLHDwEpfvwQkOLHDwEpfvwQkOLHDwEpfvwQkOLHDwIpfvgQkBw/CKT64UNAcvwgkOqHDwLJ4cNAcvQwkKP3AYIcvA8k5Lg/9/kHZDbU/Iq4gNQAAAAASUVORK5CYII=";

const definePluginFn = (typeof definePlugin === "function") ? definePlugin : DFL.definePlugin;

const index = definePluginFn(() => ({
  name: "Collection Manager",
  content: h(Content, {}),
  icon: h("img", { src: ICON, width: "1em", height: "1em", alt: "" }),
}));

export { index as default };
