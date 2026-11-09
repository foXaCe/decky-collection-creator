const manifest = { name: "Collection Manager" };
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
let api;
try {
  api = internalAPIConnection.connect(API_VERSION, manifest.name);
} catch {
  api = internalAPIConnection.connect(1, manifest.name);
}

const getState = api.callable("get_state");
const createCollection = api.callable("create");
const applyNow = api.callable("apply");

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

const Icon = () => h("svg", {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round",
  width: "1em", height: "1em", "aria-hidden": "true",
},
  h("rect", { x: 3, y: 3, width: 7.5, height: 7.5, rx: 1.6 }),
  h("rect", { x: 13.5, y: 3, width: 7.5, height: 7.5, rx: 1.6 }),
  h("rect", { x: 3, y: 13.5, width: 7.5, height: 7.5, rx: 1.6 }),
  h("path", { d: "M17.25 14.2v6.1M14.2 17.25h6.1" })
);

const index = DFL.definePlugin(() => ({
  name: "Collection Manager",
  content: h(Content, {}),
  icon: h(Icon, {}),
}));

export { index as default };
