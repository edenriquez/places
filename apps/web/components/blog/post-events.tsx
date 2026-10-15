import Link from "next/link";
import { EventCard } from "../event-card";
import { eventsInMunicipalities } from "@/lib/queries";
import { BLOG_COPY, type Locale } from "@/lib/blog-copy";
import type { Municipality, NearRow } from "@/lib/types";

/** Inicio y fin del día en la CDMX (sin horario de verano desde 2022). */
const startOfDay = (d: string) => new Date(`${d}T00:00:00-06:00`);
const endOfDay = (d: string) => new Date(`${d}T23:59:59-06:00`);

/**
 * Eventos publicados de los municipios de la guía dentro de sus fechas. Sale de la cartelera, así que la guía
 * no se queda vieja: lo que se aprueba en /admin/review aparece aquí solo.
 */
export async function PostEvents({ munis, desde, hasta, locale }: { munis: Municipality[]; desde: string; hasta: string; locale: Locale }) {
  const c = BLOG_COPY[locale];
  const now = new Date();
  const to = endOfDay(hasta);
  const from = new Date(Math.max(now.getTime(), startOfDay(desde).getTime()));
  const past = to <= now;
  let events: NearRow[] = [];
  // sin base de datos la guía se tiene que poder leer igual: el bloque queda vacío
  try {
    if (!past) events = await eventsInMunicipalities(munis, from, to);
  } catch {}

  return (
    <section aria-labelledby="eventos" className="reveal -mx-5 mt-16 scroll-mt-20">
      <div className="px-5">
        <h2 id="eventos" className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">{c.events}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{past ? c.eventsPast : c.eventsLead}</p>
      </div>
      {events.length > 0 ? (
        <div className="mt-3">{events.map((e) => <EventCard key={e.event_id} e={e} hideDistance />)}</div>
      ) : (
        <div className="mx-5 mt-5 border-y border-line py-6">
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
    </section>
  );
}

export function PostEventsSkeleton() {
  return (
    <div className="mt-16" aria-hidden>
      <div className="h-7 w-56 rounded bg-bg-2" />
      <div className="mt-4 aspect-[4/3] rounded-card bg-bg-2" />
    </div>
  );
}
