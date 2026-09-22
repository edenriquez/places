import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Heart, Landmark, Map } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { EventCard, LiveCard } from "@/components/event-card";
import { EmptyState, SectionHeader } from "@/components/ui";
import { fmtMonthShort } from "@/lib/format";
import { eventsLiveNear, municipalityBySlug, municipalityEvents, municipalityFestivities, municipalityPlaces } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const m = await municipalityBySlug(slug);
  return { title: m ? `Qué hacer en ${m.name}` : "Municipio", description: m?.description ?? undefined };
}

const KIND_LABEL: Record<string, string> = {
  museo: "Museo", teatro: "Teatro", casa_cultura: "Casa de cultura", centro_cultural: "Centro cultural",
  zona_arqueologica: "Zona arqueológica", galeria: "Galería", auditorio: "Auditorio", templo: "Templo",
  plaza: "Plaza", mercado: "Mercado", ex_hacienda: "Ex hacienda",
};

const MOVABLE_LABEL: Record<string, string> = {
  carnaval: "Feb/Mar", semana_santa: "Mar/Abr", pentecostes: "May/Jun", corpus: "Jun", ascension: "May",
};

export default async function MunicipalityPage({ params }: Params) {
  const { slug } = await params;
  const m = await municipalityBySlug(slug);
  if (!m) notFound();
  const loc = { lat: m.lat, lng: m.lng, radiusKm: 25, label: m.name, cvegeo: m.cvegeo };
  const [events, live, fests, places] = await Promise.all([
    municipalityEvents(m.cvegeo, 12),
    eventsLiveNear(loc),
    municipalityFestivities(m.cvegeo),
    municipalityPlaces(m.cvegeo, 8),
  ]);
  const freeCount = events.filter((e) => e.is_free).length;
  const minPrice = events.filter((e) => !e.is_free && e.price_min != null).map((e) => e.price_min!).sort((a, b) => a - b)[0];
  const liveHere = live.filter((e) => e.municipality_cvegeo === m.cvegeo);

  return (
    <main className="mx-auto max-w-screen-sm pb-28">
      <div className="relative aspect-[4/3] bg-ink">
        {m.cover_image_url && <Image src={m.cover_image_url} alt={m.name} fill priority sizes="640px" className="object-cover" />}
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

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4">
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

      <SectionHeader title="Próximos eventos" />
      {events.length ? events.map((e) => <EventCard key={`${e.event_id}-${e.starts_at}`} e={e} />) : (
        <EmptyState title={`Aún no hay eventos publicados en ${m.name}`} hint="Revisa las fechas del año más abajo." />
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
          <SectionHeader title="Lugares" />
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-5">
            {places.map((p) => (
              <div key={p.id} className="w-[200px] shrink-0 rounded-card border border-line p-4">
                <Landmark size={20} className="text-ink-2" />
                <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug">{p.name}</p>
                <p className="text-[12px] text-ink-2">{KIND_LABEL[p.kind] ?? p.kind}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <Link href="/mapa" className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-white shadow-float">
        Mapa <Map size={18} />
      </Link>
      <BottomNav />
    </main>
  );
}
