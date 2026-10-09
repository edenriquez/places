import type { Category } from "./types";

/**
 * "¿Qué quieres hacer?": la persona elige un plan, no una categoría del catálogo. Cada intención junta las
 * categorías que la cumplen (un taller puede ser plan de familia o de cultura).
 */
export const INTENTS = [
  { key: "musica", label: "Música", hint: "Conciertos y baile", cats: ["concierto", "danza"] },
  { key: "fiesta", label: "Fiesta", hint: "Ferias y fiestas de pueblo", cats: ["feria", "fiesta_patronal", "religioso"] },
  { key: "comida", label: "Comida", hint: "Mercados y ferias gastronómicas", cats: ["gastronomia", "mercado"] },
  { key: "naturaleza", label: "Naturaleza", hint: "Caminatas, bici y aire libre", cats: ["deporte"] },
  { key: "familia", label: "Familia", hint: "Para ir con peques", cats: ["infantil", "taller"] },
  { key: "cultura", label: "Cultura", hint: "Teatro, cine y exposiciones", cats: ["teatro", "exposicion", "cine", "taller"] },
] as const satisfies readonly { key: string; label: string; hint: string; cats: readonly Category[] }[];

export type IntentKey = (typeof INTENTS)[number]["key"];
export type Intent = (typeof INTENTS)[number];

export const intentByKey = (key: string | undefined): Intent | undefined => INTENTS.find((i) => i.key === key);
