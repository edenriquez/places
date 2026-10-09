import Image from "next/image";
import Link from "next/link";
import { AtSign, Backpack, CalendarDays, CheckCircle2, Clock, Flag, Globe, MapPin, MessageCircle, Mountain, Phone, Route, Share2, Sun, Ticket } from "lucide-react";
import clsx from "clsx";
import { BackButton } from "./back-button";
import { AnyDayBadge, KindBadge } from "./experience-card";
import { FlyerCarousel, type Slide } from "./flyer-carousel";
import { ZoomableImage } from "./image-viewer";
import { PriceTag } from "./ui";
import { DIFFICULTY_LABEL, fmtExperiencePrice, fmtKm } from "@/lib/experiences";
import { flyerUrl, fmtPhone, fmtPrice, fmtWhenShort, focusStyle, waLink } from "@/lib/format";
import type { experienceBySlug } from "@/lib/queries";

/**
 * Detalle de experiencia. Como el de eventos, teléfono y escritorio comparten secciones pero no layout.
 * Lo que la distingue de un evento: no tiene fecha (horarios y temporada), y lista sus salidas con guía.
 */
export type ExperienceData = NonNullable<Awaited<ReturnType<typeof experienceBySlug>>>;

const dateFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const monthYear = (iso: string) => dateFmt.format(new Date(iso.length === 10 ? `${iso}T12:00:00-06:00` : iso));
const dayBox = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", timeZone: "America/Mexico_City" });

function derive(d: ExperienceData) {
  const { experience: x, place, municipality } = d;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const cover = flyerUrl(x.image_path);
  const focus = focusStyle(x.image_focus_x, x.image_focus_y);
  const slides: Slide[] = [
    ...(cover ? [{ src: cover, style: focus }] : []),
    ...(x.gallery_paths ?? []).map((p) => flyerUrl(p)).filter((s): s is string => !!s).map((src) => ({ src })),
  ];
  const coords = x.lat != null && x.lng != null ? { lat: x.lat, lng: x.lng } : null;
  const where = place?.name ?? x.place_text;
  const greeting = encodeURIComponent(`Hola, vi "${x.title}" en entrelugares y quiero más información`);
  // reservar: WhatsApp si hay, si no llamada, si no el sitio
  const book = x.contact_phone && x.contact_whatsapp
    ? { href: `${waLink(x.contact_phone)}?text=${greeting}`, label: "Reservar", icon: MessageCircle, track: "whatsapp_contact", wa: true }
    : x.contact_phone
      ? { href: `tel:${x.contact_phone}`, label: "Llamar", icon: Phone, track: "call", wa: false }
      : x.website_url
        ? { href: x.website_url, label: "Sitio web", icon: Globe, track: "website", wa: false }
        : null;
  return {
    x,
    slides,
    cover,
    focus,
    coords,
    where,
    book,
    label: `experiencia:${x.slug}`,
    shareHref: `https://wa.me/?text=${encodeURIComponent(`${x.title} · ${[where, municipality?.name].filter(Boolean).join(", ")} · ${siteUrl}/experiencia/${x.slug}?utm_source=whatsapp&utm_medium=share`)}`,
    mapsQuery: encodeURIComponent(`${where ?? x.title}, ${municipality?.name ?? ""}`),
    expired: !!x.valid_until && x.valid_until < new Date().toISOString().slice(0, 10),
  };
}
type Derived = ReturnType<typeof derive>;

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[18px] font-bold">{children}</h2>;
}

function Header({ d, x, big }: { d: ExperienceData; x: Derived; big?: boolean }) {
  const { municipality } = d;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <KindBadge kind={x.x.kind} />
        <AnyDayBadge text={x.x.availability_text ?? "Cualquier día"} />
      </div>
      <h1 className={clsx("mt-3 font-bold leading-tight", big ? "text-[34px]" : "text-[26px]")}>{x.x.title}</h1>
      <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2">
        <MapPin size={15} className="shrink-0" aria-hidden />
        <span>
          {x.where && d.place ? (
            <Link href={`/municipio/${municipality?.slug}/${d.place.slug}`} className="underline-offset-2 hover:underline">{x.where}</Link>
          ) : x.where}
          {x.where && municipality ? ", " : ""}
          {municipality && <Link href={`/municipio/${municipality.slug}`} className="underline-offset-2 hover:underline">{municipality.name}</Link>}
          {municipality ? ` · ${municipality.state}` : ""}
        </span>
      </p>
    </div>
  );
}

