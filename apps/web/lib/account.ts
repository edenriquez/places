import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, NearRow, RawIngestion } from "./types";

type Point = Omit<NearRow, "distance_m" | "place_id"> & { occurrence_id: string };

/** Un evento por fila: su próxima fecha, o la última si ya pasó. */
export async function eventRows(sb: SupabaseClient, ids: string[]) {
  const upcoming: NearRow[] = [];
  const past: NearRow[] = [];
  if (!ids.length) return { upcoming, past };
  const { data } = await sb.from("event_points_view").select("*").in("event_id", ids);
  const byEvent = new Map<string, Point[]>();
  for (const p of (data ?? []) as Point[]) byEvent.set(p.event_id, [...(byEvent.get(p.event_id) ?? []), p]);
  const now = Date.now();
  for (const occ of byEvent.values()) {
    occ.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const next = occ.find((o) => new Date(o.ends_at ?? o.starts_at).getTime() >= now);
    const row = { ...(next ?? occ[occ.length - 1]), distance_m: 0, place_id: null };
    (next ? upcoming : past).push(row);
  }
  upcoming.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  past.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return { upcoming, past };
}

export const COMPANIONS = [
  { id: "sola", label: "Por mi cuenta" },
  { id: "pareja", label: "En pareja" },
  { id: "amigos", label: "Con amigos" },
  { id: "familia", label: "En familia" },
  { id: "peques", label: "Con peques" },
] as const;

export type Profile = { home_municipality: string | null; categories: string[]; companions: string[] };

export type Submission = Pick<RawIngestion, "id" | "status" | "received_at" | "event_id"> & {
  media_path: string | null;
  event_slug: string | null;
  title: string | null;
};

/** Todo lo que muestra /perfil de una persona con sesión. */
export async function accountSummary(sb: SupabaseClient, userId: string) {
  const [saved, interests, profile, subs] = await Promise.all([
    sb.from("saved_events").select("event_id"),
    sb.from("event_interests").select("event_id"),
    sb.from("profiles").select("home_municipality,categories,companions").eq("user_id", userId).maybeSingle(),
    sb.from("raw_ingestions").select("id,status,received_at,event_id,media_path,extraction").eq("uploaded_by", userId).order("received_at", { ascending: false }).limit(10),
  ]);
  const savedIds = (saved.data ?? []).map((r) => r.event_id as string);
  const interestIds = (interests.data ?? []).map((r) => r.event_id as string);
  const all = [...new Set([...savedIds, ...interestIds])];

  // qué le mueve: categorías de lo que guarda o le interesa (el interés pesa doble: dice que va)
  const { data: cats } = all.length ? await sb.from("events").select("id,category").in("id", all) : { data: [] };
  const weight = new Map<Category, number>();
  for (const e of (cats ?? []) as { id: string; category: Category }[]) {
    const w = (savedIds.includes(e.id) ? 1 : 0) + (interestIds.includes(e.id) ? 2 : 0);
    weight.set(e.category, (weight.get(e.category) ?? 0) + w);
  }
  const topCategories = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const { upcoming } = await eventRows(sb, all);
  const interestSet = new Set(interestIds);

  // envíos: título del evento publicado o, si no, el que sacó el modelo
  const subRows = (subs.data ?? []) as (Submission & { extraction: { title?: string } | null })[];
  const eventIds = subRows.map((s) => s.event_id).filter((x): x is string => !!x);
  const { data: evs } = eventIds.length ? await sb.from("events").select("id,slug,title").in("id", eventIds) : { data: [] };
  const evById = new Map((evs ?? []).map((e) => [e.id as string, e as { slug: string; title: string }]));
  const submissions: Submission[] = subRows.map(({ extraction, ...s }) => ({
    ...s,
    event_slug: s.event_id ? evById.get(s.event_id)?.slug ?? null : null,
    title: (s.event_id && evById.get(s.event_id)?.title) || extraction?.title || null,
  }));

  return {
    savedCount: savedIds.length,
    interestCount: interestIds.length,
    topCategories,
    agenda: upcoming.slice(0, 3).map((e) => ({ ...e, going: interestSet.has(e.event_id) })),
    upcomingCount: upcoming.length,
    profile: (profile.data ?? { home_municipality: null, categories: [], companions: [] }) as Profile,
    submissions,
  };
}
