"use client";

import { useMemo } from "react";
import { EventCard } from "@/components/event-card";
import { EventMap } from "@/components/event-map-lazy";
import { HomeFeed } from "@/components/home-feed";
import { IntentPicker, catsOf, useCategoryFilter } from "@/components/intent-picker";
import { Chip, EmptyState, SectionHeader } from "@/components/ui";
import type { Loc } from "@/lib/location";
import type { Range } from "@/lib/queries";
import type { NearRow } from "@/lib/types";

const RANGES: { key: Range; label: string }[] = [
  { key: "finde", label: "Este finde" },
  { key: "15d", label: "Próximos 15 días" },
  { key: "todo", label: "Todo" },
];
const SUGGESTIONS = 8;

/**
 * Lo que arma el servidor, sin filtrar por categoría: el filtro corre aquí y no vuelve a pedir nada.
 * `nearby.away`: fuera de tu zona (lleva la insignia "Cerca"). `suggestions` ya viene barajada.
 */
export type ExploreLists = {
  live: NearRow[];
  upcoming: NearRow[];
  nearby: (NearRow & { away: boolean })[];
  suggestions: NearRow[];
};

function filterLists(l: ExploreLists, cats: readonly string[] | undefined) {
  const keep = <T extends NearRow>(rows: T[]) => (cats ? rows.filter((r) => cats.includes(r.category)) : rows);
  return {
    live: keep(l.live),
    upcoming: keep(l.upcoming),
    nearby: keep(l.nearby),
    suggestions: keep(l.suggestions).slice(0, SUGGESTIONS).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  };
}

function useFiltered(lists: ExploreLists) {
  const { intent, category } = useCategoryFilter();
  return useMemo(() => filterLists(lists, catsOf(intent, category)), [lists, intent, category]);
}

export function ExploreBody({ lists, range, basePath, split, isSet, area, liveSubtitle, hideDistance, startUpcoming }: {
  lists: ExploreLists;
  range: Range;
  basePath: string;
  split: boolean;
  isSet: boolean;
  area: string;
  liveSubtitle: string;
  /** modo estado: la distancia al centro del estado no dice nada */
  hideDistance: boolean;
  /** con ?r= en la URL se abre en Próximos */
  startUpcoming: boolean;
}) {
  const { intent, category, cats } = useCategoryFilter();
  const { live, upcoming, nearby, suggestions } = useFiltered(lists);
  const filterQs = intent ? `&i=${intent}` : category ? `&c=${encodeURIComponent(category)}` : "";
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  const cardHref = (slug: string) => (split ? `${basePath}?r=${range}${filterQs}&e=${encodeURIComponent(slug)}` : undefined);

  // escritorio: las secciones comparten filas; cada una ocupa tantas columnas como eventos tiene
  // sin split: filas centradas de secciones; con split: la columna izquierda en 2 columnas
  const shelves = split ? "lg:grid lg:grid-cols-2 lg:gap-x-2" : "lg:flex lg:flex-wrap lg:items-start lg:gap-x-3";
  // la primera tarjeta es el LCP y se pide de inmediato; con split la lista va oculta en móvil (/mapa)
  // y una imagen eager se bajaría aunque no se vea
  const lead = (i: number, first = true) => !split && first && i === 0;

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
                <Chip key={r.key} active={r.key === range} track={`rango:${r.key}`} href={`${basePath}?r=${r.key}${filterQs}`}>{r.label}</Chip>
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
          <Shelf count={upcoming.length + nearby.length} split={split}>
            {upcoming.map((e, i) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`ev-${e.event_id}`} href={cardHref(e.slug)} e={e} hideDistance={hideDistance} eager={lead(i)} />)}
            {/* "Cerca" solo para eventos fuera de tu zona; los de tu zona en otras fechas van sin insignia */}
            {nearby.map((e, i) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`ev-${e.event_id}`} href={cardHref(e.slug)} e={e} nearby={e.away} eager={lead(i, !upcoming.length)} />)}
          </Shelf>
        )}
        {suggestions.length > 0 && (
          <Shelf count={suggestions.length} split={split} title={isSet ? "Lo que viene en la región" : "Próximamente en la región"} subtitle="Una selección de lo que viene, por fecha">
            {suggestions.map((e, i) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`ev-${e.event_id}`} href={cardHref(e.slug)} e={e} hideDistance={!isSet || hideDistance} eager={lead(i, !upcoming.length && !nearby.length)} />)}
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
      <Shelf count={live.length} split={split} live title="Sucediendo ahora" subtitle={liveSubtitle}>
        {live.map((e, i) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`live-${e.event_id}`} href={cardHref(e.slug)} e={e} live hideDistance={!isSet || hideDistance} eager={lead(i)} />)}
      </Shelf>
    </div>
  );

  return (
    <>
      <IntentPicker compact={split} />
      {live.length > 0 ? (
        <HomeFeed liveCount={live.length} initial={startUpcoming || cats ? "proximos" : "ahora"} now={livePane} upcoming={upcomingPane} />
      ) : (
        upcomingPane
      )}
    </>
  );
}

/** Mapa del split de escritorio: los mismos eventos que la lista, con el mismo filtro. */
export function ExploreMap({ lists, coords, loc, stateBounds, focus }: {
  lists: ExploreLists;
  coords: Record<string, [number, number]>;
  loc: Loc;
  stateBounds?: [[number, number], [number, number]];
  focus?: { id: string; lat: number; lng: number } | null;
}) {
  const f = useFiltered(lists);
  const events = useMemo(
    () => [...f.live, ...f.upcoming, ...f.nearby, ...f.suggestions].flatMap((e) => {
      const c = coords[e.event_id];
      return c ? [{ ...e, lat: c[0], lng: c[1] }] : [];
    }),
    [f, coords],
  );
  return <EventMap events={events} loc={loc} stateBounds={stateBounds} variant="panel" focus={focus} />;
}

/**
 * Sección de tarjetas. En móvil, lista vertical. En escritorio (sin split) es una rejilla de
 * min(eventos, columnas) tarjetas de ancho fijo: con pocos eventos, varias secciones comparten fila.
 */
function Shelf({ count, split, title, subtitle, live, children }: { count: number; split: boolean; title?: string; subtitle?: string; live?: boolean; children: React.ReactNode }) {
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
