import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, AtSign, CalendarDays, ExternalLink, Flag, Globe, Heart, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
import { BackButton } from "./back-button";
import { DesktopOnly, MobileOnly } from "./desktop";
import { CompactCard, EventCard } from "./event-card";
import { ZoomableImage } from "./image-viewer";
import { StaticMap } from "./static-map-lazy";
import { PriceTag } from "./ui";
import { flyerUrl, fmtPhone, fmtWhenLong, waLink } from "@/lib/format";
import type { eventBySlug } from "@/lib/queries";
import { CATEGORY_LABEL, type NearRow } from "@/lib/types";

/**
 * Detalle de evento en tres presentaciones que comparten secciones pero no layout:
 * - EventMobile: página en teléfono (flyer arriba, barra fija de precio abajo)
 * - EventDesktop: página en escritorio (dos columnas, tarjeta de precio fija a la derecha)
 * - EventPanel: panel izquierdo de /mapa en escritorio (el mapa grande queda a la derecha)
 */
export type EventData = NonNullable<Awaited<ReturnType<typeof eventBySlug>>>;

export function eventCoords(d: EventData) {
  const lat = d.place?.lat ?? d.municipality?.lat;
  const lng = d.place?.lng ?? d.municipality?.lng;
  return lat != null && lng != null ? { lat, lng } : null;
}

function derive(d: EventData) {
  const { event, occurrences, place, municipality } = d;
  const next = occurrences.find((o) => new Date(o.ends_at ?? o.starts_at) >= new Date()) ?? occurrences[0];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const when = next ? fmtWhenLong(next.starts_at, next.ends_at, next.is_all_day) : "";
  const socials = [
    { url: event.instagram_url, label: "Instagram" },
    { url: event.facebook_url, label: "Facebook" },
    { url: event.tiktok_url, label: "TikTok" },
  ].filter((s): s is { url: string; label: string } => !!s.url);
  return {
    img: flyerUrl(event.image_path),
    next,
    when,
    coords: eventCoords(d),
    shareHref: `https://wa.me/?text=${encodeURIComponent(`${event.title} · ${when} · ${siteUrl}/evento/${event.slug}`)}`,
    socials,
    hasContact: !!(event.contact_phone || socials.length || event.website_url),
    mapsQuery: encodeURIComponent(place ? `${place.name}, ${municipality?.name ?? ""}` : `${event.place_text ?? ""} ${municipality?.name ?? ""}`),
  };
}
type Derived = ReturnType<typeof derive>;

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

function Category({ d }: { d: EventData }) {
  return (
    <span className="rounded-full bg-bg-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">
      {CATEGORY_LABEL[d.event.category]}
    </span>
  );
}

