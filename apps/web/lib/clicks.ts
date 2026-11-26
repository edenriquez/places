import { getTrackUser, sessionIdIfAny } from "./track";

/**
 * Clics para el mapa de calor y el recorrido de cada visitante. Pensado para no costarle nada a la navegación:
 * el clic solo hace un push a un arreglo (sin medir el layout más allá de scrollWidth) y el lote sale con
 * sendBeacon, que el navegador manda en segundo plano, al cambiar de página, al ocultarse la pestaña o cada 25 clics.
 */
type Click = { p: string; x: number; y: number; vw: number; t?: string; ts: number };

const MAX_BATCH = 25;
const IGNORED = /^\/(admin|reporte|api|auth)(\/|$)/;
let queue: Click[] = [];
let wired = false;

/** Qué se tocó, en corto. Nunca el valor de un campo: solo etiquetas visibles de enlaces y botones. */
function describe(target: EventTarget | null): string | undefined {
  const el = target instanceof Element ? target : null;
  if (!el) return undefined;
  const tracked = el.closest<HTMLElement>("[data-track]");
  if (tracked) return `track:${tracked.dataset.track}${tracked.dataset.label ? `:${tracked.dataset.label}` : ""}`.slice(0, 80);
  const hit = el.closest<HTMLElement>("a,button,[role=button],[role=tab],summary,label,input,select,textarea");
  if (!hit) return undefined;
  const tag = hit.tagName.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return `${tag}:${hit.getAttribute("name") ?? hit.getAttribute("aria-label") ?? hit.getAttribute("type") ?? ""}`.slice(0, 80);
  const text = (hit.getAttribute("aria-label") ?? hit.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${tag}:${text}`;
}

export function recordClick(e: MouseEvent) {
  if (typeof window === "undefined" || navigator.webdriver || IGNORED.test(location.pathname)) return;
  const w = document.documentElement.scrollWidth || window.innerWidth;
  queue.push({
    p: location.pathname,
    x: Math.min(1, Math.max(0, e.pageX / w)),
    y: Math.max(0, Math.round(e.pageY)),
    vw: window.innerWidth,
    t: describe(e.target),
    ts: Date.now(),
  });
  if (queue.length >= MAX_BATCH) flushClicks();
  if (!wired) {
    wired = true;
    // pagehide/visibilitychange: la última oportunidad fiable en móvil (beforeunload no se dispara en iOS)
    addEventListener("pagehide", flushClicks);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flushClicks());
  }
}

export function flushClicks() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    const body = JSON.stringify({ sessionId: sessionIdIfAny(), uid: getTrackUser() ?? undefined, now: Date.now(), clicks: batch });
    if (!navigator.sendBeacon?.("/api/t/c", new Blob([body], { type: "application/json" }))) {
      fetch("/api/t/c", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // la analítica nunca rompe la página
  }
}
