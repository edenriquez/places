import type { TrackPayload, TrackType } from "./analytics";

const VID_COOKIE = "el_vid";
const SESSION_KEY = "el_sid";
const SESSION_IDLE_MS = 30 * 60 * 1000;
// el admin y el reporte del comercio no cuentan como uso del público
const IGNORED = /^\/(admin|reporte|api|auth)(\/|$)/;

let userId: string | null = null;
let lastPath: string | null = null;

/** El provider de sesión avisa quién es (para atar las acciones a la cuenta). */
export function setTrackUser(id: string | null) {
  userId = id;
}

/** Id anónimo del navegador (cookie propia, 1 año). */
function visitorId() {
  const m = document.cookie.match(/(?:^|; )el_vid=([^;]+)/);
  if (m) return m[1];
  const id = crypto.randomUUID();
  document.cookie = `${VID_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  return id;
}

/** Sesión: se renueva tras 30 min sin actividad. */
function sessionId() {
  try {
    const now = Date.now();
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as { id: string; at: number } | null;
    const id = s && now - s.at < SESSION_IDLE_MS ? s.id : crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: now }));
    return id;
  } catch {
    return undefined;
  }
}

export function track(type: TrackType, extra: { event?: string; props?: TrackPayload["props"] } = {}) {
  if (typeof window === "undefined" || IGNORED.test(location.pathname)) return;
  try {
    visitorId();
    const path = location.pathname + location.search;
    // la primera vista trae el referer externo; las siguientes vienen de dentro del sitio
    const referrer = type === "pageview" ? (lastPath ? location.origin + lastPath : document.referrer || undefined) : undefined;
    if (type === "pageview") lastPath = path;
    const body = JSON.stringify({ type, path, referrer, sessionId: sessionId(), uid: userId ?? undefined, ...extra });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/t", blob)) fetch("/api/t", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // la analítica nunca rompe la página
  }
}