function Facts({ x }: { x: Derived }) {
  const e = x.x;
  const km = fmtKm(e.distance_km);
  const items = [
    e.duration_text && { icon: Clock, label: "Duración", value: e.duration_text },
    km && { icon: Route, label: "Distancia", value: km },
    e.difficulty && { icon: Mountain, label: "Dificultad", value: DIFFICULTY_LABEL[e.difficulty] },
    { icon: Ticket, label: e.price_note ? cap(e.price_note) : "Precio", value: fmtExperiencePrice(e) },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[];
  return (
    <div className="grid divide-x divide-line rounded-card border border-line py-3 text-center" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="px-1">
          <Icon size={18} className="mx-auto text-ink-2" aria-hidden />
          <p className="mt-1 text-[14px] font-semibold leading-tight">{value}</p>
          <p className="text-[11px] text-ink-3">{label}</p>
        </div>
      ))}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function WhenToGo({ x }: { x: Derived }) {
  const e = x.x;
  if (!e.hours.length && !e.season_text && !e.verified_at && !e.valid_until) return null;
  return (
    <section>
      <H2>Cuándo ir</H2>
      {(e.hours.length > 0 || e.season_text) && (
        <ul className="mt-3 divide-y divide-line rounded-card border border-line text-[14px]">
          {e.hours.map((h, i) => (
            <li key={i} className="flex justify-between gap-4 px-4 py-2.5"><span className="text-ink-2">{h.days}</span><span className="text-right font-medium">{h.time}</span></li>
          ))}
          {e.season_text && (
            <li className="flex items-start gap-2.5 px-4 py-3"><Sun size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden /><span className="whitespace-pre-line">{e.season_text}</span></li>
          )}
        </ul>
      )}
      {(e.verified_at || e.valid_until) && (
        <p className={clsx("mt-2 flex items-center gap-1.5 text-[12px]", x.expired ? "text-warn" : "text-ink-3")}>
          <CheckCircle2 size={13} aria-hidden />
          {[e.verified_at && `Información verificada en ${monthYear(e.verified_at)}`, e.valid_until && `vigente hasta ${monthYear(e.valid_until)}`].filter(Boolean).join(" · ")}
          {x.expired && " · confirma antes de ir"}
        </p>
      )}
    </section>
  );
}