function Where({ d }: { d: EventData }) {
  const { event, place, municipality } = d;
  if (event.departure_text) {
    return (
      <>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-medium">
          <span>{event.departure_text}</span>
          <ArrowRight size={16} className="text-ink-2" aria-label="a" />
          <span>{place?.name ?? event.place_text ?? "Destino por confirmar"}</span>
        </p>
        <p className="text-[13px] text-ink-2">
          Salida desde {event.departure_text}
          {municipality && (event.departure_text.toLowerCase().includes(municipality.name.toLowerCase()) ? `, ${municipality.state}` : ` · ${municipality.name}, ${municipality.state}`)}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-[15px] font-medium">{place?.name ?? event.place_text ?? "Lugar por confirmar"}</p>
      <p className="text-[13px] text-ink-2">
        {place?.address ? `${place.address} · ` : ""}{municipality?.name}{municipality ? `, ${municipality.state}` : ""}
      </p>
    </>
  );
}

/** Fecha, lugar y organizador. `map`: mini mapa bajo el lugar (solo donde no hay otro mapa a la vista). */
function InfoList({ d, x, map }: { d: EventData; x: Derived; map?: React.ReactNode }) {
  const { event, occurrences, organization } = d;
  return (
    <ul className="space-y-4">
      {x.next && (
        <li className="flex gap-3">
          <CalendarDays size={20} className="mt-0.5 shrink-0 text-ink-2" />
          <div>
            <p className="text-[15px] font-medium">{x.when}</p>
            {occurrences.length > 1 && <p className="text-[13px] text-ink-2">{occurrences.length} fechas · ver programa</p>}
          </div>
        </li>
      )}
      <li className="flex gap-3">
        <MapPin size={20} className="mt-0.5 shrink-0 text-ink-2" />
        <div className="min-w-0 flex-1">
          <Where d={d} />
          {map}
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
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[18px] font-bold">{children}</h2>;
}

function Description({ d }: { d: EventData }) {
  if (!d.event.description) return null;
  return (
    <section>
      <H2>Sobre el evento</H2>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{d.event.description}</p>
    </section>
  );
}

function ContactButtons({ d }: { d: EventData }) {
  const { event } = d;
  if (!event.contact_phone) return null;
  return (
    <div className="flex gap-2">
      <a href={`tel:${event.contact_phone}`} className="flex items-center gap-1.5 rounded-control border border-ink px-3 py-2 text-[14px] font-semibold"><Phone size={16} /> Llamar</a>
      {event.contact_whatsapp && (
        <a href={`${waLink(event.contact_phone)}?text=${encodeURIComponent(`Hola, vi "${event.title}" en entrelugares`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-control bg-whatsapp px-3 py-2 text-[14px] font-semibold text-white"><MessageCircle size={16} /> WhatsApp</a>
      )}
    </div>
  );
}

function Contact({ d, x }: { d: EventData; x: Derived }) {
  if (!x.hasContact) return null;
  const { event } = d;
  return (
    <section>
      <H2>Contacto</H2>
      {event.contact_phone && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] font-medium">{fmtPhone(event.contact_phone)}</p>
          <ContactButtons d={d} />
        </div>
      )}
      {(x.socials.length > 0 || event.website_url) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {x.socials.map((s) => (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium"><AtSign size={14} /> {s.label}</a>
          ))}
          {event.website_url && (
            <a href={event.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium"><Globe size={14} /> Sitio web</a>
          )}
        </div>
      )}
    </section>
  );
}

function Program({ d }: { d: EventData }) {
  if (d.occurrences.length < 2) return null;
  return (
    <section>
      <H2>Programa</H2>
      <ul className="mt-2 divide-y divide-line">
        {d.occurrences.map((o) => (
          <li key={o.id} className="flex justify-between gap-4 py-2.5 text-[14px]">
            <span>{fmtWhenLong(o.starts_at, o.ends_at, o.is_all_day)}</span>
            {o.note && <span className="text-right text-ink-2">{o.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Directions({ x, title = true }: { x: Derived; title?: boolean }) {
  const c = x.coords;
  return (
    <section>
      {title && <H2>Cómo llegar</H2>}
      <div className={`grid grid-cols-2 gap-3 ${title ? "mt-3" : ""}`}>
        <a href={`https://www.google.com/maps/search/?api=1&query=${c ? `${c.lat},${c.lng}` : x.mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Abrir en Maps</a>
        <a href={c ? `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes` : `https://waze.com/ul?q=${x.mapsQuery}`} target="_blank" rel="noreferrer" className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Waze</a>
      </div>
    </section>
  );
}

function Report({ d }: { d: EventData }) {
  return (
    <a href={`mailto:hola@entrelugares.mx?subject=Dato incorrecto: ${encodeURIComponent(d.event.title)}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 underline">
      <Flag size={14} /> Reportar un dato incorrecto
    </a>
  );
}

function Price({ d, big }: { d: EventData; big?: boolean }) {
  const { event } = d;
  return (
    <div>
      <PriceTag isFree={event.is_free} min={event.price_min} max={event.price_max} className={big ? "!text-[22px]" : "!text-[18px]"} />
      <span className="block text-[12px] text-ink-2">{event.is_free ? "Entrada libre" : "por persona"}</span>
    </div>
  );
}

function ShareButton({ x, className }: { x: Derived; className?: string }) {
  return (
    <a href={x.shareHref} target="_blank" rel="noreferrer" className={`flex items-center justify-center gap-2 rounded-control bg-whatsapp px-5 py-3 text-[15px] font-semibold text-white ${className ?? ""}`}>
      <Share2 size={18} /> Compartir por WhatsApp
    </a>
  );
}

function Flyer({ x, alt, sizes, className, contain }: { x: Derived; alt: string; sizes: string; className: string; contain?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-bg-2 ${className}`}>
      {x.img && (
        <ZoomableImage src={x.img} alt={alt}>
          <Image src={x.img} alt={alt} fill priority sizes={sizes} className={contain ? "object-contain" : "object-cover"} />
        </ZoomableImage>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentaciones
// ---------------------------------------------------------------------------

export function EventMobile({ d, nearby }: { d: EventData; nearby: NearRow[] }) {
  const x = derive(d);
  return (
    <main className="mx-auto max-w-screen-sm pb-28">
      <div className="relative">
        <Flyer x={x} alt={d.event.title} sizes="(max-width: 640px) 100vw, 640px" className="aspect-[4/3]" />
        {/* fija: se puede volver o compartir desde cualquier punto del scroll */}
        <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-40 mx-auto flex max-w-screen-sm items-center justify-between px-4 [&>*]:pointer-events-auto">
          <BackButton className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft" />
          <div className="flex gap-2">
            <a href={x.shareHref} aria-label="Compartir" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Share2 size={18} /></a>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Heart size={18} /></span>
          </div>
        </div>
      </div>

      <div className="space-y-7 px-5 pt-5">
        <div>
          <Category d={d} />
          <h1 className="mt-3 text-[26px] font-bold leading-tight">{d.event.title}</h1>
          <div className="mt-5">
            <InfoList d={d} x={x} map={x.coords && <MobileOnly><StaticMap lat={x.coords.lat} lng={x.coords.lng} className="mt-3 h-[140px] w-full overflow-hidden rounded-card border border-line" /></MobileOnly>} />
          </div>
        </div>
        <Description d={d} />
        <Contact d={d} x={x} />
        <Program d={d} />
        <Directions x={x} />
      </div>

      {nearby.length > 0 && (
        <section className="pt-7">
          <h2 className="px-5 text-[18px] font-bold">Más cerca de aquí</h2>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5">
            {nearby.map((e) => <CompactCard key={e.event_id} e={e} />)}
          </div>
        </section>
      )}

      <p className="px-5 pt-8 text-center"><Report d={d} /></p>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-4">
          <Price d={d} />
          <ShareButton x={x} />
        </div>
      </div>
    </main>
  );
}

export function EventDesktop({ d, nearby }: { d: EventData; nearby: NearRow[] }) {
  const x = derive(d);
  const { event, municipality } = d;
  return (
    <main className="mx-auto max-w-[1120px] px-8 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
        <div className="flex gap-2">
          <a href={x.shareHref} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold underline-offset-2 hover:bg-bg-2 hover:underline"><Share2 size={16} /> Compartir</a>
          <span className="flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold"><Heart size={16} /> Guardar</span>
        </div>
      </div>

      <header className="mt-4">
        <Category d={d} />
        <h1 className="mt-3 text-[34px] font-bold leading-tight">{event.title}</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {x.when}{municipality ? ` · ${municipality.name}, ${municipality.state}` : ""}
        </p>
      </header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_360px] gap-12">
        <div className="min-w-0 space-y-9">
          <Flyer x={x} alt={event.title} sizes="720px" className="aspect-[4/3] rounded-card" contain />
          <InfoList d={d} x={x} />
          <Description d={d} />
          <Program d={d} />
          <Contact d={d} x={x} />
          <Report d={d} />
        </div>

        <aside>
          <div className="sticky top-[100px] space-y-5 rounded-card border border-line p-6 shadow-soft">
            <Price d={d} big />
            {x.next && (
              <div className="rounded-control border border-line-2 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">Próxima fecha</p>
                <p className="mt-0.5 text-[15px] font-medium">{x.when}</p>
                {d.occurrences.length > 1 && <p className="text-[13px] text-ink-2">y {d.occurrences.length - 1} más</p>}
              </div>
            )}
            <ShareButton x={x} className="w-full" />
            {event.contact_phone && <div className="[&>div]:grid [&>div]:grid-cols-2 [&_a]:justify-center"><ContactButtons d={d} /></div>}
            {x.coords && (
              <DesktopOnly>
                <StaticMap lat={x.coords.lat} lng={x.coords.lng} className="h-[180px] w-full overflow-hidden rounded-control border border-line" />
              </DesktopOnly>
            )}
            <Directions x={x} title={false} />
          </div>
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="mt-14 border-t border-line pt-10">
          <h2 className="text-[22px] font-bold">Más cerca de aquí</h2>
          <div className="mt-2 grid grid-cols-3 gap-3 [&>a]:px-0">
            {nearby.map((e) => <EventCard key={e.event_id} e={e} />)}
          </div>
        </section>
      )}
    </main>
  );
}

/** Panel izquierdo de /mapa: detalle completo sin salir del mapa; "Volver" regresa a la lista. */
export function EventPanel({ d, backHref, sheet }: { d: EventData; backHref: string; sheet?: boolean }) {
  const x = derive(d);
  return (
    <article className={sheet ? "space-y-6 px-5 pb-10 pt-1" : "space-y-7 px-5 pb-12 pt-5"}>
      <div className={`flex items-center justify-between gap-3 ${sheet ? "pr-10" : ""}`}>
        {sheet ? <Category d={d} /> : (
          <Link href={backHref} scroll={false} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold hover:bg-bg-2">
            <ArrowLeft size={15} /> Volver a la lista
          </Link>
        )}
        <Link href={`/evento/${d.event.slug}`} className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
          Página completa <ExternalLink size={13} />
        </Link>
      </div>

      {!sheet && <Flyer x={x} alt={d.event.title} sizes="720px" className="aspect-[16/10] rounded-card" contain />}

      <div>
        {!sheet && <Category d={d} />}
        <h1 className={sheet ? "text-[24px] font-bold leading-tight" : "mt-3 text-[28px] font-bold leading-tight"}>{d.event.title}</h1>
        <div className="mt-5"><InfoList d={d} x={x} /></div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-card border border-line p-4">
        <Price d={d} />
        <ShareButton x={x} />
      </div>

      {sheet && <Flyer x={x} alt={d.event.title} sizes="640px" className="aspect-[4/3] rounded-card" contain />}

      <Description d={d} />
      <Contact d={d} x={x} />
      <Program d={d} />
      <Directions x={x} />
      <Report d={d} />
    </article>
  );
}
