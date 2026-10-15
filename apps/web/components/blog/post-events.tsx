import Link from "next/link";
import { EventCard } from "./event-card";
import { EmptyState } from "./ui";
import { eventsInMunicipalities } from "@/lib/queries";
import type { Municipality, NearRow } from "@/lib/types";

/** Inicio y fin del día en la CDMX (sin horario de verano desde 2022). */
const startOfDay = (d: string) => new Date(`${d}T00:00:00-06:00`);
const endOfDay = (d: string) => new Date(`${d}T23:59:59-06:00`);

/**
 * Eventos publicados de los municipios de la guía dentro de sus fechas. Sale de la cartelera, así que la guía
 * no se queda vieja: lo que se aprueba en /admin/review aparece aquí solo.
 */
export async function PostEvents({ munis, desde, hasta }: { munis: Municipality[]; desde: string; hasta: string }) {
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
    <section aria-labelledby="eventos" className="-mx-5 mt-10 scroll-mt-24">
      <div className="px-5">
        <h2 id="eventos" className="text-[22px] font-bold leading-tight text-ink">Eventos en estas fechas</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {past
            ? "Esta temporada ya pasó. Las fechas del próximo año aparecen en cada pueblo:"
            : "Lo que ya está en la cartelera. Cada evento lo revisa una persona; las fiestas sin flyer aparecen con fecha estimada."}
        </p>
      </div>
      {events.length > 0 ? (
        <div className="mt-2">{events.map((e) => <EventCard key={e.event_id} e={e} hideDistance />)}</div>
      ) : (
        <div className="mt-4">
          {!past && <EmptyState title="Aún no hay eventos confirmados para estas fechas" hint="Los agregamos conforme llegan los flyers. Mientras, revisa cada pueblo:" />}
          <div className="mt-3 flex flex-wrap gap-2 px-5">
            {munis.map((m) => (
              <Link key={m.slug} href={`/municipio/${m.slug}`} className="rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium hover:border-ink">
                {m.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function PostEventsSkeleton() {
  return (
    <div className="-mx-5 mt-10 px-5" aria-hidden>
      <div className="h-7 w-56 rounded bg-bg-2" />
      <div className="mt-4 aspect-[4/3] rounded-card bg-bg-2" />
    </div>
  );
}
