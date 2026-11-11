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
const namelessMap = callable("nameless_map");
const rememberName = callable("remember_name");
const rulesOf = callable("rules");
const rememberRule = callable("remember_rule");
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
        refreshed: (k, names) => k ? `${k} new games added (${names}).` : "Collections are up to date.",
        refreshHint: "Refresh also adds new games whose title matches each collection.",
    },
    fr: {
        list: "Collections Steam", refresh: "Rafraîchir", newTitle: "Créer une collection",
        name: "Nom de la collection", filter: "Jeux dont le titre contient (optionnel)",
        create: "Créer / remplir", created: (n, k) => `« ${n} » → ${k} jeux ajoutés.`,
        noMatch: "Aucun jeu ne correspond à ce filtre.", needName: "Saisis un nom.",
        noStore: "Collection store de Steam indisponible.",
        hint: "Les changements s'appliquent tout de suite — pas de redémarrage.",
        refreshed: (k, names) => k ? `${k} nouveaux jeux ajoutés (${names}).` : "Les collections sont à jour.",
        refreshHint: "Rafraîchir ajoute aussi les nouveaux jeux dont le titre correspond à chaque collection.",
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
const HIDDEN_IDS = new Set(["favorites", "uncategorized", "soundtracks", "installed", "installed_locally"]);
const HIDDEN_NAMES = new Set([
    "favoris", "favorites", "sans catégorie", "sans categorie", "uncategorized",
    "bandes-son", "bandes son", "soundtracks", "jeux installés localement", "installed locally",
]);
function visibleCollections() {
    const cs = collectionStore;
    return (cs?.userCollections ?? []).filter((c) => {
        try {
            if (typeof c?.IsDynamic === "function" && c.IsDynamic())
                return false;
        }
        catch { /* */ }
        if (HIDDEN_IDS.has(String(c?.id ?? "").toLowerCase()))
            return false;
        return !HIDDEN_NAMES.has(String(c?.displayName ?? "").trim().toLowerCase());
    });
}
function listCollections() {
    return visibleCollections().map((c) => ({
        name: c?.displayName ?? "?",
        count: c?.visibleApps?.length ?? c?.allApps?.length ?? c?.apps?.size ?? 0,
    }));
}
function signatureOf(c) {
    const ids = [];
    for (const key of ["allApps", "visibleApps", "apps"]) {
        const v = c?.[key];
        if (!v)
            continue;
        const it = typeof v[Symbol.iterator] === "function" ? Array.from(v) : [];
        for (const a of it) {
            const id = typeof a === "number" ? a : a?.appid ?? a?.app_id;
            if (typeof id === "number")
                ids.push(id);
        }
        if (ids.length)
            break;
    }
    return ids.sort((x, y) => x - y).join(",");
}
function memberIds(c) {
    const sig = signatureOf(c);
    return new Set(sig ? sig.split(",").map(Number) : []);
}
function titleOf(appid) {
    try {
        return String(appStore?.GetAppOverviewByAppID?.(appid)?.display_name ?? "");
    }
    catch {
        return "";
    }
}
/**
 * The title filter of a collection: the one saved when it was created, or, for an
 * older collection, its own name when every game already in it carries that name
 * ("Mario" holding only Mario games). Anything else is left alone.
 */
function filterFor(c, rules) {
    const name = String(c?.displayName ?? "").trim();
    if (!name)
        return "";
    if (rules[name])
        return rules[name].toLowerCase();
    const ids = Array.from(memberIds(c));
    const needle = name.toLowerCase();
    if (ids.length === 0)
        return "";
    return ids.every((id) => titleOf(id).toLowerCase().includes(needle)) ? needle : "";
}
/** Add every shortcut matching a collection's filter that is not in it yet. */
async function refill(rules) {
    const pool = shortcuts();
    let added = 0;
    const names = [];
    for (const c of visibleCollections()) {
        const f = filterFor(c, rules);
        if (!f)
            continue;
        const have = memberIds(c);
        const fresh = pool.filter((a) => !have.has(a.appid) && String(a?.display_name ?? "").toLowerCase().includes(f));
        if (!fresh.length)
            continue;
        for (const a of fresh)
            c.AsDragDropCollection().AddApps([{ appid: a.appid }]);
        await c.Save();
        try {
            await rememberName(c.displayName, signatureOf(c));
        }
        catch { /* */ }
        log("refilled", c.displayName, fresh.length);
        added += fresh.length;
        names.push(`${c.displayName} +${fresh.length}`);
    }
    return { added, names };
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
    const list = () => {
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
    const fixNameless = async () => {
        try {
            const map = await namelessMap();
            const known = Object.keys(map || {});
            if (!known.length)
                return;
            for (const c of visibleCollections()) {
                if (String(c?.displayName ?? "").trim())
                    continue;
                const sig = signatureOf(c);
                if (map[sig]) {
                    log("renaming nameless collection to", map[sig]);
                    c.displayName = map[sig];
                    await c.Save();
                }
            }
        }
        catch (e) {
            log("fixNameless failed", String(e));
        }
    };
    SP_REACT.useEffect(() => {
        log("mounted");
        void fixNameless().then(list);
        defaultName().then((v) => { if (v) {
            log("default name", v);
            setName(v);
        } }).catch(() => { });
    }, []);
    const refresh = async () => {
        setBusy(true);
        try {
            await fixNameless();
            const rules = await rulesOf().catch(() => ({}));
            const { added, names } = await refill(rules || {});
            setMsg(T.refreshed(added, names.join(", ")));
        }
        catch (e) {
            log("refill failed", String(e));
            setMsg(T.noStore);
        }
        list();
        setBusy(false);
    };
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
            const ids = picked.map((a) => a.appid);
            const coll = await addToCollection(n, ids);
            try {
                await rememberName(n, signatureOf(coll));
            }
            catch (e) {
                log("remember failed", String(e));
            }
            try {
                await rememberRule(n, f);
            }
            catch (e) {
                log("remember rule failed", String(e));
            }
            setMsg(T.created(n, picked.length));
            list();
        }
        catch (e) {
            log("create failed", String(e));
            setMsg(T.noStore);
        }
        setBusy(false);
    };
    return (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsxs(DFL.PanelSection, { title: T.newTitle, children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: T.name, value: name, onChange: (e) => setName(e.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.TextField, { label: T.filter, value: filter, onChange: (e) => setFilter(e.target.value) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: create, disabled: busy || !name.trim(), children: T.create }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: T.hint }) }), msg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { role: "status", style: { fontSize: 12 }, children: msg }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: T.list, children: [cols.map((c) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }, children: [SP_JSX.jsx("span", { children: c.name || "(?)" }), SP_JSX.jsx("span", { style: { opacity: 0.6 }, children: c.count })] }) }, c.name))), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => void refresh(), disabled: busy, children: T.refresh }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: T.refreshHint }) })] })] }));
}
const Icon = () => (SP_JSX.jsxs("svg", { viewBox: "0 0 24 24", width: "1em", height: "1em", "aria-hidden": "true", children: [SP_JSX.jsx("rect", { x: "1", y: "1", width: "22", height: "22", rx: "5", fill: "#1b2838" }), SP_JSX.jsx("rect", { x: "4.2", y: "4.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("rect", { x: "13.2", y: "4.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("rect", { x: "4.2", y: "13.2", width: "6.6", height: "6.6", rx: "1.5", fill: "#c6def0" }), SP_JSX.jsx("path", { d: "M16.5 13.4v6.2M13.4 16.5h6.2", stroke: "#66c0f4", strokeWidth: "1.9", strokeLinecap: "round" })] }));
var index = DFL.definePlugin(() => {
    log("factory");
    return { name: "Collection Creator", content: SP_JSX.jsx(Content, {}), icon: SP_JSX.jsx(Icon, {}) };
});

export { index as default };
//# sourceMappingURL=index.js.map
