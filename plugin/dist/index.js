const manifest = {"name":"Collection Manager"};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);
}
const callable = api.callable;

const getState = callable("get_state");
const createCollection = callable("create");
const applyNow = callable("apply");
/* ------------------------------------------------------------------ i18n */
const LANG = (navigator.language || "en").toLowerCase();
const STR = {
    en: {
        list: "Your collections",
        summary: (n, mode, steam) => `${n} collections · ${mode} · Steam ${steam}`,
        desktop: "desktop mode", gaming: "gaming mode", running: "running", stopped: "stopped",
        refresh: "Refresh", newTitle: "New collection", name: "Name", create: "Create and apply",
        needDesktopCreate: "Switch to Desktop Mode to create a collection.",
        applyTitle: "Apply", apply: "Restart Steam now",
        needDesktopApply: "Not available in Gaming Mode (Steam is supervised there).",
        created: (n, t) => `“${n}” created (${t} games). Steam is restarting…`,
        restarting: "Steam is restarting…",
        errGaming: "Gaming Mode: switch to Desktop Mode first.",
        errSteam: "Steam could not be stopped.",
        errName: "Enter a name first.",
        errWrite: "Could not write the Steam configuration.",
        errService: "collectiond is not reachable (is the service running?).",
        errGeneric: "Something went wrong.",
        unnamed: "(unnamed)",
    },
    fr: {
        list: "Tes collections",
        summary: (n, mode, steam) => `${n} collections · ${mode} · Steam ${steam}`,
        desktop: "mode Bureau", gaming: "mode Gaming", running: "actif", stopped: "arrêté",
        refresh: "Rafraîchir", newTitle: "Nouvelle collection", name: "Nom", create: "Créer et appliquer",
        needDesktopCreate: "Passe en mode Bureau pour créer une collection.",
        applyTitle: "Appliquer", apply: "Redémarrer Steam maintenant",
        needDesktopApply: "Indisponible en mode Gaming (Steam y est supervisé).",
        created: (n, t) => `« ${n} » créée (${t} jeux). Steam redémarre…`,
        restarting: "Steam redémarre…",
        errGaming: "Mode Gaming : passe d'abord en mode Bureau.",
        errSteam: "Steam n'a pas pu être arrêté.",
        errName: "Saisis d'abord un nom.",
        errWrite: "Impossible d'écrire la configuration Steam.",
        errService: "collectiond injoignable (le service tourne-t-il ?).",
        errGeneric: "Une erreur est survenue.",
        unnamed: "(sans nom)",
    },
};
const T = STR[LANG.startsWith("fr") ? "fr" : "en"];
const log = (...a) => {
    try {
        console.log("[CollectionManager]", ...a);
    }
    catch { /* ignore */ }
};
function errorText(res) {
    log("error payload", JSON.stringify(res));
    switch (res?.error_code) {
        case "gaming": return T.errGaming;
        case "steam": return T.errSteam;
        case "name": return T.errName;
        case "write": return T.errWrite;
        case "service": return T.errService;
        default: return res?.error || T.errGeneric;
    }
}
/* ------------------------------------------------------------------ icône */
const Icon = () => (SP_JSX.jsxs("svg", { viewBox: "0 0 24 24", width: "1em", height: "1em", "aria-hidden": "true", children: [SP_JSX.jsx("rect", { x: "1", y: "1", width: "22", height: "22", rx: "5", fill: "#1b2838" }), SP_JSX.jsx("rect", { x: "4.2", y: "4.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("rect", { x: "13.2", y: "4.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("rect", { x: "4.2", y: "13.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("path", { d: "M16.5 13.4v6.2M13.4 16.5h6.2", stroke: "#66c0f4", strokeWidth: "1.9", strokeLinecap: "round" })] }));
/* ------------------------------------------------------------------ panneau */
function Content() {
    const [state, setState] = SP_REACT.useState(null);
    const [name, setName] = SP_REACT.useState("");
    const [msg, setMsg] = SP_REACT.useState("");
    const [busy, setBusy] = SP_REACT.useState(false);
    const refresh = async () => {
        log("refresh()");
        try {
            const s = await getState();
            log("state", JSON.stringify(s).slice(0, 200));
            if (s.error) {
                setState(null);
                setMsg(errorText(s));
            }
            else {
                setState(s);
                setMsg("");
            }
        }
        catch (e) {
            log("refresh failed", String(e));
            setMsg(T.errService);
        }
    };
    SP_REACT.useEffect(() => { log("mounted"); void refresh(); }, []);
    const create = async () => {
        const n = name.trim();
        if (!n) {
            setMsg(T.errName);
            return;
        }
        setBusy(true);
        try {
            const r = await createCollection(n);
            log("create ->", JSON.stringify(r));
            if (r.error)
                setMsg(errorText(r));
            else if (r.result)
                setMsg(T.created(r.result.name, r.result.total));
            else
                setMsg(T.restarting);
            setName("");
        }
        catch (e) {
            log("create failed", String(e));
            setMsg(T.errService);
        }
        setBusy(false);
    };
    const apply = async () => {
        setBusy(true);
        try {
            const r = await applyNow();
            log("apply ->", JSON.stringify(r));
            setMsg(r.error ? errorText(r) : T.restarting);
        }
        catch (e) {
            log("apply failed", String(e));
            setMsg(T.errService);
        }
        setBusy(false);
    };
    const cols = (state?.collections ?? []).filter((c) => c && (c.name || c.id));
    const gaming = state?.mode === "gaming";
    return (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsxs(DFL.PanelSection, { title: T.list, children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: 12, opacity: 0.7 }, children: T.summary(cols.length, state ? (gaming ? T.gaming : T.desktop) : "…", state ? (state.steam ? T.running : T.stopped) : "…") }) }), cols.map((c) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }, children: [SP_JSX.jsx("span", { children: c.name || T.unnamed }), SP_JSX.jsx("span", { style: { opacity: 0.6 }, children: String(c.count ?? 0) })] }) }, c.id || c.name))), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: refresh, disabled: busy, children: T.refresh }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: T.newTitle, children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: T.name, value: name, onChange: (e) => setName(e.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: create, disabled: busy || gaming || !name.trim(), children: T.create }) }), gaming && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: 12, opacity: 0.7 }, children: T.needDesktopCreate }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: T.applyTitle, children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: apply, disabled: busy || gaming, children: T.apply }) }), gaming && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: 12, opacity: 0.7 }, children: T.needDesktopApply }) }), msg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { role: "status", style: { fontSize: 12 }, children: msg }) })] })] }));
}
var index = DFL.definePlugin(() => {
    log("plugin factory");
    return { name: "Collection Manager", content: SP_JSX.jsx(Content, {}), icon: SP_JSX.jsx(Icon, {}) };
});

export { index as default };
//# sourceMappingURL=index.js.map
