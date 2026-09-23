import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "./supabase/server";
import type { Event, Festivity, Municipality, NearRow, Occurrence, Place } from "./types";
import { EXPLORE, type Loc } from "./location";

/**
 * Caché de datos públicos (sin cookies): la BD vive en us-west-2 y cada viaje cuesta. Las acciones del admin
 * invalidan con updateTag(EVENTS_TAG); lo que llega por el script de seed aparece al vencer el TTL.
 */
export const EVENTS_TAG = "events";
const EVENTS_TTL = 300;
const LIVE_TTL = 60;

// "ahora" y las coordenadas se redondean para que visitas cercanas compartan entrada de caché
const bucket = (d: Date) => new Date(Math.floor(d.getTime() / (EVENTS_TTL * 1000)) * EVENTS_TTL * 1000).toISOString();
const round = (x: number) => Math.round(x * 1000) / 1000; // ~100 m

type NearArgs = { lat: number; lng: number; radius_m: number; from_ts: string; to_ts: string };

const rpcEventsNear = unstable_cache(
  async (args: NearArgs) => {
    const { data, error } = await createAnonClient().rpc("events_near", args);
    if (error) throw error;
    return (data ?? []) as NearRow[];
  },
  ["events_near"],
  { tags: [EVENTS_TAG], revalidate: EVENTS_TTL },
);

const rpcEventsLiveNear = unstable_cache(
  async (args: { lat: number; lng: number; radius_m: number }) => {
    const { data, error } = await createAnonClient().rpc("events_live_near", args);
    if (error) throw error;
    return (data ?? []) as NearRow[];
  },
  ["events_live_near"],
  { tags: [EVENTS_TAG], revalidate: LIVE_TTL },
);

function weekendRange(now = new Date()) {
  // viernes 00:00 → domingo 23:59 (hora local del servidor; suficiente para el MVP)
  const d = new Date(now);
  const dow = d.getDay(); // 0 dom … 6 sáb
  const toFri = dow <= 5 ? 5 - dow : 6; // si es domingo, el próximo viernes
  const fri = new Date(d);
  fri.setDate(d.getDate() + (dow === 0 ? -2 : toFri));
  fri.setHours(0, 0, 0, 0);
  const sun = new Date(fri);
  sun.setDate(fri.getDate() + 2);
  sun.setHours(23, 59, 59, 999);
  return { from: dow >= 5 || dow === 0 ? now : fri, to: sun };
}

// en modo estado se trae todo lo cercano al centro del estado y se filtra por la clave del estado
const radiusM = (loc: Loc) => (loc.stateCve || loc.radiusKm === EXPLORE ? 400_000 : loc.radiusKm * 1000);
const inState = (loc: Loc, rows: NearRow[]) => (loc.stateCve ? rows.filter((r) => r.municipality_cvegeo.startsWith(loc.stateCve!)) : rows);

export type Range = "finde" | "15d" | "todo";

export function rangeBounds(range: Range, now = new Date()) {
  const end = new Date(now);
  switch (range) {
    case "finde":
      return weekendRange(now);
    case "15d":
      end.setDate(end.getDate() + 15);
      return { from: now, to: end };
    default:
      end.setDate(end.getDate() + 90);
      return { from: now, to: end };
  }
}

export async function eventsNear(loc: Loc, range: Range = "finde", category?: string): Promise<NearRow[]> {
  const { from, to } = rangeBounds(range);
  const data = await rpcEventsNear({
    lat: round(loc.lat),
    lng: round(loc.lng),
    radius_m: radiusM(loc),
    from_ts: bucket(from),
    to_ts: bucket(to),
  });
  // una fila por evento: la RPC ya viene ordenada por fecha asc, así que la primera es la próxima fecha
  const seen = new Set<string>();
  const rows = inState(loc, data).filter((r) => !seen.has(r.event_id) && !!seen.add(r.event_id));
  return category ? rows.filter((r) => r.category === category) : rows;
}

