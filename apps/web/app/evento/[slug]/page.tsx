import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Flag, Heart, MapPin, Share2 } from "lucide-react";
import { CompactCard } from "@/components/event-card";
import { StaticMap } from "@/components/static-map";
import { ZoomableImage } from "@/components/image-viewer";
import { PriceTag } from "@/components/ui";
import { flyerUrl, fmtPrice, fmtWhenLong } from "@/lib/format";
import { eventBySlug, municipalityEvents } from "@/lib/queries";
import { CATEGORY_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) return { title: "Evento" };
  const when = data.occurrences[0] ? fmtWhenLong(data.occurrences[0].starts_at, data.occurrences[0].ends_at, data.occurrences[0].is_all_day) : "";
  return {
    title: data.event.title,
    description: `${when}${data.municipality ? ` · ${data.municipality.name}` : ""}. ${data.event.description ?? ""}`.slice(0, 200),
    openGraph: { title: data.event.title, description: when, type: "article" },
  };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  if (!data) notFound();
  const { event, occurrences, place, municipality, organization } = data;
  const img = flyerUrl(event.image_path);
  const next = occurrences.find((o) => new Date(o.ends_at ?? o.starts_at) >= new Date()) ?? occurrences[0];
  const lat = place?.lat ?? municipality?.lat;
  const lng = place?.lng ?? municipality?.lng;
  const nearby = municipality ? (await municipalityEvents(municipality.cvegeo, 6)).filter((e) => e.event_id !== event.id).slice(0, 2) : [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareText = encodeURIComponent(`${event.title} · ${next ? fmtWhenLong(next.starts_at, next.ends_at, next.is_all_day) : ""} · ${siteUrl}/evento/${event.slug}`);
  const mapsQuery = encodeURIComponent(place ? `${place.name}, ${municipality?.name ?? ""}` : `${event.place_text ?? ""} ${municipality?.name ?? ""}`);

  return (
    <main className="mx-auto max-w-screen-sm pb-28">
      <div className="relative aspect-[4/3] bg-bg-2">
        {img && (
          <ZoomableImage src={img} alt={event.title}>
            <Image src={img} alt={event.title} fill priority sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
          </ZoomableImage>
        )}
        <div className="absolute inset-x-4 top-[max(env(safe-area-inset-top),12px)] flex items-center justify-between">
          <Link href="/" aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><ArrowLeft size={20} /></Link>
          <div className="flex gap-2">
            <a href={`https://wa.me/?text=${shareText}`} aria-label="Compartir" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Share2 size={18} /></a>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
          </div>
        </div>
      </div>

      <section className="px-5 pt-5">
        <span className="rounded-full bg-bg-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">
          {CATEGORY_LABEL[event.category]}
        </span>
        <h1 className="mt-3 text-[26px] font-bold leading-tight">{event.title}</h1>

        <ul className="mt-5 space-y-4">
          {next && (
            <li className="flex gap-3">
              <CalendarDays size={20} className="mt-0.5 shrink-0 text-ink-2" />
              <div>
                <p className="text-[15px] font-medium">{fmtWhenLong(next.starts_at, next.ends_at, next.is_all_day)}</p>
                {occurrences.length > 1 && <p className="text-[13px] text-ink-2">{occurrences.length} fechas · ver programa abajo</p>}
              </div>
            </li>
          )}
          <li className="flex gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-ink-2" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{place?.name ?? event.place_text ?? "Lugar por confirmar"}</p>
              <p className="text-[13px] text-ink-2">
                {place?.address ? `${place.address} · ` : ""}{municipality?.name}{municipality ? `, ${municipality.state}` : ""}
              </p>
              {lat != null && lng != null && <StaticMap lat={lat} lng={lng} className="mt-3 h-[140px] w-full overflow-hidden rounded-card border border-line" />}
            </div>
          </li>
          {(organization || event.raw_ingestion_id) && (
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg-2 text-[12px] font-bold text-ink-2">
                {(organization?.name ?? "EL").slice(0, 2).toUpperCase()}
              </span>
              <p className="text-[14px] text-ink-2">Organiza: <span className="font-medium text-ink">{organization?.name ?? "Por confirmar"}</span></p>
            </li>
          )}
        </ul>
      </section>

      {event.description && (
        <section className="px-5 pt-7">
          <h2 className="text-[18px] font-bold">Sobre el evento</h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{event.description}</p>
        </section>
      )}

      {occurrences.length > 1 && (
        <section className="px-5 pt-7">
          <h2 className="text-[18px] font-bold">Programa</h2>
          <ul className="mt-2 divide-y divide-line">
            {occurrences.map((o) => (
              <li key={o.id} className="flex justify-between py-2.5 text-[14px]">
                <span>{fmtWhenLong(o.starts_at, o.ends_at, o.is_all_day)}</span>
                {o.note && <span className="text-ink-2">{o.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-5 pt-7">
        <h2 className="text-[18px] font-bold">Cómo llegar</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <a href={`https://www.google.com/maps/search/?api=1&query=${lat != null ? `${lat},${lng}` : mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Abrir en Maps</a>
          <a href={lat != null ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Waze</a>
        </div>
      </section>

      {nearby.length > 0 && (
        <section className="pt-7">
          <h2 className="px-5 text-[18px] font-bold">Más cerca de aquí</h2>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5">
            {nearby.map((e) => <CompactCard key={e.event_id} e={e} />)}
          </div>
        </section>
      )}

      <p className="px-5 pt-8 text-center">
        <a href={`mailto:hola@entrelugares.mx?subject=Dato incorrecto: ${encodeURIComponent(event.title)}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 underline">
          <Flag size={14} /> Reportar un dato incorrecto
        </a>
      </p>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-4">
          <div>
            <PriceTag isFree={event.is_free} min={event.price_min} max={event.price_max} className="!text-[18px]" />
            {!event.is_free && <span className="block text-[12px] text-ink-2">por persona</span>}
            {event.is_free && <span className="block text-[12px] text-ink-2">{fmtPrice(true, null, null) === "Gratis" ? "Entrada libre" : ""}</span>}
          </div>
          <a
            href={`https://wa.me/?text=${shareText}`}
            className="flex items-center gap-2 rounded-control bg-whatsapp px-5 py-3 text-[15px] font-semibold text-white"
          >
            <Share2 size={18} /> Compartir por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
