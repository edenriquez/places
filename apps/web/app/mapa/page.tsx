import Link from "next/link";
import { Compass } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { BottomSheet } from "@/components/bottom-sheet";
import { MobileOnly } from "@/components/desktop";
import { EventPanel, eventCoords } from "@/components/event-detail";
import { ExploreView, type ExploreParams } from "../explore-view";
import { EventMap } from "@/components/event-map";
import { SearchBar } from "@/components/location-picker";
import { getLoc } from "@/lib/location-server";
import { eventBySlug, eventsNear, municipalities, stateBox, withCoords, type Range } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapa" };

export default async function MapPage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  const sp = await searchParams;
  const loc = await getLoc();
  // móvil: el mapa sigue el rango elegido en la lista; sin rango, todo lo que viene
  const range: Range = sp.r === "finde" || sp.r === "15d" ? sp.r : "todo";
  const [munis, rows] = await Promise.all([municipalities(), eventsNear(loc, range)]);
  // si no hay nada en el radio, sugerir lo más cercano fuera de él
  const nearest = rows.length ? null : (await eventsNear({ ...loc, radiusKm: 400, stateCve: undefined }, range)).sort((a, b) => a.distance_m - b.distance_m)[0] ?? null;

  const events = await withCoords(rows);

  const stateBounds = stateBox(munis, loc.stateCve);
  // móvil: ?e=slug abre el evento en una hoja inferior sobre el mapa
  const detail = sp.e ? await eventBySlug(sp.e) : null;
  const coords = detail ? eventCoords(detail) : null;
  const focus = detail && coords ? { id: detail.event.id, ...coords } : null;
  const listQs = new URLSearchParams(Object.entries({ r: sp.r, c: sp.c }).filter((kv): kv is [string, string] => !!kv[1])).toString();
  const closeHref = listQs ? `/mapa?${listQs}` : "/mapa";

  return (
    <>
    {/* escritorio: lista + mapa (split) */}
    <div className="hidden lg:block"><ExploreView sp={sp} split basePath="/mapa" /></div>
    {/* móvil: mapa a pantalla completa */}
    <main className="fixed inset-0 mx-auto max-w-screen-sm lg:hidden">
      <MobileOnly><EventMap events={events} loc={loc} stateBounds={stateBounds} focus={focus} nearest={nearest} /></MobileOnly>
      <div className="absolute inset-x-0 top-0 z-20">
        <SearchBar loc={loc} municipalities={munis} compact />
      </div>
      <Link href="/" className="absolute bottom-[calc(82px+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white shadow-float">
        <Compass size={16} /> Explorar
      </Link>
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
