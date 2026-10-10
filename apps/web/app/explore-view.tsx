import { ViewTransition } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopHeader, DesktopOnly } from "@/components/desktop";
import { EventPanel, eventCoords } from "@/components/event-detail";
import { ExploreBody, ExploreMap, type ExploreLists } from "@/components/explore-body";
import { SearchBar } from "@/components/location-picker";
import { LocationPrompt } from "@/components/location-prompt";
import { getLoc, hasLoc } from "@/lib/location-server";
import { nearText } from "@/lib/location";
import { eventBySlug, eventsAround, eventsLiveNear, eventsNear, municipalities, stateBox, withCoords } from "@/lib/queries";
import type { NearRow } from "@/lib/types";

const LOCAL_KM = 10;
const RANGES = ["finde", "15d", "todo"] as const;

export type ExploreParams = { r?: string; c?: string; i?: string; e?: string };

/**
 * Lista de eventos (Explorar). En escritorio: `split` = lista + mapa fijo a la derecha (/mapa);
 * sin split = solo eventos a lo ancho (/). En móvil se ve igual en ambos casos.
 * La categoría (?i=, ?c=) no se consulta aquí: llegan todos los eventos y el navegador los filtra al tocar.
 */
export async function ExploreView({ sp, split = false, basePath = "/" }: { sp: ExploreParams; split?: boolean; basePath?: string }) {
  const range = RANGES.find((r) => r === sp.r) ?? "finde";
  const [loc, isSet] = await Promise.all([getLoc(), hasLoc()]);
  // El radio (1 h/2 h/3 h/Explorar) solo aplica en el mapa. En la lista no hay límite de km:
  //  1) "tu zona" en el rango de fechas, por fecha: tu municipio (o ≤ LOCAL_KM del GPS), o el estado elegido
  //  2) "Más eventos cerca de ti": todo lo demás que viene, del más cercano al más lejano
  const anywhere = { ...loc, radiusKm: 400 };
  const [munis, liveAll, inRange, allUpcoming, suggestions] = await Promise.all([
    municipalities(),
    eventsLiveNear(isSet ? anywhere : { ...loc, radiusKm: 400, stateCve: undefined }),
    isSet ? eventsNear(anywhere, range) : Promise.resolve([] as NearRow[]),
    isSet ? eventsNear({ ...anywhere, stateCve: undefined }, "todo") : Promise.resolve([] as NearRow[]),
    isSet ? Promise.resolve([] as NearRow[]) : eventsAround(loc),
  ]);
  const isLocal = (e: NearRow) => !!loc.stateCve || e.municipality_cvegeo === loc.cvegeo || e.distance_m <= LOCAL_KM * 1000;
  const upcoming = inRange.filter(isLocal);
  const shown = new Set(upcoming.map((e) => e.event_id));
  const lists: ExploreLists = {
    live: [...liveAll].sort((a, b) => a.distance_m - b.distance_m),
    upcoming,
    nearby: allUpcoming
      .filter((e) => !shown.has(e.event_id))
      .sort((a, b) => a.distance_m - b.distance_m)
      .map((e) => ({ ...e, away: !isLocal(e) })),
    suggestions,
  };
  // GPS sin pueblo cercano: "tu zona"; GPS con pueblo: "Tlalmanalco" (setLocation ya lo nombró)
  const area = loc.stateCve || loc.cvegeo || loc.label !== "Tu ubicación" ? loc.label : "tu zona";
  // pines del mapa de escritorio: lo mismo que muestra la lista (el filtro se aplica en el cliente)
  const coords = split
    ? Object.fromEntries((await withCoords([...lists.live, ...upcoming, ...lists.nearby, ...lists.suggestions])).map((e) => [e.event_id, [e.lat, e.lng] as [number, number]]))
    : {};
  // /mapa en escritorio: ?e=slug abre el detalle en el panel izquierdo (el mapa se centra en el evento)
  const detail = split && sp.e ? await eventBySlug(sp.e) : null;
  const listQs = new URLSearchParams(Object.entries({ r: sp.r, c: sp.c, i: sp.i }).filter((kv): kv is [string, string] => !!kv[1])).toString();
  const listHref = listQs ? `${basePath}?${listQs}` : basePath;
  const focusCoords = detail ? eventCoords(detail) : null;
  const focus = detail && focusCoords ? { id: detail.event.id, ...focusCoords } : null;

  return (
    <>
    {/* el encabezado no se anima: queda fijo mientras la lista y el mapa se acomodan */}
    <ViewTransition name="site-header" share="none" default="none">
      <div><DesktopHeader><SearchBar loc={loc} municipalities={munis} isSet={isSet} header /></DesktopHeader></div>
    </ViewTransition>
    {/* escritorio: con split, lista a la izquierda y mapa fijo a la derecha; sin split, solo la lista a lo ancho */}
    <div className={split ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,42%)]" : ""}>
    <main className={split
      ? "mx-auto max-w-screen-sm pb-28 lg:mx-0 lg:max-w-none lg:px-3 lg:pb-12"
      : "mx-auto max-w-screen-sm pb-28 lg:w-full lg:max-w-(--wrap) lg:pb-12 lg:[--card:288px] lg:[--cols:3] lg:[--wrap:calc(var(--cols)*var(--card)_+_(var(--cols)_-_1)*12px)] xl:[--card:292px] xl:[--cols:4] 2xl:[--card:328px]"}>
      {/* la página no tiene un título visible; el h1 le dice a buscadores y lectores de pantalla de qué trata */}
      {!split && <h1 className="sr-only">Ferias, fiestas y eventos {isSet ? nearText(loc) : "en pueblos de Morelos, Estado de México, Puebla y CDMX"}</h1>}
      {detail ? (
        <EventPanel d={detail} backHref={listHref} />
      ) : (
        <>
          <div className="lg:hidden"><SearchBar loc={loc} municipalities={munis} isSet={isSet} /></div>
          {!isSet && <LocationPrompt />}
          <ExploreBody
            lists={lists}
            range={range}
            basePath={basePath}
            split={split}
            isSet={isSet}
            area={area}
            liveSubtitle={isSet ? `Activos en este momento ${nearText(loc)}` : "Activos en este momento en la región"}
            hideDistance={!!loc.stateCve}
            startUpcoming={!!sp.r}
          />
        </>
      )}

      <BottomNav />
    </main>
    {/* nombre de view transition directo en CSS: el navegador lo anima al entrar/salir (ver globals.css) */}
    {split && (
      <aside style={{ viewTransitionName: "map-panel" }} className="sticky top-[76px] hidden h-[calc(100dvh-76px)] border-l border-line bg-[#f2f2ef] lg:block">
        <DesktopOnly>
          <div className="relative h-full">
            <ExploreMap lists={lists} coords={coords} loc={loc} stateBounds={stateBox(munis, loc.stateCve)} focus={focus} />
          </div>
        </DesktopOnly>
      </aside>
    )}
    </div>
    </>
  );
}
