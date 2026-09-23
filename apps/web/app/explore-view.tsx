import Link from "next/link";
import { ViewTransition } from "react";
import { Map } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CategoryRow } from "@/components/category-row";
import { DesktopHeader, DesktopOnly } from "@/components/desktop";
import { EventCard } from "@/components/event-card";
import { EventPanel, eventCoords } from "@/components/event-detail";
import { EventMap } from "@/components/event-map-lazy";
import { HomeFeed } from "@/components/home-feed";
import { SearchBar } from "@/components/location-picker";
import { LocationPrompt } from "@/components/location-prompt";
import { Chip, EmptyState, SectionHeader } from "@/components/ui";
import { getLoc, hasLoc } from "@/lib/location-server";
import { nearText } from "@/lib/location";
import { eventBySlug, eventsAround, eventsLiveNear, eventsNear, municipalities, stateBox, withCoords, type Range } from "@/lib/queries";
import type { NearRow } from "@/lib/types";

const LOCAL_KM = 10;

const RANGES: { key: Range; label: string }[] = [
  { key: "finde", label: "Este finde" },
  { key: "15d", label: "Próximos 15 días" },
  { key: "todo", label: "Todo" },
];

export type ExploreParams = { r?: string; c?: string; e?: string };

/**
 * Lista de eventos (Explorar). En escritorio: `split` = lista + mapa fijo a la derecha (/mapa);
 * sin split = solo eventos a lo ancho (/). En móvil se ve igual en ambos casos.
 */
