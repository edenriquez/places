import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Heart, Landmark } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { EventCard, LiveCard } from "@/components/event-card";
import { ExperienceCard, ExperienceTile } from "@/components/experience-card";
import { JsonLd } from "@/components/json-ld";
import { EmptyState, SectionHeader } from "@/components/ui";
import { fmtMonthShort } from "@/lib/format";
import {
  eventsLiveNear, municipalityBySlug, municipalityEvents, municipalityExperiences, municipalityFestivities, municipalityPlaces, placeCounts, placesByIds,
} from "@/lib/queries";
import { clip, pageMetadata } from "@/lib/site";
import { breadcrumbs, municipalityGraph } from "@/lib/structured-data";
import { PLACE_KIND_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const m = await municipalityBySlug(slug);
  if (!m) return { title: "Municipio no encontrado", robots: { index: false, follow: true } };
  const kind = m.is_pueblo_magico ? `Pueblo Mágico de ${m.state}` : m.state;
  const drive = m.drive_from_cdmx ? `, a ${m.drive_from_cdmx} de la CDMX` : "";
  const title = `Qué hacer en ${m.name}, ${m.state}: eventos y fiestas`;
  return pageMetadata({
    title,
    ogTitle: `Qué hacer en ${m.name}`,
    description: clip(
      m.description
        ? `${m.description} Eventos, ferias y fiestas en ${m.name} (${kind}${drive}).`
        : `Eventos, ferias, fiestas patronales y lugares para visitar en ${m.name} (${kind}${drive}). Fechas, precios y cómo llegar.`,
    ),
    path: `/municipio/${m.slug}`,
    images: [{ url: `/municipio/${m.slug}/opengraph-image`, alt: `Qué hacer en ${m.name}, ${m.state}`, type: "image/jpeg" }],
  });
}

const MOVABLE_LABEL: Record<string, string> = {
  carnaval: "Feb/Mar", semana_santa: "Mar/Abr", pentecostes: "May/Jun", corpus: "Jun", ascension: "May",
};