function Outings({ d }: { d: ExperienceData }) {
  if (!d.outings.length) return null;
  const shown = d.outings.slice(0, 6);
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <H2>Salidas con guía</H2>
        <span className="text-[13px] text-ink-2">{d.outings.length} {d.outings.length === 1 ? "próxima" : "próximas"}</span>
      </div>
      <p className="mt-1 text-[13px] text-ink-2">Puedes ir por tu cuenta cualquier día. Estas fechas tienen cupo y se organizan aparte.</p>
      <ul className="mt-3 space-y-2">
        {shown.map((o) => {
          const [dow, day] = dayBox.format(new Date(o.starts_at)).replace(".", "").split(" ");
          return (
            <li key={o.id}>
              <Link href={`/evento/${o.event.slug}`} className="flex items-center gap-3 rounded-card border border-line p-3 hover:border-ink">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-center leading-none text-accent">
                  <span><span className="block text-[11px] font-semibold uppercase">{dow}</span><span className="block text-[15px] font-bold">{day}</span></span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{fmtWhenShort(o.starts_at, o.is_all_day)}</span>
                  <span className="block truncate text-[13px] text-ink-2">{o.note ?? o.event.title}</span>
                </span>
                <PriceTag isFree={o.event.is_free} min={o.event.price_min} max={o.event.price_max} className="shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function About({ x }: { x: Derived }) {
  if (!x.x.description) return null;
  return (
    <section>
      <H2>Sobre la experiencia</H2>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{x.x.description}</p>
    </section>
  );
}

function Bring({ x }: { x: Derived }) {
  if (!x.x.bring.length) return null;
  return (
    <section>
      <H2>Qué llevar</H2>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
        {x.x.bring.map((t) => <li key={t} className="flex items-start gap-2"><Backpack size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden /> {t}</li>)}
      </ul>
    </section>
  );
}

function Provider({ d, x }: { d: ExperienceData; x: Derived }) {
  const e = x.x;
  const socials = [{ url: e.instagram_url, label: "Instagram" }, { url: e.facebook_url, label: "Facebook" }].filter((s): s is { url: string; label: string } => !!s.url);
  if (!d.organization && !e.contact_phone && !socials.length && !e.website_url) return null;
  return (
    <section>
      <H2>Quién la ofrece</H2>
      <div className="mt-3 rounded-card border border-line p-4">
        {d.organization && (
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bg-2 text-[13px] font-bold text-ink-2">{d.organization.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{d.organization.name}</span>
              <span className="block text-[13px] text-ink-2">Prestador local{d.municipality ? ` · ${d.municipality.name}` : ""}</span>
            </span>
          </div>
        )}
        {e.booking_note && <p className={clsx("text-[14px] text-ink-2", d.organization && "mt-3")}>{e.booking_note}</p>}
        {e.contact_phone && (
          <div className={clsx("flex flex-wrap items-center justify-between gap-3", (d.organization || e.booking_note) && "mt-3")}>
            <p className="text-[15px] font-medium">{fmtPhone(e.contact_phone)}</p>
            <div className="flex gap-2">
              <a href={`tel:${e.contact_phone}`} data-track="call" data-label={x.label} className="flex items-center gap-1.5 rounded-control border border-ink px-3 py-2 text-[14px] font-semibold"><Phone size={16} aria-hidden /> Llamar</a>
              {e.contact_whatsapp && (
                <a href={x.book?.wa ? x.book.href : waLink(e.contact_phone)} target="_blank" rel="noreferrer" data-track="whatsapp_contact" data-label={x.label} className="flex items-center gap-1.5 rounded-control bg-whatsapp px-3 py-2 text-[14px] font-semibold text-white"><MessageCircle size={16} aria-hidden /> WhatsApp</a>
              )}
            </div>
          </div>
        )}
        {(socials.length > 0 || e.website_url) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" data-track="social" data-label={`${x.label}:${s.label}`} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium"><AtSign size={14} aria-hidden /> {s.label}</a>
            ))}
            {e.website_url && (
              <a href={e.website_url} target="_blank" rel="noreferrer" data-track="website" data-label={x.label} className="flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1.5 text-[13px] font-medium"><Globe size={14} aria-hidden /> Sitio web</a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Directions({ x, title = true }: { x: Derived; title?: boolean }) {
  const c = x.coords;
  return (
    <section>
      {title && <H2>Cómo llegar</H2>}
      <div className={clsx("grid grid-cols-2 gap-3", title && "mt-3")}>
        <a href={`https://www.google.com/maps/search/?api=1&query=${c ? `${c.lat},${c.lng}` : x.mapsQuery}`} target="_blank" rel="noreferrer" data-track="maps" data-label={x.label} className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Abrir en Maps</a>
        <a href={c ? `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes` : `https://waze.com/ul?q=${x.mapsQuery}`} target="_blank" rel="noreferrer" data-track="waze" data-label={x.label} className="rounded-control border border-ink py-3 text-center text-[14px] font-semibold">Waze</a>
      </div>
    </section>
  );
}

function Report({ x }: { x: Derived }) {
  return (
    <a href={`mailto:hola@entrelugares.mx?subject=Dato incorrecto: ${encodeURIComponent(x.x.title)}`} className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 underline">
      <Flag size={14} aria-hidden /> Reportar un dato incorrecto
    </a>
  );
}

function Price({ d, x, big }: { d: ExperienceData; x: Derived; big?: boolean }) {
  const e = x.x;
  return (
    <div className="min-w-0">
      <p className="flex min-w-0 items-baseline gap-1.5">
        <PriceTag isFree={e.is_free} min={e.price_min} max={e.price_max} className={clsx("shrink-0 whitespace-nowrap", big ? "!text-[22px]" : "!text-[18px]")} />
        {e.price_note && !e.is_free && <span className={clsx("text-[13px] text-ink-2", !big && "truncate")}>{e.price_note}</span>}
      </p>
      <span className="block truncate text-[12px] text-ink-2">{d.outings.length ? `o salida con guía desde ${minOutingPrice(d)}` : e.availability_text ?? "Cualquier día"}</span>
    </div>
  );
}

function minOutingPrice(d: ExperienceData) {
  const prices = d.outings.map((o) => (o.event.is_free ? 0 : o.event.price_min)).filter((p): p is number => p != null);
  return prices.length ? fmtPrice(Math.min(...prices) === 0, Math.min(...prices), null) : "consultar";
}

function BookButton({ x, className }: { x: Derived; className?: string }) {
  const b = x.book;
  if (!b) {
    return (
      <a href={x.shareHref} target="_blank" rel="noreferrer" data-track="share_whatsapp" data-label={x.label} className={clsx("flex items-center justify-center gap-2 rounded-control bg-whatsapp px-5 py-3 text-[15px] font-semibold text-white", className)}>
        <Share2 size={18} aria-hidden /> Compartir
      </a>
    );
  }
  const Icon = b.icon;
  return (
    <a href={b.href} target={b.href.startsWith("tel:") ? undefined : "_blank"} rel="noreferrer" data-track={b.track} data-label={x.label}
      className={clsx("flex items-center justify-center gap-2 rounded-control px-5 py-3 text-[15px] font-semibold", b.wa ? "bg-whatsapp text-white" : "bg-ink text-white", className)}>
      <Icon size={18} aria-hidden /> {b.label}
    </a>
  );
}

/** Portada sola o carrusel si hay más fotos. */
function Photos({ x, sizes, aspect, rounded, contain }: { x: Derived; sizes: string; aspect: string; rounded?: boolean; contain?: boolean }) {
  if (x.slides.length > 1) {
    return <FlyerCarousel slides={x.slides} alt={x.x.title} sizes={sizes} contain={contain} slideClassName={clsx(aspect, rounded && "rounded-card")} />;
  }
  return (
    <div className={clsx("relative overflow-hidden bg-bg-2", aspect, rounded && "rounded-card")}>
      {x.cover && (
        <ZoomableImage src={x.cover} alt={x.x.title}>
          <Image src={x.cover} alt={x.x.title} fill sizes={sizes} priority className={contain ? "object-contain" : "object-cover"} style={contain ? undefined : x.focus} />
        </ZoomableImage>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentaciones
// ---------------------------------------------------------------------------

export function ExperienceMobile({ d }: { d: ExperienceData }) {
  const x = derive(d);
  return (
    <main className="mx-auto max-w-screen-sm pb-32">
      <div className="relative">
        <Photos x={x} sizes="(max-width: 640px) 100vw, 640px" aspect="aspect-[4/3]" />
        <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-40 mx-auto flex max-w-screen-sm items-center justify-between px-4 [&>*]:pointer-events-auto">
          <BackButton className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft" />
          <a href={x.shareHref} aria-label="Compartir" data-track="share_whatsapp" data-label={x.label} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft"><Share2 size={18} /></a>
        </div>
      </div>

      <div className="space-y-7 px-5 pt-4">
        <div className="space-y-5">
          <Header d={d} x={x} />
          <Facts x={x} />
        </div>
        <WhenToGo x={x} />
        <Outings d={d} />
        <About x={x} />
        <Bring x={x} />
        <Provider d={d} x={x} />
        <Directions x={x} />
        <p className="text-center"><Report x={x} /></p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <Price d={d} x={x} />
          <BookButton x={x} className="shrink-0" />
        </div>
      </div>
    </main>
  );
}

export function ExperienceDesktop({ d }: { d: ExperienceData }) {
  const x = derive(d);
  const next = d.outings[0];
  return (
    <main className="mx-auto max-w-[1120px] px-8 pb-16 pt-6">
      <div className="flex items-center justify-between">
        <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
        <a href={x.shareHref} target="_blank" rel="noreferrer" data-track="share_whatsapp" data-label={x.label} className="flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-semibold underline-offset-2 hover:bg-bg-2 hover:underline"><Share2 size={16} /> Compartir</a>
      </div>
      <header className="mt-4"><Header d={d} x={x} big /></header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_360px] gap-12">
        <div className="min-w-0 space-y-9">
          <Photos x={x} sizes="720px" aspect="aspect-[4/3]" rounded />
          <Facts x={x} />
          <About x={x} />
          <WhenToGo x={x} />
          <Outings d={d} />
          <Bring x={x} />
          <Provider d={d} x={x} />
          <Report x={x} />
        </div>
        <aside>
          <div className="sticky top-[100px] space-y-5 rounded-card border border-line p-6 shadow-soft">
            <Price d={d} x={x} big />
            {next && (
              <Link href={`/evento/${next.event.slug}`} className="block rounded-control border border-line-2 px-4 py-3 hover:border-ink">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2"><CalendarDays size={12} aria-hidden /> Próxima salida con guía</p>
                <p className="mt-0.5 text-[15px] font-medium">{fmtWhenShort(next.starts_at, next.is_all_day)}</p>
                {d.outings.length > 1 && <p className="text-[13px] text-ink-2">y {d.outings.length - 1} más</p>}
              </Link>
            )}
            <BookButton x={x} className="w-full" />
            <Directions x={x} title={false} />
          </div>
        </aside>
      </div>
    </main>
  );
}