/** Sugerencias cuando no hay ubicación o no hay nada cerca: una muestra al azar de lo que viene en toda la región, por fecha. */
export async function eventsAround(loc: Loc, category?: string, limit = 8): Promise<NearRow[]> {
  const rows = await eventsNear({ ...loc, radiusKm: 400, stateCve: undefined }, "todo", category);
  const pick = rows.length > limit ? [...rows].sort(() => Math.random() - 0.5).slice(0, limit) : rows;
  return pick.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Coordenadas por evento (lugar o centro del municipio) para pintar pines. */
const eventPoints = unstable_cache(
  async (ids: string[]) => {
    const { data } = await createAnonClient().from("event_points_view").select("event_id,lat,lng").in("event_id", ids);
    return (data ?? []) as { event_id: string; lat: number; lng: number }[];
  },
  ["event_points"],
  { tags: [EVENTS_TAG], revalidate: EVENTS_TTL },
);

export async function withCoords(rows: NearRow[]): Promise<(NearRow & { lat: number; lng: number })[]> {
  const ids = [...new Set(rows.map((r) => r.event_id))].sort();
  if (!ids.length) return [];
  const coord = new Map((await eventPoints(ids)).map((p) => [p.event_id, p]));
  return rows
    .map((r) => ({ ...r, lat: coord.get(r.event_id)?.lat ?? null, lng: coord.get(r.event_id)?.lng ?? null }))
    .filter((r): r is NearRow & { lat: number; lng: number } => r.lat != null && r.lng != null);
}

/** Caja [[oeste, sur], [este, norte]] de los municipios de un estado, con margen. */
export function stateBox(munis: Municipality[], stateCve?: string): [[number, number], [number, number]] | undefined {
  const ms = stateCve ? munis.filter((m) => m.cvegeo.startsWith(stateCve)) : [];
  if (!ms.length) return undefined;
  const lngs = ms.map((m) => m.lng), lats = ms.map((m) => m.lat);
  return [[Math.min(...lngs) - 0.15, Math.min(...lats) - 0.15], [Math.max(...lngs) + 0.15, Math.max(...lats) + 0.15]];
}

export async function eventsLiveNear(loc: Loc): Promise<NearRow[]> {
  const data = await rpcEventsLiveNear({ lat: round(loc.lat), lng: round(loc.lng), radius_m: radiusM(loc) });
  return inState(loc, data);
}

// el catálogo de municipios casi no cambia: un día
export const municipalities = unstable_cache(
  async (): Promise<Municipality[]> => {
    const sb = createAnonClient();
    const { data, error } = await sb
      .from("municipalities_view")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as Municipality[];
  },
  ["municipalities"],
  { revalidate: 86400 },
);

export async function municipalityBySlug(slug: string) {
  const sb = createAnonClient();
  const { data } = await sb.from("municipalities_view").select("*").eq("slug", slug).maybeSingle();
  return data as Municipality | null;
}

const cachedEventBySlug = unstable_cache(async (slug: string) => {
  const sb = createAnonClient();
  const { data: event } = await sb.from("events").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!event) return null;
  const [{ data: occ }, { data: place }, { data: muni }, { data: org }] = await Promise.all([
    sb.from("event_occurrences").select("*").eq("event_id", event.id).order("starts_at"),
    event.place_id ? sb.from("places_view").select("*").eq("id", event.place_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("municipalities_view").select("*").eq("cvegeo", event.municipality_cvegeo).maybeSingle(),
    event.org_id ? sb.from("organizations").select("id,name,kind,logo_url").eq("id", event.org_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    event: event as Event,
    occurrences: (occ ?? []) as Occurrence[],
    place: place as Place | null,
    municipality: muni as Municipality | null,
    organization: org as { id: string; name: string; kind: string; logo_url: string | null } | null,
  };
}, ["event_by_slug"], { tags: [EVENTS_TAG], revalidate: EVENTS_TTL });

// cache(): generateMetadata, la página y la imagen OG comparten una sola llamada por request
export const eventBySlug = cache((slug: string) => cachedEventBySlug(slug));

/** `at`: centro del municipio si ya lo tienes (ahorra un viaje a la BD). */
export async function municipalityEvents(cvegeo: string, limit = 12, at?: { lat: number; lng: number }): Promise<NearRow[]> {
  const m = at ?? (await createAnonClient().from("municipalities_view").select("lat,lng").eq("cvegeo", cvegeo).maybeSingle()).data;
  if (!m) return [];
  const now = new Date();
  const data = await rpcEventsNear({
    lat: round(m.lat), lng: round(m.lng), radius_m: 25000,
    from_ts: bucket(now),
    to_ts: bucket(new Date(now.getTime() + 90 * 86400000)),
  });
  return data.filter((r) => r.municipality_cvegeo === cvegeo).slice(0, limit);
}

export async function municipalityFestivities(cvegeo: string): Promise<Festivity[]> {
  const sb = createAnonClient();
  const { data } = await sb.from("festivities").select("*").eq("municipality_cvegeo", cvegeo).order("month", { nullsFirst: false });
  return (data ?? []) as Festivity[];
}

export async function municipalityPlaces(cvegeo: string, limit = 8): Promise<Place[]> {
  const sb = createAnonClient();
  const { data } = await sb
    .from("places_view")
    .select("*")
    .eq("municipality_cvegeo", cvegeo)
    .in("kind", ["museo", "teatro", "casa_cultura", "centro_cultural", "zona_arqueologica", "galeria", "auditorio", "templo", "plaza", "mercado", "ex_hacienda"])
    .order("kind")
    .limit(limit);
  return (data ?? []) as Place[];
}
