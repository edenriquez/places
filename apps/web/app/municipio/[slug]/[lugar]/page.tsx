import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Globe, MapPin, Phone } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { EventCard } from "@/components/event-card";
import { ExperienceCard } from "@/components/experience-card";
import { JsonLd } from "@/components/json-ld";
import { EmptyState, SectionHeader } from "@/components/ui";
import { cleanAddress, fmtPhone } from "@/lib/format";
import { municipalityBySlug, placeBySlug, placeContent } from "@/lib/queries";
import { absUrl, clip, pageMetadata } from "@/lib/site";
import { breadcrumbs } from "@/lib/structured-data";
import { PLACE_KIND_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; lugar: string }> };

async function load(slug: string, lugar: string) {
  const m = await municipalityBySlug(slug);
  if (!m) return null;
  const place = await placeBySlug(m.cvegeo, lugar);
  if (!place) return null;
  const at = place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : m;
  return { m, place, at, ...(await placeContent(place.id, at)) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, lugar } = await params;
  const d = await load(slug, lugar);
  if (!d) return { title: "Lugar no encontrado", robots: { index: false, follow: true } };
  const { m, place, experiences, events } = d;
  const kind = PLACE_KIND_LABEL[place.kind] ?? "Lugar";
  const what = experiences.slice(0, 3).map((x) => x.title).join(", ");
  return {
    ...pageMetadata({
      title: `${place.name}, ${m.name}: qué hacer y próximos eventos`,
      ogTitle: `${place.name} · ${m.name}`,
      description: clip(`${kind} en ${m.name}, ${m.state}.${what ? ` Qué hacer: ${what}.` : ""}${events.length ? ` ${events.length} eventos próximos.` : ""}`),
      path: `/municipio/${m.slug}/${place.slug}`,
    }),
    // un lugar del catálogo sin nada que hacer ni fechas es contenido vacío para buscadores
    ...(!experiences.length && !events.length && { robots: { index: false, follow: true } }),
  };
}

export default async function PlacePage({ params }: Params) {
  const { slug, lugar } = await params;
  const d = await load(slug, lugar);
  if (!d) notFound();
  const { m, place, at, experiences, events } = d;
  const kind = PLACE_KIND_LABEL[place.kind] ?? "Lugar";
  const path = `/municipio/${m.slug}/${place.slug}`;
  const hasPoint = place.lat != null && place.lng != null;
  const address = cleanAddress(place.address);
  const q = encodeURIComponent(`${place.name}, ${m.name}, ${m.state}`);
  const graph = {
    "@context": "https://schema.org",
    "@type": experiences.length ? "TouristAttraction" : "Place",
    name: place.name,
    url: absUrl(path),
    ...(hasPoint && { geo: { "@type": "GeoCoordinates", latitude: at.lat, longitude: at.lng } }),
    address: { "@type": "PostalAddress", ...(address && { streetAddress: address }), addressLocality: m.name, addressRegion: m.state, addressCountry: "MX" },
    ...(place.phone && { telephone: place.phone }),
    ...(place.website && { sameAs: [place.website] }),
  };

  return (
    <main className="mx-auto max-w-screen-sm pb-28">
      <JsonLd data={[graph, breadcrumbs([{ name: "Explorar", path: "/" }, { name: m.name, path: `/municipio/${m.slug}` }, { name: place.name, path }])]} />
      <div className="px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <Link href={`/municipio/${m.slug}`} aria-label={`Volver a ${m.name}`} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white shadow-soft"><ArrowLeft size={20} /></Link>
      </div>

      <div className="px-5 pt-4">
        <span className="rounded-full bg-bg-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">Lugar · {kind}</span>
        <h1 className="mt-3 text-[28px] font-bold leading-tight">{place.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2">
          <MapPin size={15} className="shrink-0" aria-hidden />
          <span>{address ? `${address} · ` : ""}<Link href={`/municipio/${m.slug}`} className="underline-offset-2 hover:underline">{m.name}</Link>, {m.state}</span>
        </p>
        {(place.phone || place.website) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {place.phone && <a href={`tel:${place.phone}`} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium"><Phone size={14} aria-hidden /> {fmtPhone(place.phone)}</a>}
            {place.website && <a href={place.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium"><Globe size={14} aria-hidden /> Sitio web</a>}
          </div>
        )}
      </div>

      {experiences.length > 0 && (
        <>
          <SectionHeader title="Qué hacer aquí" subtitle={`${experiences.length} ${experiences.length === 1 ? "experiencia" : "experiencias"} · cualquier día`} />
          {experiences.map((x, i) => <ExperienceCard key={x.experience_id} x={x} hideDistance eager={i === 0} />)}
        </>
      )}

      {events.length > 0 && (
        <>
          <SectionHeader title="Fechas en este lugar" subtitle="Eventos y salidas con guía" />
          {events.map((e) => <EventCard key={e.event_id} e={e} hideDistance />)}
        </>
      )}

      {!experiences.length && !events.length && (
        <div className="pt-7"><EmptyState title={`Aún no hay nada publicado en ${place.name}`} hint={`Mira lo que hay en ${m.name}.`} /></div>
      )}

      <SectionHeader title="Cómo llegar" />
      <div className="grid grid-cols-2 gap-3 px-5">
        <a href={`https://www.google.com/maps/search/?api=1&query=${hasPoint ? `${at.lat},${at.lng}` : q}`} target="_blank" rel="noreferrer" data-track="maps" data-label={`lugar:${place.slug}`} className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Abrir en Maps</a>
        <a href={hasPoint ? `https://waze.com/ul?ll=${at.lat},${at.lng}&navigate=yes` : `https://waze.com/ul?q=${q}`} target="_blank" rel="noreferrer" data-track="waze" data-label={`lugar:${place.slug}`} className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Waze</a>
      </div>

      <BottomNav />
    </main>
  );
}