export default async function MunicipalityPage({ params }: Params) {
  const { slug } = await params;
  const m = await municipalityBySlug(slug);
  if (!m) notFound();
  const loc = { lat: m.lat, lng: m.lng, radiusKm: 25, label: m.name, cvegeo: m.cvegeo };
  const [events, live, fests, catalog, experiences] = await Promise.all([
    municipalityEvents(m.cvegeo, 12, m),
    eventsLiveNear(loc),
    municipalityFestivities(m.cvegeo),
    municipalityPlaces(m.cvegeo, 8),
    municipalityExperiences(m.cvegeo, m),
  ]);
  const freeCount = events.filter((e) => e.is_free).length + experiences.filter((x) => x.is_free).length;
  const minPrice = events.filter((e) => !e.is_free && e.price_min != null).map((e) => e.price_min!).sort((a, b) => a - b)[0];
  const liveHere = live.filter((e) => e.municipality_cvegeo === m.cvegeo);
  // lugares: primero los que tienen experiencias o fechas (con sus cuentas), luego el catálogo cultural
  const counts = placeCounts(experiences, events);
  const withContent = (await placesByIds([...counts.keys()])).sort((a, b) => {
    const ca = counts.get(a.id)!, cb = counts.get(b.id)!;
    return cb.experiences + cb.events - (ca.experiences + ca.events);
  });
  const places = [...withContent, ...catalog.filter((p) => !counts.has(p.id))].slice(0, 10);

  return (
    <main className="mx-auto max-w-screen-sm pb-28">
      <JsonLd data={[...municipalityGraph(m, events, experiences), breadcrumbs([{ name: "Explorar", path: "/" }, { name: m.name, path: `/municipio/${m.slug}` }])]} />
      <div className="relative aspect-[4/3] bg-ink">
        {m.cover_image_url && <Image src={m.cover_image_url} alt={`${m.name}, ${m.state}`} fill priority sizes="640px" className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-4 top-[max(env(safe-area-inset-top),12px)] flex justify-between">
          <Link href="/" aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></Link>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
        </div>
        <div className="absolute inset-x-5 bottom-5 text-white">
          <h1 className="text-[34px] font-extrabold leading-none">{m.name}</h1>
          <p className="mt-1 text-[14px] opacity-90">
            {m.state}{m.is_pueblo_magico ? " · Pueblo Mágico" : ""}{m.drive_from_cdmx ? ` · ${m.drive_from_cdmx} desde CDMX` : ""}
          </p>
        </div>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 [&>span]:shrink-0 [&>span]:whitespace-nowrap">
        {experiences.length > 0 && <span className="rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">{experiences.length} {experiences.length === 1 ? "experiencia" : "experiencias"}</span>}
        <span className="rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">{events.length} próximos</span>
        <span className="rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">Gratis: {freeCount}</span>
        {minPrice != null && <span className="rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium">Desde ${Math.round(minPrice)}</span>}
      </div>

      {liveHere.length > 0 && (
        <>
          <SectionHeader title="Sucediendo ahora" live />
          <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto px-5">
            {liveHere.map((e) => <LiveCard key={e.event_id} e={e} />)}
          </div>
        </>
      )}

      {experiences.length > 0 && (
        <>
          <SectionHeader title="Qué hacer cualquier día" subtitle={`Experiencias en ${m.name} que no dependen de una fecha`} />
          <ExperienceCard x={experiences[0]} hideDistance eager />
          {experiences.length > 1 && (
            <div className="no-scrollbar flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pt-2">
              {experiences.slice(1).map((x) => <ExperienceTile key={x.experience_id} x={x} />)}
            </div>
          )}
        </>
      )}

      <SectionHeader title="Próximos eventos" />
      {events.length ? events.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} e={e} />) : (
        <EmptyState
          title={`Aún no hay eventos publicados en ${m.name}`}
          hint={experiences.length ? "Mientras tanto, arriba tienes lo que se puede hacer cualquier día." : "Revisa las fechas del año más abajo."}
        />
      )}

      {fests.length > 0 && (
        <>
          <SectionHeader title="Fechas que no te puedes perder" subtitle="Fiestas y ferias que se repiten cada año" />
          <ul className="mx-5 divide-y divide-line rounded-card border border-line">
            {fests.map((f) => (
              <li key={f.id} className="flex gap-4 px-4 py-3">
                <span className="w-16 shrink-0 text-[13px] font-semibold uppercase text-ink-2">
                  {f.movable_rule ? MOVABLE_LABEL[f.movable_rule] ?? "Móvil" : f.month ? fmtMonthShort(f.month) : ""}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{f.name}</span>
                  {(f.locality || f.description) && <span className="block text-[13px] text-ink-2">{[f.locality, f.description].filter(Boolean).join(" · ")}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {places.length > 0 && (
        <>
          <SectionHeader title="Lugares" subtitle={counts.size ? "Cada lugar reúne lo que se puede hacer ahí y sus fechas" : undefined} />
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-5">
            {places.map((p) => {
              const c = counts.get(p.id);
              return (
                <Link key={p.id} href={`/municipio/${m.slug}/${p.slug}`} className="w-[200px] shrink-0 rounded-card border border-line p-4 hover:border-ink-3">
                  <Landmark size={20} className="text-ink-2" />
                  <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug">{p.name}</p>
                  <p className="text-[12px] text-ink-2">{PLACE_KIND_LABEL[p.kind] ?? p.kind}</p>
                  {c && (
                    <p className="mt-1 text-[12px] font-medium text-ink-2">
                      {[c.experiences && `${c.experiences} ${c.experiences === 1 ? "experiencia" : "experiencias"}`, c.events && `${c.events} ${c.events === 1 ? "fecha" : "fechas"}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}
