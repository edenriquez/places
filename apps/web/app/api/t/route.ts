import { geolocation } from "@vercel/functions";
import { NextResponse, type NextRequest } from "next/server";
import { classifySource, deviceOf, isBot, TRACK_TYPES, type TrackPayload } from "@/lib/analytics";
import { parseLoc, LOC_COOKIE } from "@/lib/location";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set<string>(TRACK_TYPES);
const MAX_BODY = 2048;
const uuidOr = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

// slug → id del evento (las vistas llegan por URL); en memoria mientras viva la función
const slugIds = new Map<string, string | null>();
async function eventIdFor(sb: SupabaseClient, url: URL) {
  const slug = url.pathname.match(/^\/evento\/([\w-]+)/)?.[1] ?? url.searchParams.get("e");
  if (!slug) return null;
  if (!slugIds.has(slug)) {
    const { data } = await sb.from("events").select("id").eq("slug", slug).maybeSingle();
    if (slugIds.size > 2000) slugIds.clear();
    slugIds.set(slug, (data?.id as string | undefined) ?? null);
  }
  return slugIds.get(slug) ?? null;
}

/** Recibe los beacons de components/tracker.tsx. Siempre responde 204: la analítica nunca rompe la página. */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const ua = request.headers.get("user-agent");
    const visitor = uuidOr(request.cookies.get("el_vid")?.value);
    const sb = createServiceClient();
    if (!sb || !visitor || isBot(ua)) return done;

    const raw = await request.text();
    if (raw.length > MAX_BODY) return done;
    const p = JSON.parse(raw) as TrackPayload & { uid?: string };
    if (!TYPES.has(p.type) || typeof p.path !== "string") return done;

    const url = new URL(p.path, request.nextUrl.origin);
    if (/^\/(admin|reporte|api|auth)(\/|$)/.test(url.pathname)) return done;
    const { source, referrerHost } = classifySource(url, p.type === "pageview" ? p.referrer : undefined, request.nextUrl.hostname);
    const geo = geolocation(request);
    const loc = parseLoc(request.cookies.get(LOC_COOKIE)?.value);
    const hasLoc = !!request.cookies.get(LOC_COOKIE)?.value;
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p.props ?? {}).slice(0, 8)) props[k.slice(0, 32)] = typeof v === "string" ? v.slice(0, 120) : v;
    if (hasLoc && !loc.cvegeo && !loc.stateCve) Object.assign(props, { search_lat: loc.lat, search_lng: loc.lng });

    const round = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : null);
    await sb.from("analytics_events").insert({
      type: p.type,
      path: url.pathname.slice(0, 300),
      event_id: uuidOr(p.event) ?? (await eventIdFor(sb, url)),
      visitor_id: visitor,
      session_id: uuidOr(p.sessionId),
      user_id: uuidOr(p.uid),
      source: p.type === "pageview" ? source : "interno",
      referrer_host: clip(referrerHost, 120),
      utm_source: clip(url.searchParams.get("utm_source"), 60),
      utm_medium: clip(url.searchParams.get("utm_medium"), 60),
      utm_campaign: clip(url.searchParams.get("utm_campaign"), 60),
      geo_city: clip(geo.city, 80),
      geo_region: clip(geo.countryRegion, 8),
      geo_country: clip(geo.country, 4),
      geo_lat: round(geo.latitude),
      geo_lng: round(geo.longitude),
      search_cvegeo: hasLoc ? loc.cvegeo ?? null : null,
      device: deviceOf(ua),
      props,
    });
  } catch {
    // payload inválido o BD caída: se ignora
  }
  return done;
}
