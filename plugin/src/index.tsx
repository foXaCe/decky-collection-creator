import { useEffect, useState } from "react";
import { ButtonItem, PanelSection, PanelSectionRow, TextField, definePlugin } from "@decky/ui";
import { callable } from "@decky/api";

const defaultName = callable<[], string>("default_name");
const namelessMap = callable<[], Record<string, string>>("nameless_map");
const rememberName = callable<[name: string, signature: string], void>("remember_name");

/* Steam's own collection store: a global of the client, not a file. */
declare const collectionStore: any;
declare const appStore: any;

type Coll = { name: string; count: number };

const log = (...a: unknown[]) => { try { console.log("[CollectionCreator]", ...a); } catch { /* */ } };

const LANG = (navigator.language || "en").toLowerCase();
const STR = {
  en: {
    list: "Steam collections", refresh: "Refresh", newTitle: "Create a collection",
    name: "Collection name", filter: "Games whose title contains (optional)",
    create: "Create / fill", created: (n: string, k: number) => `“${n}” → ${k} games added.`,
    noMatch: "No game matches that filter.", needName: "Enter a name.",
    noStore: "Steam collection store unavailable.",
    hint: "Changes apply immediately — no Steam restart.",
  },
  fr: {
    list: "Collections Steam", refresh: "Rafraîchir", newTitle: "Créer une collection",
    name: "Nom de la collection", filter: "Jeux dont le titre contient (optionnel)",
    create: "Créer / remplir", created: (n: string, k: number) => `« ${n} » → ${k} jeux ajoutés.`,
    noMatch: "Aucun jeu ne correspond à ce filtre.", needName: "Saisis un nom.",
    noStore: "Collection store de Steam indisponible.",
    hint: "Les changements s'appliquent tout de suite — pas de redémarrage.",
  },
};
const T = STR[LANG.startsWith("fr") ? "fr" : "en"];

function shortcuts(): any[] {
  const cs = collectionStore;
  const apps = cs?.deckDesktopApps?.allApps ?? cs?.localGamesCollection?.allApps ?? cs?.allAppsCollection?.allApps ?? appStore?.allApps ?? [];
  return apps.filter((a: any) => {
    try { return a?.BIsShortcut?.(); } catch { return false; }
  });
}

const HIDDEN_IDS = new Set(["favorites", "uncategorized", "soundtracks", "installed", "installed_locally"]);
const HIDDEN_NAMES = new Set([
  "favoris", "favorites", "sans catégorie", "sans categorie", "uncategorized",
  "bandes-son", "bandes son", "soundtracks", "jeux installés localement", "installed locally",
]);

function visibleCollections(): any[] {
  const cs = collectionStore;
  return (cs?.userCollections ?? []).filter((c: any) => {
    try { if (typeof c?.IsDynamic === "function" && c.IsDynamic()) return false; } catch { /* */ }
    if (HIDDEN_IDS.has(String(c?.id ?? "").toLowerCase())) return false;
    return !HIDDEN_NAMES.has(String(c?.displayName ?? "").trim().toLowerCase());
  });
}

function listCollections(): Coll[] {
  return visibleCollections().map((c: any) => ({
    name: c?.displayName ?? "?",
    count: c?.visibleApps?.length ?? c?.allApps?.length ?? c?.apps?.size ?? 0,
  }));
}

function signatureOf(c: any): string {
  const ids: number[] = [];
  for (const key of ["allApps", "visibleApps", "apps"]) {
    const v = c?.[key];
    if (!v) continue;
    const it = typeof v[Symbol.iterator] === "function" ? Array.from(v) : [];
    for (const a of it) {
      const id = typeof a === "number" ? a : a?.appid ?? a?.app_id;
      if (typeof id === "number") ids.push(id);
    }
    if (ids.length) break;
  }
  return ids.sort((x, y) => x - y).join(",");
}

async function addToCollection(name: string, appids: number[]) {
  const existing = collectionStore.userCollections.find((c: any) => c.displayName === name);
  const collection = existing ?? collectionStore.NewUnsavedCollection(name, undefined, []);
  for (const appid of appids) collection.AsDragDropCollection().AddApps([{ appid }]);
  await collection.Save();
  return collection;
}

function Content() {
  const [cols, setCols] = useState<Coll[]>([]);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    try {
      const l = listCollections();
      log("collections", l.length, JSON.stringify(l));
      setCols(l);
    } catch (e) {
      log("refresh failed", String(e));
      setMsg(T.noStore);
    }
  };

  const fixNameless = async () => {
    try {
      const map = await namelessMap();
      const known = Object.keys(map || {});
      if (!known.length) return;
      for (const c of visibleCollections()) {
        if (String(c?.displayName ?? "").trim()) continue;
        const sig = signatureOf(c);
        if (map[sig]) {
          log("renaming nameless collection to", map[sig]);
          c.displayName = map[sig];
          await c.Save();
        }
      }
    } catch (e) { log("fixNameless failed", String(e)); }
  };

  useEffect(() => {
    log("mounted");
    void fixNameless().then(refresh);
    defaultName().then((v) => { if (v) { log("default name", v); setName(v); } }).catch(() => {});
  }, []);

  const create = async () => {
    const n = name.trim();
    const f = (filter.trim() || n).toLowerCase();
    if (!n) { setMsg(T.needName); return; }
    setBusy(true);
    try {
      const pool = shortcuts();
      log("shortcuts", pool.length);
      const picked = pool.filter((a: any) => String(a?.display_name ?? "").toLowerCase().includes(f));
      log("matched", picked.length, "for", f);
      if (!picked.length) { setMsg(T.noMatch); setBusy(false); return; }
      const ids = picked.map((a: any) => a.appid);
      const coll = await addToCollection(n, ids);
      try { await rememberName(n, signatureOf(coll)); } catch (e) { log("remember failed", String(e)); }
      setMsg(T.created(n, picked.length));
      refresh();
    } catch (e) {
      log("create failed", String(e));
      setMsg(T.noStore);
    }
    setBusy(false);
  };

  return (
    <>
      <PanelSection title={T.newTitle}>
        <PanelSectionRow>
          <TextField label={T.name} value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField label={T.filter} value={filter} onChange={(e) => setFilter((e.target as HTMLInputElement).value)} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={create} disabled={busy || !name.trim()}>{T.create}</ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow><div style={{ fontSize: 11, opacity: 0.6 }}>{T.hint}</div></PanelSectionRow>
        {msg && <PanelSectionRow><div role="status" style={{ fontSize: 12 }}>{msg}</div></PanelSectionRow>}
      </PanelSection>
      <PanelSection title={T.list}>
        {cols.map((c) => (
          <PanelSectionRow key={c.name}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
              <span>{c.name || "(?)"}</span>
              <span style={{ opacity: 0.6 }}>{c.count}</span>
            </div>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={refresh} disabled={busy}>{T.refresh}</ButtonItem>
        </PanelSectionRow>
      </PanelSection>

    </>
  );
}

const Icon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
    <rect x="1" y="1" width="22" height="22" rx="5" fill="#1b2838" />
    <rect x="4.2" y="4.2" width="6.6" height="6.6" rx="1.5" fill="#c6def0" />
    <rect x="13.2" y="4.2" width="6.6" height="6.6" rx="1.5" fill="#c6def0" />
    <rect x="4.2" y="13.2" width="6.6" height="6.6" rx="1.5" fill="#c6def0" />
    <path d="M16.5 13.4v6.2M13.4 16.5h6.2" stroke="#66c0f4" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export default definePlugin(() => {
  log("factory");
  return { name: "Collection Creator", content: <Content />, icon: <Icon /> };
});
