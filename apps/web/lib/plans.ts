import { fmtTime } from "./format";
import type { NearRow } from "./types";

const TZ = "America/Mexico_City";
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const wd = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });

/** Días de calendario (hora del centro) entre hoy y la fecha: 0 hoy, 1 mañana… */
export function daysUntil(iso: string, now = new Date()) {
  const a = Date.parse(ymd.format(now));
  const b = Date.parse(ymd.format(new Date(iso)));
  return Math.round((b - a) / 86400e3);
}

export type PlanBucket = "ahora" | "hoy" | "manana" | "finde" | "despues";
export const BUCKET_TITLE: Record<PlanBucket, string> = {
  ahora: "Está pasando", hoy: "Hoy", manana: "Mañana", finde: "Este fin de semana", despues: "Más adelante",
};

export function bucketOf(e: Pick<NearRow, "starts_at" | "ends_at">, now = new Date()): PlanBucket {
  const s = new Date(e.starts_at).getTime();
  if (s <= now.getTime() && new Date(e.ends_at ?? e.starts_at).getTime() >= now.getTime()) return "ahora";
  const d = daysUntil(e.starts_at, now);
  if (d <= 0) return "hoy";
  if (d === 1) return "manana";
  // viernes a domingo de esta misma semana
  const idx = (x: Date) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd.format(x));
  return idx(new Date(e.starts_at)) >= 4 && d <= 6 - idx(now) ? "finde" : "despues";
}

/** "Tu plan es mañana" · "Tu plan es hoy a las 18:00" · null si falta más */
export function reminderText(e: Pick<NearRow, "starts_at" | "ends_at" | "is_all_day">, now = new Date()) {
  const b = bucketOf(e, now);
  if (b === "ahora") return "Tu plan está pasando ahora";
  if (b === "hoy") return e.is_all_day ? "Tu plan es hoy" : `Tu plan es hoy a las ${fmtTime(e.starts_at)}`;
  if (b === "manana") return e.is_all_day ? "Tu plan es mañana" : `Tu plan es mañana a las ${fmtTime(e.starts_at)}`;
  return null;
}

export const eventUrl = (siteUrl: string, slug: string, source: string) =>
  `${siteUrl}/evento/${slug}?utm_source=${source}&utm_medium=share&utm_campaign=mis_planes`;

export const whatsappShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const facebookShare = (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
