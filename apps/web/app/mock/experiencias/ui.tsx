import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, Heart, Infinity as Always, Mountain, Route } from "lucide-react";
import { typeOf, type Dated, type Experience } from "./data";

export const BASE = "/mock/experiencias";

/** Franja que deja claro que la pantalla es un mock y permite saltar entre pantallas. */
export function MockBar({ current }: { current: string }) {
  const screens = [
    ["explorar", "Explorar"], ["municipio", "Municipio"], ["lugar", "Lugar"], ["detalle", "Experiencia"], ["salida", "Salida (evento)"],
  ];
  return (
    <div className="sticky top-0 z-50 border-b border-line bg-[#fffbe6]/95 px-3 py-2 backdrop-blur">
      <div className="no-scrollbar mx-auto flex max-w-screen-sm items-center gap-1.5 overflow-x-auto text-[12px]">
        <Link href={BASE} className="shrink-0 rounded-full bg-ink px-2.5 py-1 font-semibold text-white">Mock</Link>
        {screens.map(([href, label]) => (
          <Link key={href} href={`${BASE}/${href}`} className={`shrink-0 rounded-full px-2.5 py-1 font-medium ${current === href ? "bg-white text-ink shadow-soft" : "text-ink-2"}`}>{label}</Link>
        ))}
      </div>
    </div>
  );
}

export function TypeBadge({ e, solid }: { e: Experience; solid?: boolean }) {
  const t = typeOf(e.type);
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${solid ? "bg-white/95 text-ink" : "bg-bg-2 text-ink-2"}`}>
      {t.emoji} {t.label}
    </span>
  );
}

/** Siempre disponible: distingue a una experiencia de un evento de un vistazo. */
export function AnyDayBadge({ text = "Cualquier día" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5ee] px-2.5 py-1 text-[11px] font-semibold text-[#17734a]">
      <Always size={12} strokeWidth={2.6} /> {text}
    </span>
  );
}

export function Facts({ e, className = "" }: { e: Experience; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-ink-2 ${className}`}>
      <span className="inline-flex items-center gap-1"><Clock size={13} /> {e.duration}</span>
      {e.distance && <span className="inline-flex items-center gap-1"><Route size={13} /> {e.distance}</span>}
      {e.difficulty && <span className="inline-flex items-center gap-1"><Mountain size={13} /> {e.difficulty}</span>}
    </p>
  );
}

/** Tarjeta grande de experiencia (misma anatomía que la de eventos: foto 4:3, chip, título, datos, precio). */
export function ExperienceCard({ e }: { e: Experience }) {
  return (
    <Link href={`${BASE}/detalle`} className="block px-5 py-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-bg-2">
        <Image src={e.img} alt={e.title} fill sizes="640px" className="object-cover" />
        <div className="absolute left-3 top-3 flex gap-1.5"><TypeBadge e={e} solid /></div>
        <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90"><Heart size={17} /></span>
        {e.upcoming > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">
            <CalendarDays size={12} /> {e.upcoming} salida{e.upcoming === 1 ? "" : "s"} con guía
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug">{e.title}</h3>
          <p className="mt-1 text-[14px] font-medium text-[#17734a]">{e.availability}</p>
          <p className="truncate text-[14px] text-ink-2">{e.place} · {e.municipality}</p>
          <Facts e={e} className="mt-1" />
        </div>
        <span className="mt-0.5 shrink-0 text-[15px] font-semibold">{e.price.replace(" acceso", "").replace(" con guía", "")}</span>
      </div>
    </Link>
  );
}

/** Tarjeta angosta para carruseles horizontales. */
export function ExperienceTile({ e }: { e: Experience }) {
  return (
    <Link href={`${BASE}/detalle`} className="w-[230px] shrink-0 snap-start">
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-bg-2">
        <Image src={e.img} alt={e.title} fill sizes="230px" className="object-cover" />
        <div className="absolute left-2.5 top-2.5"><TypeBadge e={e} solid /></div>
      </div>
      <h3 className="mt-2 line-clamp-1 text-[15px] font-semibold">{e.title}</h3>
      <p className="truncate text-[13px] text-ink-2">{e.place} · {e.municipality}</p>
      <Facts e={e} className="mt-0.5 !text-[12px]" />
    </Link>
  );
}

/** Evento con fecha (como las tarjetas actuales); si viene de una experiencia lo dice. */
export function DatedCard({ d, href = `${BASE}/salida` }: { d: Dated; href?: string }) {
  return (
    <Link href={href} className="flex gap-3 px-5 py-2.5">
      <div className="relative h-[84px] w-[96px] shrink-0 overflow-hidden rounded-[12px] bg-bg-2">
        <Image src={d.img} alt="" fill sizes="96px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.03em] text-accent">{d.when}</p>
        <h3 className="line-clamp-1 text-[15px] font-semibold">{d.title}</h3>
        <p className="truncate text-[13px] text-ink-2">{d.place}</p>
        {d.from && <p className="truncate text-[12px] text-ink-3">Parte de: {d.from}</p>}
      </div>
      <span className="shrink-0 pt-0.5 text-[14px] font-semibold">{d.price}</span>
    </Link>
  );
}
