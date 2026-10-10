import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, Clock, Infinity as Always, Mountain, Route } from "lucide-react";
import { DIFFICULTY_LABEL, EXPERIENCE_KINDS, fmtKm, type Difficulty, type ExperienceKind } from "@/lib/experiences";
import { fmtDistance } from "@/lib/format";
import type { ExperienceRow } from "@/lib/types";
import { Flyer } from "./event-card";
import { LinkPending } from "./link-pending";
import { PriceTag } from "./ui";

export function KindBadge({ kind, solid }: { kind: ExperienceKind; solid?: boolean }) {
  const k = EXPERIENCE_KINDS[kind];
  return (
    <span className={clsx("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", solid ? "bg-white/95 text-ink" : "bg-bg-2 text-ink-2")}>
      {k?.emoji} {k?.label ?? "Experiencia"}
    </span>
  );
}

/** Siempre disponible: distingue una experiencia de un evento de un vistazo. */
export function AnyDayBadge({ text = "Cualquier día", className }: { text?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#e8f5ee] px-2.5 py-1 text-[11px] font-semibold text-[#17734a]", className)}>
      <Always size={12} strokeWidth={2.6} aria-hidden /> {text}
    </span>
  );
}

/** Duración · distancia · dificultad, lo que haya. */
export function ExperienceFacts({ x, className }: { x: { duration_text: string | null; distance_km: number | null; difficulty: Difficulty | null }; className?: string }) {
  const km = fmtKm(x.distance_km);
  if (!x.duration_text && !km && !x.difficulty) return null;
  return (
    <p className={clsx("flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-ink-2", className)}>
      {x.duration_text && <span className="inline-flex items-center gap-1"><Clock size={13} aria-hidden /> {x.duration_text}</span>}
      {km && <span className="inline-flex items-center gap-1"><Route size={13} aria-hidden /> {km}</span>}
      {x.difficulty && <span className="inline-flex items-center gap-1"><Mountain size={13} aria-hidden /> {DIFFICULTY_LABEL[x.difficulty]}</span>}
    </p>
  );
}

function Upcoming({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">
      <CalendarDays size={12} aria-hidden /> {n} {n === 1 ? "salida" : "salidas"} con guía
    </span>
  );
}

/** Tarjeta grande de lista: misma anatomía que la de eventos (foto 4:3, chip, título, datos, precio). */
export function ExperienceCard({ x, hideDistance, eager }: { x: ExperienceRow; hideDistance?: boolean; eager?: boolean }) {
  return (
    <Link href={`/experiencia/${x.slug}`} className="block px-5 py-3 lg:rounded-card lg:transition lg:hover:bg-bg-2/60">
      <div className="relative">
        <Flyer path={x.image_path} focus={{ x: x.image_focus_x, y: x.image_focus_y }} alt={x.title} sizes="(max-width: 640px) 100vw, 640px" className="aspect-[4/3] rounded-card" eager={eager} />
        <div className="absolute left-3 top-3"><KindBadge kind={x.kind} solid /></div>
        <Upcoming n={x.upcoming} />
        <LinkPending className="inset-0 rounded-card bg-white/40" />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug">{x.title}</h3>
          <p className="mt-1 text-[14px] font-medium text-[#17734a]">{x.availability_text ?? "Cualquier día"}</p>
          <p className="truncate text-[14px] text-ink-2">
            {x.place_name ? `${x.place_name} · ` : ""}{x.municipality_name}{hideDistance ? "" : ` · ${fmtDistance(x.distance_m)}`}
          </p>
          <ExperienceFacts x={x} className="mt-1" />
        </div>
        <PriceTag isFree={x.is_free} min={x.price_min} max={x.price_max} className="mt-0.5 shrink-0" />
      </div>
    </Link>
  );
}

/** Tarjeta angosta para carruseles horizontales. */
export function ExperienceTile({ x }: { x: ExperienceRow }) {
  return (
    <Link href={`/experiencia/${x.slug}`} className="w-[230px] shrink-0 snap-start">
      <div className="relative">
        <Flyer path={x.image_path} focus={{ x: x.image_focus_x, y: x.image_focus_y }} alt={x.title} sizes="230px" className="aspect-[4/3] rounded-card" />
        <div className="absolute left-2.5 top-2.5"><KindBadge kind={x.kind} solid /></div>
      </div>
      <h3 className="mt-2 line-clamp-1 text-[15px] font-semibold">{x.title}</h3>
      <p className="truncate text-[13px] text-ink-2">{x.place_name ? `${x.place_name} · ` : ""}{x.municipality_name}</p>
      <ExperienceFacts x={x} className="mt-0.5 !text-[12px]" />
    </Link>
  );
}
