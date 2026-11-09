const manifest = {"name":"Collection Creator"};
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

const defaultName = callable("default_name");
const log = (...a) => { try {
    console.log("[CollectionCreator]", ...a);
}
catch { /* */ } };
const LANG = (navigator.language || "en").toLowerCase();
const STR = {
    en: {
        list: "Steam collections", refresh: "Refresh", newTitle: "Create a collection",
        name: "Collection name", filter: "Games whose title contains (optional)",
        create: "Create / fill", created: (n, k) => `“${n}” → ${k} games added.`,
        noMatch: "No game matches that filter.", needName: "Enter a name.",
        noStore: "Steam collection store unavailable.",
        hint: "Changes apply immediately — no Steam restart.",
    },
    fr: {
        list: "Collections Steam", refresh: "Rafraîchir", newTitle: "Créer une collection",
        name: "Nom de la collection", filter: "Jeux dont le titre contient (optionnel)",
        create: "Créer / remplir", created: (n, k) => `« ${n} » → ${k} jeux ajoutés.`,
        noMatch: "Aucun jeu ne correspond à ce filtre.", needName: "Saisis un nom.",
        noStore: "Collection store de Steam indisponible.",
        hint: "Les changements s'appliquent tout de suite — pas de redémarrage.",
    },
};
const T = STR[LANG.startsWith("fr") ? "fr" : "en"];
function shortcuts() {
    const cs = collectionStore;
    const apps = cs?.deckDesktopApps?.allApps ?? cs?.localGamesCollection?.allApps ?? cs?.allAppsCollection?.allApps ?? appStore?.allApps ?? [];
    return apps.filter((a) => {
        try {
            return a?.BIsShortcut?.();
        }
        catch {
            return false;
        }
    });
}
function listCollections() {
    const cs = collectionStore;
    const cols = cs?.userCollections ?? [];
    return cols.map((c) => ({
        name: c?.displayName ?? "?",
        count: c?.visibleApps?.length ?? c?.allApps?.length ?? c?.apps?.size ?? 0,
    }));
}
async function addToCollection(name, appids) {
    const existing = collectionStore.userCollections.find((c) => c.displayName === name);
    const collection = existing ?? collectionStore.NewUnsavedCollection(name, undefined, []);
    for (const appid of appids)
        collection.AsDragDropCollection().AddApps([{ appid }]);
    await collection.Save();
    return collection;
}
function Content() {
    const [cols, setCols] = SP_REACT.useState([]);
    const [name, setName] = SP_REACT.useState("");
    const [filter, setFilter] = SP_REACT.useState("");
    const [msg, setMsg] = SP_REACT.useState("");
    const [busy, setBusy] = SP_REACT.useState(false);
    const refresh = () => {
        try {
            const l = listCollections();
            log("collections", l.length, JSON.stringify(l));
            setCols(l);
        }
        catch (e) {
            log("refresh failed", String(e));
            setMsg(T.noStore);
        }
    };
    SP_REACT.useEffect(() => {
        log("mounted");
        refresh();
        defaultName().then((v) => { if (v) {
            log("default name", v);
            setName(v);
        } }).catch(() => { });
    }, []);
    const create = async () => {
        const n = name.trim();
        const f = (filter.trim() || n).toLowerCase();
        if (!n) {
            setMsg(T.needName);
            return;
        }
        setBusy(true);
        try {
            const pool = shortcuts();
            log("shortcuts", pool.length);
            const picked = pool.filter((a) => String(a?.display_name ?? "").toLowerCase().includes(f));
            log("matched", picked.length, "for", f);
            if (!picked.length) {
                setMsg(T.noMatch);
                setBusy(false);
                return;
            }
            await addToCollection(n, picked.map((a) => a.appid));
            setMsg(T.created(n, picked.length));
            refresh();
        }
        catch (e) {
            log("create failed", String(e));
            setMsg(T.noStore);
        }
        setBusy(false);
    };
    return (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsxs(DFL.PanelSection, { title: T.newTitle, children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: T.name, value: name, onChange: (e) => setName(e.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: T.filter, value: filter, onChange: (e) => setFilter(e.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: create, disabled: busy || !name.trim(), children: T.create }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: T.hint }) }), msg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { role: "status", style: { fontSize: 12 }, children: msg }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: T.list, children: [cols.map((c) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }, children: [SP_JSX.jsx("span", { children: c.name || "(?)" }), SP_JSX.jsx("span", { style: { opacity: 0.6 }, children: c.count })] }) }, c.name))), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: refresh, disabled: busy, children: T.refresh }) })] })] }));
}
const Icon = () => (SP_JSX.jsxs("svg", { viewBox: "0 0 24 24", width: "1em", height: "1em", "aria-hidden": "true", children: [SP_JSX.jsx("rect", { x: "1", y: "1", width: "22", height: "22", rx: "5", fill: "#1b2838" }), SP_JSX.jsx("rect", { x: "4.2", y: "4.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("rect", { x: "13.2", y: "4.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("rect", { x: "4.2", y: "13.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("path", { d: "M16.5 13.4v6.2M13.4 16.5h6.2", stroke: "#66c0f4", strokeWidth: "1.9", strokeLinecap: "round" })] }));
var index = DFL.definePlugin(() => {
    log("factory");
    return { name: "Collection Creator", content: SP_JSX.jsx(Content, {}), icon: SP_JSX.jsx(Icon, {}) };
});

export { index as default };
//# sourceMappingURL=index.js.map
