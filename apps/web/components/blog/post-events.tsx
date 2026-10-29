import Link from "next/link";
import { ArrowDown, CalendarDays } from "lucide-react";
import { EventCard, Flyer } from "../event-card";
import { PriceTag } from "../ui";
import { eventsInMunicipalities } from "@/lib/queries";
import { fmtDateRange } from "@/lib/blog";
import { BLOG_COPY, type Locale } from "@/lib/blog-copy";
import { fmtWhenShort } from "@/lib/format";
import type { Municipality, NearRow } from "@/lib/types";

/** Inicio y fin del día en la CDMX (sin horario de verano desde 2022). */
const startOfDay = (d: string) => new Date(`${d}T00:00:00-06:00`);
const endOfDay = (d: string) => new Date(`${d}T23:59:59-06:00`);
const DAY = 24 * 60 * 60 * 1000;
/** si las fechas de la guía no traen nada (o ya pasaron), lo que viene en sus pueblos dentro de estos días */
const FALLBACK_DAYS = 60;

export type GuideEvents = {
  events: NearRow[];
  /** las fechas de la guía ya terminaron */
  past: boolean;
  /** los eventos no son de las fechas de la guía sino los próximos de sus pueblos */
  upcoming: boolean;
};

/**
 * Eventos publicados de los municipios de la guía dentro de sus fechas. Sale de la cartelera, así que la guía
 * no se queda vieja: lo que se aprueba en /admin/review aparece aquí solo. Cuando en esas fechas no hay nada
 * (o la guía no tiene fechas), van los próximos eventos de sus pueblos: toda guía lleva a algún evento.
 */
export async function guideEvents(munis: Municipality[], range?: { desde: string; hasta: string }): Promise<GuideEvents> {
  const now = new Date();
  const past = !!range && endOfDay(range.hasta) <= now;
  // sin base de datos la guía se tiene que poder leer igual: el bloque queda vacío
  try {
    if (range && !past) {
      const from = new Date(Math.max(now.getTime(), startOfDay(range.desde).getTime()));
      const events = await eventsInMunicipalities(munis, from, endOfDay(range.hasta));
      if (events.length) return { events, past, upcoming: false };
    }
    const events = await eventsInMunicipalities(munis, now, new Date(now.getTime() + FALLBACK_DAYS * DAY));
    return { events, past, upcoming: events.length > 0 };
  } catch {
    return { events: [], past, upcoming: false };
  }
}

/** Tarjeta vertical del carrusel de arriba: flyer, fecha encima y lo justo para decidir. */
function EventPoster({ e }: { e: NearRow }) {
  return (
    <Link href={`/evento/${e.slug}`} className="group w-[168px] shrink-0 snap-start sm:w-[188px]">
      <div className="relative">
        <Flyer path={e.image_path} focus={{ x: e.image_focus_x, y: e.image_focus_y }} alt={e.title} sizes="188px" className="aspect-[4/5] rounded-[14px] transition-transform duration-500 group-hover:scale-[1.02]" />
        <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-soft">
          {fmtWhenShort(e.starts_at, true)}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-2">{e.title}</h3>
      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-2">
        <span className="truncate">{e.municipality_name}</span>
        {e.is_free && <PriceTag isFree min={null} max={null} className="!px-1.5 !py-0 !text-[11px]" />}
      </p>
    </Link>
  );
}

/**
 * Arriba de todo, antes del texto: los eventos de la guía en un carrusel, para que quien llega buscando
 * "qué hacer" vea qué hay sin leer. "Ver todos" baja al bloque completo.
 */
export function PostEventsRail({ data, range, locale }: { data: GuideEvents; range?: { desde: string; hasta: string }; locale: Locale }) {
  const c = BLOG_COPY[locale];
  if (!data.events.length) return null;
  const when = range && !data.upcoming ? fmtDateRange(range.desde, range.hasta, locale) : c.railNextDays(FALLBACK_DAYS);
  return (
    <section id="eventos-arriba" aria-labelledby="eventos-arriba-titulo" className="rise mt-9" style={{ "--i": 5 } as React.CSSProperties}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> {when}
          </p>
          <h2 id="eventos-arriba-titulo" className="mt-1.5 text-[19px] font-bold leading-tight tracking-[-0.015em] text-ink">
            {data.upcoming ? c.railUpcoming : c.railTitle(data.events.length)}
          </h2>
        </div>
        <a href="#eventos" className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink">
          {c.railMore} <ArrowDown size={14} className="transition-transform duration-300 group-hover:translate-y-0.5" />
        </a>
      </div>
      <div className="no-scrollbar -mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
        {data.events.slice(0, 10).map((e) => <EventPoster key={e.event_id} e={e} />)}
      </div>
    </section>
  );
}

export function PostEvents({ data, munis, range, title, locale }: { data: GuideEvents; munis: Municipality[]; range?: { desde: string; hasta: string }; title: string; locale: Locale }) {
  const c = BLOG_COPY[locale];
  const { events, past, upcoming } = data;
  const lead = upcoming ? (range ? (past ? c.eventsPastUpcoming : c.eventsEmptyUpcoming) : c.eventsUpcomingLead) : past ? c.eventsPast : c.eventsLead;

  return (
    <section aria-labelledby="eventos" className="reveal -mx-5 mt-16 scroll-mt-20 border-y border-line bg-bg-2/60 py-8 sm:mx-0 sm:rounded-[20px] sm:border">
      <div className="px-5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
          <CalendarDays size={14} aria-hidden />
          {range && !upcoming ? fmtDateRange(range.desde, range.hasta, locale) : c.railNextDays(FALLBACK_DAYS)}
        </p>
        <h2 id="eventos" className="mt-2 scroll-mt-20 text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">{upcoming ? c.railUpcoming : title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{lead}</p>
      </div>
      {events.length > 0 ? (
        <div className="mt-3">{events.map((e) => <EventCard key={e.event_id} e={e} hideDistance />)}</div>
      ) : (
        <div className="mx-5 mt-5 border-t border-line pt-5">
          {!past && (
            <>
              <p className="text-[15px] font-semibold text-ink">{c.eventsEmpty}</p>
              <p className="mt-1 text-[14px] text-ink-2">{c.eventsEmptyHint}</p>
            </>
          )}
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
            {munis.map((m) => <Link key={m.slug} href={`/municipio/${m.slug}`} className="link-line">{m.name}</Link>)}
          </p>
        </div>
      )}
      <div className="mx-5 mt-4">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-on-ink">
          {c.eventsAll}
        </Link>
      </div>
    </section>
  );
}
