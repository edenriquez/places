"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EventCard } from "@/components/event-card";
import { EventMap } from "@/components/event-map-lazy";
import { ExperienceCard } from "@/components/experience-card";
import { HomeFeed, type WhenOption } from "@/components/home-feed";
import { IntentPicker, catsOf, useCategoryFilter } from "@/components/intent-picker";
import { Chip, EmptyState, SectionHeader } from "@/components/ui";
import { EXPERIENCE_KINDS, kindsForIntent, type ExperienceKind } from "@/lib/experiences";
import { INTENTS, intentByKey, type IntentKey } from "@/lib/intents";
import type { Loc } from "@/lib/location";
import type { Range } from "@/lib/queries";
import { SITE_NAME } from "@/lib/site";
import type { ExperienceRow, NearRow } from "@/lib/types";

/** `short`: cabe en la pestaña de Agenda en un teléfono angosto */
const RANGES: { key: Range; label: string; short?: string; hint: string }[] = [
  { key: "finde", label: "Este finde", hint: "De viernes a domingo" },
  { key: "15d", label: "Próximos 15 días", short: "15 días", hint: "Las próximas dos semanas" },
  { key: "todo", label: "Todo lo que viene", short: "Lo que viene", hint: "Todas las fechas" },
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

export function ExploreBody({ lists, experiences, range, basePath, split, isSet, area, liveSubtitle, hideDistance, startAnyDay }: {
  lists: ExploreLists;
  /** "Cualquier día": experiencias de la más cercana a la más lejana */
  experiences: ExperienceRow[];
  range: Range;
  basePath: string;
  split: boolean;
  isSet: boolean;
  area: string;
  liveSubtitle: string;
  /** modo estado: la distancia al centro del estado no dice nada */
  hideDistance: boolean;
  /** con ?v=dia se abre en Cualquier día */
  startAnyDay: boolean;
}) {
  const q = useSearchParams();
  const { intent, cats } = useCategoryFilter();
  const { live, upcoming, nearby, suggestions } = useFiltered(lists);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  // el periodo de la agenda va en ?r=: "ahora" (en vivo), un rango de fechas o "pronto" (sin ubicación).
  // Sin ?r= abre en "Ahora mismo", salvo que la página se abrió ya filtrada (un enlace a ?i=musica)
  const [openedFiltered] = useState(!!cats);
  const r = q.get("r");
  const when = r === "ahora" ? "ahora" : r || openedFiltered ? "fecha" : "ahora";
  /** misma URL con otros valores: conserva intención, tipo de experiencia, etc. */
  const hrefWith = (set: Record<string, string>) => {
    const next = new URLSearchParams(q);
    next.delete("e");
    next.delete("v");
    for (const [k, v] of Object.entries(set)) next.set(k, v);
    return `${basePath}?${next}`;
  };
  const setPeriod = (value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("r", value);
    window.history.replaceState(null, "", url);
  };
  const cardHref = (slug: string) => (split ? hrefWith({ r: r ?? range, e: slug }) : undefined);

  // escritorio: las secciones comparten filas; cada una ocupa tantas columnas como eventos tiene
  // sin split: filas centradas de secciones; con split: la columna izquierda en 2 columnas
  const shelves = split ? "lg:grid lg:grid-cols-2 lg:gap-x-2" : "lg:flex lg:flex-wrap lg:items-start lg:gap-x-3";
  // la primera tarjeta es el LCP y se pide de inmediato; con split la lista va oculta en móvil (/mapa)
  // y una imagen eager se bajaría aunque no se vea
  const lead = (i: number, first = true) => !split && first && i === 0;

  const upcomingPane = (
    <>
      {isSet && !upcoming.length && (
        <p className="px-5 pb-1 text-[14px] text-ink-2">
          Nada en {area} {range === "todo" ? "por ahora" : rangeLabel.toLowerCase()}{nearby.length ? "; te sugerimos lo más cercano." : "."}
        </p>
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
          <Shelf count={suggestions.length} split={split} title={isSet ? "Lo que viene en la región" : undefined} subtitle="Una selección de lo que viene, por fecha">
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
      <Shelf count={live.length} split={split}>
        {live.map((e, i) => <EventCard key={`${e.event_id}-${e.starts_at}`} vt={`live-${e.event_id}`} href={cardHref(e.slug)} e={e} live hideDistance={!isSet || hideDistance} eager={lead(i)} />)}
      </Shelf>
    </div>
  );

  // un filtro puede dejar sin nada en vivo: entonces se ve el rango de fechas
  const showLive = when === "ahora" && live.length > 0;
  const options: WhenOption[] = [
    ...(live.length ? [{ key: "ahora", label: "Ahora mismo", hint: `${live.length} en vivo`, live: true, onSelect: () => setPeriod("ahora") }] : []),
    ...(isSet
      ? RANGES.map((x) => ({ key: x.key, label: x.label, short: x.short, hint: x.hint, href: hrefWith({ r: x.key }) }))
      : [{ key: "pronto", label: "Próximamente", hint: "Lo que viene en la región", onSelect: () => setPeriod("pronto") }]),
  ];
  const upcomingSubtitle = !isSet
    ? "Una selección de lo que viene en la región"
    : upcoming.length ? `${upcoming.length} ${upcoming.length === 1 ? "evento" : "eventos"} en ${area}` : undefined;
  const pickable = options.length > 1;

  return (
    <>
      <IntentPicker compact={split} />
      <HomeFeed
        initial={startAnyDay ? "dia" : "agenda"}
        when={pickable ? { options, current: showLive ? "ahora" : isSet ? range : "pronto", subtitle: showLive ? liveSubtitle : upcomingSubtitle } : undefined}
        agenda={(
          <>
            {!pickable && <SectionHeader title="Próximamente en la región" subtitle="Una selección de lo que viene, por fecha" />}
            {showLive ? livePane : upcomingPane}
          </>
        )}
        anyDay={experiences.length ? <AnyDayPane experiences={experiences} intent={intent} area={area} hideDistance={!isSet || hideDistance} /> : undefined}
      />
    </>
  );
}

/**
 * Experiencias sin fecha. Con una intención elegida, sus subcategorías se ven todas (haya o no experiencias);
 * sin intención, solo los tipos que hay. El tipo elegido va en la URL (?k=) para que siga al cambiar de pestaña
 * o al volver de una experiencia.
 */
function AnyDayPane({ experiences, intent, area, hideDistance }: { experiences: ExperienceRow[]; intent?: IntentKey; area: string; hideDistance: boolean }) {
  const q = useSearchParams();
  const kind = q.get("k");
  const setKind = (k: ExperienceKind | null) => {
    const url = new URL(window.location.href);
    if (k) url.searchParams.set("k", k);
    else url.searchParams.delete("k");
    window.history.replaceState(null, "", url);
  };
  const intentKinds = intent ? kindsForIntent(intent) : null;
  const forIntent = intentKinds ? experiences.filter((x) => intentKinds.includes(x.kind)) : experiences;
  const kinds = intentKinds ?? [...new Set(experiences.map((x) => x.kind))];
  const active = kinds.find((k) => k === kind) ?? null;
  const shown = active ? forIntent.filter((x) => x.kind === active) : forIntent;
  // "prueba otra categoría": solo las que sí tienen experiencias
  const others = INTENTS.filter((it) => it.key !== intent && experiences.some((x) => EXPERIENCE_KINDS[x.kind].intent === it.key));
  const intentHref = (key: string) => {
    const next = new URLSearchParams(q);
    next.set("i", key);
    next.delete("c");
    next.delete("k");
    return `?${next}`;
  };

  return (
    <>
      <p className="px-5 pb-3 pt-5 text-[13px] text-ink-2">Experiencias cerca de {area} que no dependen de una fecha</p>
      {(intentKinds ? kinds.length > 0 : kinds.length > 1) && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-2">
          <Chip active={!active} onClick={() => setKind(null)}>Todo</Chip>
          {kinds.map((k) => (
            <Chip key={k} active={active === k} track={`experiencia:${k}`} onClick={() => setKind(active === k ? null : k)}>
              <span className="mr-1.5">{EXPERIENCE_KINDS[k].emoji}</span>{EXPERIENCE_KINDS[k].label}
            </Chip>
          ))}
        </div>
      )}
      {shown.length ? (
        <div className="divide-y divide-line/60 lg:grid lg:grid-cols-[repeat(auto-fill,var(--card,288px))] lg:gap-x-3 lg:divide-y-0">
          {shown.map((x, i) => <ExperienceCard key={x.experience_id} x={x} hideDistance={hideDistance} eager={i === 0} />)}
        </div>
      ) : (
        <div className="pt-2">
          <EmptyState
            title={`Aún no hay experiencias de ${active ? `“${EXPERIENCE_KINDS[active].label}”` : intentByKey(intent)!.label.toLowerCase()} en ${SITE_NAME}`}
            hint={active && forIntent.length ? "Prueba otro tipo de esta categoría." : "Prueba otra categoría."}
          >
            {!(active && forIntent.length) && others.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {others.map((it) => (
                  <Link
                    key={it.key}
                    href={intentHref(it.key)}
                    prefetch={false}
                    scroll={false}
                    onNavigate={(e) => {
                      e.preventDefault();
                      window.history.pushState(null, "", intentHref(it.key));
                    }}
                    data-track="filter"
                    data-label={`vacio:intencion:${it.key}`}
                    className="inline-flex h-9 items-center rounded-full border border-line-2 bg-white px-4 text-[14px] font-medium transition hover:border-ink"
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}
          </EmptyState>
        </div>
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
function Shelf({ count, split, title, subtitle, children }: { count: number; split: boolean; title?: string; subtitle?: string; children: React.ReactNode }) {
  const span = { "--n3": Math.min(count, 3), "--n4": Math.min(count, 4) } as React.CSSProperties;
  return (
    <section
      style={span}
      className={split
        ? "lg:col-span-full lg:grid lg:grid-cols-subgrid"
        : "lg:grid lg:content-start lg:gap-x-3 lg:[--n:var(--n3)] lg:grid-cols-[repeat(var(--n),var(--card))] xl:[--n:var(--n4)]"}
    >
      {title && <div className="lg:col-span-full"><SectionHeader title={title} subtitle={subtitle} /></div>}
      <div className="divide-y divide-line/60 lg:contents">{children}</div>
    </section>
  );
}
