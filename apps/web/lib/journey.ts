import { ACTION_LABEL } from "./analytics";

/** Nombre legible de cada paso del recorrido (tipos de analytics_events + "click"). */
export const STEP_LABEL: Record<string, string> = {
  ...ACTION_LABEL,
  pageview: "Abrió",
  click: "Tocó",
  flyer_zoom: "Amplió el flyer",
  unsave: "Quitó de guardados",
  uninterest: "Quitó me interesa",
  login_start: "Empezó a iniciar sesión",
  search: "Buscó",
  filter: "Filtró",
  plan_create: "Armó un plan",
  plan_join: "Se unió a un plan",
  plan_invite: "Invitó a un plan",
  no_results: "Sin resultados",
};

/** "a:Ver evento" → "Ver evento"; "track:maps" → "Abrir en Maps"; "input:q" → "campo q". */
export function targetLabel(t: string | null | undefined) {
  if (!t) return "un espacio sin botón";
  const [kind, ...rest] = t.split(":");
  const val = rest.join(":");
  if (kind === "track") {
    const [type, ...label] = rest;
    return [STEP_LABEL[type] ?? type, label.join(":")].filter(Boolean).join(" · ");
  }
  if (kind === "input" || kind === "select" || kind === "textarea") return `campo ${val || kind}`;
  return val || kind;
}
