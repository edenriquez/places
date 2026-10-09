import { fmtPrice } from "./format";
import type { IntentKey } from "./intents";

/** Tipos de experiencia (columna experiences.kind). `intent`: en qué plan de la portada aparece. */
export const EXPERIENCE_KINDS = {
  senderismo: { label: "Senderismo", emoji: "🥾", intent: "naturaleza" },
  montanismo: { label: "Montañismo", emoji: "🏔️", intent: "naturaleza" },
  ecoturismo: { label: "Ecoturismo", emoji: "🌲", intent: "naturaleza" },
  cascadas: { label: "Cascadas", emoji: "💦", intent: "naturaleza" },
  aves: { label: "Aves", emoji: "🐦", intent: "naturaleza" },
  fauna: { label: "Fauna", emoji: "🦌", intent: "naturaleza" },
  astronomia: { label: "Cielo nocturno", emoji: "🌌", intent: "naturaleza" },
  ciclismo: { label: "Bici de montaña", emoji: "🚵", intent: "naturaleza" },
  campismo: { label: "Campismo", emoji: "🏕️", intent: "naturaleza" },
  interpretativo: { label: "Recorrido interpretativo", emoji: "🧭", intent: "naturaleza" },
  fotografia: { label: "Fotografía", emoji: "📷", intent: "naturaleza" },
  educacion_ambiental: { label: "Educación ambiental", emoji: "🌱", intent: "familia" },
  gastronomia: { label: "Gastronomía", emoji: "🍳", intent: "comida" },
  taller_artesanal: { label: "Taller artesanal", emoji: "🏺", intent: "cultura" },
  cultural: { label: "Cultural", emoji: "🎭", intent: "cultura" },
  agricola: { label: "Agrícola", emoji: "🌽", intent: "familia" },
  cabalgata: { label: "Cabalgata", emoji: "🐴", intent: "naturaleza" },
  productores: { label: "Tour de productores", emoji: "🧀", intent: "comida" },
  enoturismo: { label: "Enoturismo", emoji: "🍷", intent: "comida" },
  historico: { label: "Recorrido histórico", emoji: "🏛️", intent: "cultura" },
} as const satisfies Record<string, { label: string; emoji: string; intent: IntentKey }>;

export type ExperienceKind = keyof typeof EXPERIENCE_KINDS;

export const kindsForIntent = (intent: IntentKey) =>
  (Object.keys(EXPERIENCE_KINDS) as ExperienceKind[]).filter((k) => EXPERIENCE_KINDS[k].intent === intent);

export const DIFFICULTY_LABEL = { facil: "Fácil", moderada: "Moderada", dificil: "Difícil" } as const;
export type Difficulty = keyof typeof DIFFICULTY_LABEL;

/** "$50", "Gratis" o "Consultar"; la nota ("acceso", "con guía") va aparte. */
export const fmtExperiencePrice = (x: { is_free: boolean; price_min: number | null; price_max: number | null }) =>
  fmtPrice(x.is_free, x.price_min, x.price_max);

/** "7 km" / "3.5 km" */
export const fmtKm = (km: number | null) => (km == null ? null : `${Number(km).toLocaleString("es-MX", { maximumFractionDigits: 1 })} km`);
