import { createAnonClient } from "./supabase/server";
import type { Event, Festivity, Municipality, NearRow, Occurrence, Place } from "./types";
import type { Loc } from "./location";

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

export type Range = "hoy" | "finde" | "15d" | "todo";

export function rangeBounds(range: Range, now = new Date()) {
  const end = new Date(now);
  switch (range) {
    case "hoy":
      end.setHours(23, 59, 59, 999);
      return { from: now, to: end };
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
  const sb = createAnonClient();
  const { from, to } = rangeBounds(range);
  const { data, error } = await sb.rpc("events_near", {
    lat: loc.lat,
    lng: loc.lng,
    radius_m: loc.radiusKm * 1000,
    from_ts: from.toISOString(),
    to_ts: to.toISOString(),
  });
  if (error) throw error;
  const rows = (data ?? []) as NearRow[];
  return category ? rows.filter((r) => r.category === category) : rows;
}

export async function eventsLiveNear(loc: Loc): Promise<NearRow[]> {
  const sb = createAnonClient();
  const { data, error } = await sb.rpc("events_live_near", {
    lat: loc.lat,
    lng: loc.lng,
    radius_m: loc.radiusKm * 1000,
  });
  if (error) throw error;
  return (data ?? []) as NearRow[];
}

export async function municipalities(): Promise<Municipality[]> {
  const sb = createAnonClient();
  const { data, error } = await sb
    .from("municipalities_view")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Municipality[];
}

export async function municipalityBySlug(slug: string) {
  const sb = createAnonClient();
  const { data } = await sb.from("municipalities_view").select("*").eq("slug", slug).maybeSingle();
  return data as Municipality | null;
}

export async function eventBySlug(slug: string) {
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
}

export async function municipalityEvents(cvegeo: string, limit = 12): Promise<NearRow[]> {
  const sb = createAnonClient();
  const { data: m } = await sb.from("municipalities_view").select("lat,lng").eq("cvegeo", cvegeo).maybeSingle();
  if (!m) return [];
  const { data } = await sb.rpc("events_near", {
    lat: m.lat, lng: m.lng, radius_m: 25000,
    from_ts: new Date().toISOString(),
    to_ts: new Date(Date.now() + 90 * 86400000).toISOString(),
  });
  return ((data ?? []) as NearRow[]).filter((r) => r.municipality_cvegeo === cvegeo).slice(0, limit);
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