export async function ExploreView({ sp, split = false, basePath = "/" }: { sp: ExploreParams; split?: boolean; basePath?: string }) {
  const range = (RANGES.some((x) => x.key === sp.r) ? sp.r : "finde") as Range;
  const category = sp.c;
  const [loc, isSet] = await Promise.all([getLoc(), hasLoc()]);
  // El radio (10/30/60/Explorar) solo aplica en el mapa. En la lista no hay límite de km:
  //  1) "tu zona" en el rango de fechas, por fecha: tu municipio (o ≤ LOCAL_KM del GPS), o el estado elegido
  //  2) "Más eventos cerca de ti": todo lo demás que viene, del más cercano al más lejano
  const anywhere = { ...loc, radiusKm: 400 };
  const [munis, liveAll, inRange, allUpcoming, suggestions] = await Promise.all([
    municipalities(),
    eventsLiveNear(isSet ? anywhere : { ...loc, radiusKm: 400, stateCve: undefined }),
    isSet ? eventsNear(anywhere, range, category) : Promise.resolve([] as NearRow[]),
    isSet ? eventsNear({ ...anywhere, stateCve: undefined }, "todo", category) : Promise.resolve([] as NearRow[]),
    isSet ? Promise.resolve([] as NearRow[]) : eventsAround(loc, category),
  ]);
  const live = (category ? liveAll.filter((e) => e.category === category) : liveAll).sort((a, b) => a.distance_m - b.distance_m);
  const isLocal = (e: NearRow) => !!loc.stateCve || e.municipality_cvegeo === loc.cvegeo || e.distance_m <= LOCAL_KM * 1000;
  const upcoming = inRange.filter(isLocal);
  const shown = new Set(upcoming.map((e) => e.event_id));
  const nearby = allUpcoming.filter((e) => !shown.has(e.event_id)).sort((a, b) => a.distance_m - b.distance_m);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  // GPS sin pueblo cercano: "tu zona"; GPS con pueblo: "Tlalmanalco" (setLocation ya lo nombró)
  const area = loc.stateCve || loc.cvegeo || loc.label !== "Tu ubicación" ? loc.label : "tu zona";
  // pines del mapa de escritorio: lo mismo que muestra la lista
  const mapEvents = split ? await withCoords([...live, ...upcoming, ...nearby, ...suggestions]) : [];
  // /mapa en escritorio: ?e=slug abre el detalle en el panel izquierdo (el mapa se centra en el evento)
  const detail = split && sp.e ? await eventBySlug(sp.e) : null;
  const listQs = new URLSearchParams(Object.entries({ r: sp.r, c: sp.c }).filter((kv): kv is [string, string] => !!kv[1])).toString();
  const listHref = listQs ? `${basePath}?${listQs}` : basePath;
  const cardHref = (slug: string) => (split ? `${basePath}?${listQs ? `${listQs}&` : ""}e=${encodeURIComponent(slug)}` : undefined);
  const focusCoords = detail ? eventCoords(detail) : null;
  const focus = detail && focusCoords ? { id: detail.event.id, ...focusCoords } : null;

  // escritorio: las secciones comparten filas; cada una ocupa tantas columnas como eventos tiene
  // sin split: filas centradas de secciones; con split: la columna izquierda en 2 columnas
  const shelves = split ? "lg:grid lg:grid-cols-2 lg:gap-x-2" : "lg:flex lg:flex-wrap lg:items-start lg:gap-x-3";

  const upcomingPane = (
    <>
      {isSet && (
        <>
          <div className="lg:flex lg:items-end lg:justify-between lg:gap-4">
            <SectionHeader
              title={rangeLabel}
              subtitle={upcoming.length ? `${upcoming.length} ${upcoming.length === 1 ? "evento" : "eventos"} en ${area}` : undefined}
            />
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-2 lg:pb-3">
              {RANGES.map((r) => (
                <Chip key={r.key} active={r.key === range} href={`${basePath}?r=${r.key}${category ? `&c=${category}` : ""}`}>{r.label}</Chip>
              ))}
            </div>
          </div>
          {!upcoming.length && (
            <p className="px-5 pt-2 text-[14px] text-ink-2">
              Nada en {area} {range === "todo" ? "por ahora" : rangeLabel.toLowerCase()}{nearby.length ? "; te sugerimos lo más cercano." : "."}
            </p>
          )}
        </>
      )}
      <div className={shelves}>
        {/* una sola rejilla: primero tu zona (por fecha), luego sugerencias por cercanía con insignia */}
        {upcoming.length + nearby.length > 0 && (
          <Shelf id="events" count={upcoming.length + nearby.length} split={split}>
            {upcoming.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`ev-${e.event_id}`} href={cardHref(e.slug)} e={e} hideDistance={!!loc.stateCve} />)}
            {/* "Cerca" solo para eventos fuera de tu zona; los de tu zona en otras fechas van sin insignia */}
            {nearby.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`ev-${e.event_id}`} href={cardHref(e.slug)} e={e} nearby={!isLocal(e)} />)}
          </Shelf>
        )}
        {suggestions.length > 0 && (
          <Shelf id="suggestions" count={suggestions.length} split={split} title={isSet ? "Lo que viene en la región" : "Próximamente en la región"} subtitle="Una selección de lo que viene, por fecha">
            {suggestions.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`ev-${e.event_id}`} href={cardHref(e.slug)} e={e} hideDistance={!isSet || !!loc.stateCve} />)}
          </Shelf>
        )}
      </div>
      {!upcoming.length && !nearby.length && !suggestions.length && (
        <div className="pt-6">
          <EmptyState title="Aún no hay eventos publicados" hint="Estamos sumando pueblos y fechas. Vuelve pronto." />
        </div>
      )}
    </>
  );

  const livePane = (
    <div className={shelves}>
      <Shelf id="live" count={live.length} split={split} live title="Sucediendo ahora" subtitle={isSet ? `Activos en este momento ${nearText(loc)}` : "Activos en este momento en la región"}>
        {live.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`live-${e.event_id}`} href={cardHref(e.slug)} e={e} live hideDistance={!isSet || !!loc.stateCve} />)}
      </Shelf>
    </div>
  );

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
      : "mx-auto max-w-screen-sm pb-28 lg:w-fit lg:max-w-(--wrap) lg:pb-12 lg:[--card:288px] lg:[--cols:3] lg:[--wrap:calc(var(--cols)*var(--card)_+_(var(--cols)_-_1)*12px)] xl:[--card:292px] xl:[--cols:4] 2xl:[--card:328px]"}>
      {detail ? (
        <EventPanel d={detail} backHref={listHref} />
      ) : (
        <>
          <div className="lg:hidden"><SearchBar loc={loc} municipalities={munis} isSet={isSet} /></div>
          {!isSet && <LocationPrompt />}
          <CategoryRow active={category} range={range} basePath={basePath} />

          {live.length > 0 ? (
            <HomeFeed liveCount={live.length} initial={sp.r || sp.c ? "proximos" : "ahora"} now={livePane} upcoming={upcomingPane} />
          ) : (
            upcomingPane
          )}
        </>
      )}

      <Link
        href="/mapa"
        className="lg:hidden fixed bottom-[calc(82px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white shadow-float"
      >
        Mapa <Map size={18} />
      </Link>
      <BottomNav />
    </main>
    {/* nombre de view transition directo en CSS: el navegador lo anima al entrar/salir (ver globals.css) */}
    {split && (
      <aside style={{ viewTransitionName: "map-panel" }} className="sticky top-[76px] hidden h-[calc(100dvh-76px)] border-l border-line bg-[#f2f2ef] lg:block">
        <DesktopOnly>
          <div className="relative h-full">
            <EventMap events={mapEvents} loc={loc} stateBounds={stateBox(munis, loc.stateCve)} variant="panel" focus={focus} />
          </div>
        </DesktopOnly>
      </aside>
    )}
    </div>
    </>
  );
}

/**
 * Sección de tarjetas. En móvil, lista vertical. En escritorio (sin split) es una rejilla de
 * min(eventos, columnas) tarjetas de ancho fijo: con pocos eventos, varias secciones comparten fila.
 */
function Shelf({ count, split, title, subtitle, live, children }: { id?: string; count: number; split: boolean; title?: string; subtitle?: string; live?: boolean; children: React.ReactNode }) {
  const span = { "--n3": Math.min(count, 3), "--n4": Math.min(count, 4) } as React.CSSProperties;
  return (
    <section
      style={span}
      className={split
        ? "lg:col-span-full lg:grid lg:grid-cols-subgrid"
        : "lg:grid lg:content-start lg:gap-x-3 lg:[--n:var(--n3)] lg:grid-cols-[repeat(var(--n),var(--card))] xl:[--n:var(--n4)]"}
    >
      {title && <div className="lg:col-span-full"><SectionHeader title={title} subtitle={subtitle} live={live} /></div>}
      <div className="divide-y divide-line/60 lg:contents">{children}</div>
    </section>
  );
}
