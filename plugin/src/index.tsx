import { useEffect, useState } from "react";
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  definePlugin,


} from "@decky/ui";
import { callable } from "@decky/api";

/* ------------------------------------------------------------------ API */

type Collection = { id: string; name: string; count: number; added: number[] };
type State = { mode: "desktop" | "gaming"; steam: boolean; collections: Collection[] };
type ErrPayload = { error?: string; error_code?: string };
type ApplyResult = ErrPayload & {
  ok?: boolean;
  result?: { created: boolean; name: string; added: number; total: number };
};

const getState = callable<[], State | ErrPayload>("get_state");
const createCollection = callable<[name: string], ApplyResult>("create");
const applyNow = callable<[], ApplyResult>("apply");

/* ------------------------------------------------------------------ i18n */

const LANG = (navigator.language || "en").toLowerCase();
const STR = {
  en: {
    list: "Your collections",
    summary: (n: number, mode: string, steam: string) => `${n} collections · ${mode} · Steam ${steam}`,
    desktop: "desktop mode", gaming: "gaming mode", running: "running", stopped: "stopped",
    refresh: "Refresh", newTitle: "New collection", name: "Name", create: "Create and apply",
    needDesktopCreate: "Switch to Desktop Mode to create a collection.",
    applyTitle: "Apply", apply: "Restart Steam now",
    needDesktopApply: "Not available in Gaming Mode (Steam is supervised there).",
    created: (n: string, t: number) => `“${n}” created (${t} games). Steam is restarting…`,
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
    summary: (n: number, mode: string, steam: string) => `${n} collections · ${mode} · Steam ${steam}`,
    desktop: "mode Bureau", gaming: "mode Gaming", running: "actif", stopped: "arrêté",
    refresh: "Rafraîchir", newTitle: "Nouvelle collection", name: "Nom", create: "Créer et appliquer",
    needDesktopCreate: "Passe en mode Bureau pour créer une collection.",
    applyTitle: "Appliquer", apply: "Redémarrer Steam maintenant",
    needDesktopApply: "Indisponible en mode Gaming (Steam y est supervisé).",
    created: (n: string, t: number) => `« ${n} » créée (${t} jeux). Steam redémarre…`,
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

const log = (...a: unknown[]) => {
  try { console.log("[CollectionManager]", ...a); } catch { /* ignore */ }
};

function errorText(res: ErrPayload | undefined): string {
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

const Icon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
    <rect x="1" y="1" width="22" height="22" rx="5" fill="#1b2838" />
    <rect x="4.2" y="4.2" width="6.6" height="6.6" rx="1.5" fill="#c6def0" />
    <rect x="13.2" y="4.2" width="6.6" height="6.6" rx="1.5" fill="#c6def0" />
    <rect x="4.2" y="13.2" width="6.6" height="6.6" rx="1.5" fill="#c6def0" />
    <path d="M16.5 13.4v6.2M13.4 16.5h6.2" stroke="#66c0f4" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ panneau */

function Content() {
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    log("refresh()");
    try {
      const s = await getState();
      log("state", JSON.stringify(s).slice(0, 200));
      if ((s as ErrPayload).error) { setState(null); setMsg(errorText(s as ErrPayload)); }
      else { setState(s as State); setMsg(""); }
    } catch (e) {
      log("refresh failed", String(e));
      setMsg(T.errService);
    }
  };

  useEffect(() => { log("mounted"); void refresh(); }, []);

  const create = async () => {
    const n = name.trim();
    if (!n) { setMsg(T.errName); return; }
    setBusy(true);
    try {
      const r = await createCollection(n);
      log("create ->", JSON.stringify(r));
      if (r.error) setMsg(errorText(r));
      else if (r.result) setMsg(T.created(r.result.name, r.result.total));
      else setMsg(T.restarting);
      setName("");
    } catch (e) {
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
    } catch (e) {
      log("apply failed", String(e));
      setMsg(T.errService);
    }
    setBusy(false);
  };

  const cols = (state?.collections ?? []).filter((c) => c && (c.name || c.id));
  const gaming = state?.mode === "gaming";

  return (
    <>
      <PanelSection title={T.list}>
        <PanelSectionRow>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {T.summary(cols.length, state ? (gaming ? T.gaming : T.desktop) : "…",
                       state ? (state.steam ? T.running : T.stopped) : "…")}
          </div>
        </PanelSectionRow>
        {cols.map((c) => (
          <PanelSectionRow key={c.id || c.name}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
              <span>{c.name || T.unnamed}</span>
              <span style={{ opacity: 0.6 }}>{String(c.count ?? 0)}</span>
            </div>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={refresh} disabled={busy}>{T.refresh}</ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={T.newTitle}>
        <PanelSectionRow>
          <TextField
            label={T.name}
            value={name}
            onChange={(e) => setName((e.target as HTMLInputElement).value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={create} disabled={busy || gaming || !name.trim()}>
            {T.create}
          </ButtonItem>
        </PanelSectionRow>
        {gaming && <PanelSectionRow><div style={{ fontSize: 12, opacity: 0.7 }}>{T.needDesktopCreate}</div></PanelSectionRow>}
      </PanelSection>

      <PanelSection title={T.applyTitle}>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={apply} disabled={busy || gaming}>{T.apply}</ButtonItem>
        </PanelSectionRow>
        {gaming && <PanelSectionRow><div style={{ fontSize: 12, opacity: 0.7 }}>{T.needDesktopApply}</div></PanelSectionRow>}
        {msg && <PanelSectionRow><div role="status" style={{ fontSize: 12 }}>{msg}</div></PanelSectionRow>}
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  log("plugin factory");
  return { name: "Collection Manager", content: <Content />, icon: <Icon /> };
});
