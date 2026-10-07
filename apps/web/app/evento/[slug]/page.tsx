import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DesktopHeader } from "@/components/desktop";
import { EventDesktop, EventMobile } from "@/components/event-detail";
import { JsonLd } from "@/components/json-ld";
import { SearchBar } from "@/components/location-picker";
import { fmtPrice, fmtWhenLong } from "@/lib/format";
import { getLoc, hasLoc } from "@/lib/location-server";
import { eventBySlug, municipalities, municipalityEvents } from "@/lib/queries";
import { clip, pageMetadata } from "@/lib/site";
import { breadcrumbs, eventGraph } from "@/lib/structured-data";
import { CATEGORY_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) return { title: "Evento no encontrado", robots: { index: false, follow: true } };
  const { event, occurrences, place, municipality } = data;
  // la próxima fecha (no la primera): un link compartido de un evento con varias fechas debe decir la que viene
  const next = occurrences.find((o) => new Date(o.ends_at ?? o.starts_at) >= new Date()) ?? occurrences[0];
  const when = next ? fmtWhenLong(next.starts_at, next.ends_at, next.is_all_day) : "";
  const where = [place?.name ?? event.place_text, municipality && `${municipality.name}, ${municipality.state}`].filter(Boolean).join(", ");
  const price = fmtPrice(event.is_free, event.price_min, event.price_max);
  // <title>: "Feria del Elote en Tlayacapan"; si el nombre ya dice dónde ("… en Xochimilco", "… de Tepoztlán"), no se toca
  const t = event.title.toLowerCase();
  const hasPlace = !municipality || t.includes(municipality.name.toLowerCase()) || / (en|de) [A-ZÁÉÍÓÚÑ]/.test(event.title);
  const title = hasPlace ? event.title : `${event.title} en ${municipality.name}`;
  const summary = [when, where, price !== "Consultar" ? price : null].filter(Boolean).join(" · ");
  return pageMetadata({
    title,
    ogTitle: event.title,
    description: clip(event.description ? `${summary}. ${event.description}` : `${CATEGORY_LABEL[event.category]}: ${summary}.`),
    path: `/evento/${event.slug}`,
    type: "article",
    images: [{ url: `/evento/${event.slug}/opengraph-image`, alt: `${event.title}: ${summary}`, type: "image/jpeg" }],
  });
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) notFound();
  const [loc, isSet, munis, around] = await Promise.all([
    getLoc(),
    hasLoc(),
    municipalities(),
    data.municipality ? municipalityEvents(data.municipality.cvegeo, 7, data.municipality) : Promise.resolve([]),
  ]);
  const others = around.filter((e) => e.event_id !== data.event.id);

  // teléfono y escritorio no comparten layout: cada uno tiene su presentación
  const crumbs = [
    { name: "Explorar", path: "/" },
    ...(data.municipality ? [{ name: data.municipality.name, path: `/municipio/${data.municipality.slug}` }] : []),
    { name: data.event.title, path: `/evento/${data.event.slug}` },
  ];

  return (
    <>
      <JsonLd data={[...eventGraph(data), breadcrumbs(crumbs)]} />
      <div className="lg:hidden"><EventMobile d={data} nearby={others.slice(0, 2)} /></div>
      <div className="hidden lg:block">
        <DesktopHeader><SearchBar loc={loc} municipalities={munis} isSet={isSet} header /></DesktopHeader>
        <EventDesktop d={data} nearby={others.slice(0, 3)} />
      </div>
    </>
  );
}
