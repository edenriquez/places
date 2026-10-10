import { BottomNav } from "@/components/bottom-nav";
import { BottomSheet } from "@/components/bottom-sheet";
import { MobileOnly } from "@/components/desktop";
import { EventPanel, eventCoords } from "@/components/event-detail";
import { ExploreView, type ExploreParams } from "../explore-view";
import { EventMap } from "@/components/event-map";
import { SearchBar } from "@/components/location-picker";
import { getLoc } from "@/lib/location-server";
import { EXPLORE, nearText } from "@/lib/location";
import { pageMetadata } from "@/lib/site";
import { eventBySlug, eventsNear, municipalities, stateBox, withCoords, type Range } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { GroupPlan } from "@/lib/group-plans";

export const dynamic = "force-dynamic";
// ?e=, ?r= y ?c= abren un evento o filtran: la página canónica es /mapa
export const metadata = pageMetadata({
  title: "Mapa de eventos cerca de ti",
  description: "Mapa de ferias, fiestas, conciertos y mercados en pueblos de Morelos, Estado de México, Puebla y CDMX. Elige a cuánto tiempo de camino y ve qué hay hoy y este fin de semana.",
  path: "/mapa",
});

export default async function MapPage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  const sp = await searchParams;
  const loc = await getLoc();
  // móvil: el mapa sigue el rango elegido en la lista; sin rango, todo lo que viene
  const range: Range = sp.r === "finde" || sp.r === "15d" ? sp.r : "todo";
  // con un punto, el mapa baja toda la región y muestra lo que cabe en el alcance del zoom; con un estado, solo el estado
  const mapLoc = loc.stateCve ? loc : { ...loc, radiusKm: EXPLORE };
  const sb = await createClient();
  const [munis, rows, { data: planRows }] = await Promise.all([
    municipalities(),
    eventsNear(mapLoc, range),
    // planes abiertos de la comunidad (estado: ~150 km del centro; con un punto: toda la región)
    sb.rpc("community_plans_near", { p_lat: loc.lat, p_lng: loc.lng, p_radius_m: loc.stateCve ? 150000 : 0 }),
  ]);
  const plans = ((planRows ?? []) as GroupPlan[]).filter((p) => p.target.lat != null && p.target.lng != null);
  // si no hay nada en el radio, sugerir lo más cercano fuera de él
  const nearest = rows.length ? null : (await eventsNear({ ...loc, radiusKm: 400, stateCve: undefined }, range)).sort((a, b) => a.distance_m - b.distance_m)[0] ?? null;

  const events = await withCoords(rows);

  const stateBounds = stateBox(munis, loc.stateCve);
  // móvil: ?e=slug abre el evento en una hoja inferior sobre el mapa
  const detail = sp.e ? await eventBySlug(sp.e) : null;
  const coords = detail ? eventCoords(detail) : null;
  const focus = detail && coords ? { id: detail.event.id, ...coords } : null;
  const listQs = new URLSearchParams(Object.entries({ r: sp.r, c: sp.c, ver: sp.ver }).filter((kv): kv is [string, string] => !!kv[1])).toString();
  const closeHref = listQs ? `/mapa?${listQs}` : "/mapa";

  return (
    <>
    <h1 className="sr-only">Mapa de eventos {nearText(loc)}</h1>
    {/* escritorio: lista + mapa (split) */}
    <div className="hidden lg:block"><ExploreView sp={sp} split basePath="/mapa" /></div>
    {/* móvil: mapa a pantalla completa */}
    <main className="fixed inset-0 mx-auto max-w-screen-sm lg:hidden">
      <MobileOnly>
        <EventMap events={events} plans={plans} loc={loc} stateBounds={stateBounds} focus={focus} nearest={nearest}
          searchBar={<SearchBar key="search" loc={loc} municipalities={munis} compact />} />
      </MobileOnly>
      <BottomNav />
      {detail && (
        <BottomSheet key={detail.event.id} closeHref={closeHref} label={detail.event.title}>
          <EventPanel d={detail} backHref={closeHref} sheet />
        </BottomSheet>
      )}
    </main>
    </>
  );
}
