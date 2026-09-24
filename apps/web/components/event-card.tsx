import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { Navigation } from "lucide-react";
import { CATEGORY_LABEL, type NearRow } from "@/lib/types";
import { flyerUrl, fmtDistance, fmtTime, fmtWhenShort } from "@/lib/format";
import { SaveButton } from "./save-button";
import { LiveBadge, PriceTag } from "./ui";

function Flyer({ path, alt, sizes, className }: { path: string | null; alt: string; sizes: string; className?: string }) {
  const url = flyerUrl(path);
  return (
    <div className={`relative overflow-hidden bg-bg-2 ${className ?? ""}`}>
      {url ? (
        <Image src={url} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[12px] text-ink-3">Sin imagen</div>
      )}
    </div>
  );
}

/** Tarjeta grande de lista ("Este fin de semana") */
/** `vt`: nombre de view transition; la tarjeta se desliza a su nuevo lugar al navegar (Explorar ⇄ Mapa). */
/** `nearby`: sugerido por cercanía (fuera de tu zona): lleva una insignia en vez de una sección aparte. */
export function EventCard({ e, live, hideDistance, vt, nearby, href }: { e: NearRow; live?: boolean; hideDistance?: boolean; vt?: string; nearby?: boolean; href?: string }) {
  const card = (
    <Link href={href ?? `/evento/${e.slug}`} scroll={!href} data-event-id={e.event_id} className="block px-5 py-3 lg:rounded-card lg:transition lg:hover:bg-bg-2/60">
      <div className="relative">
        <Flyer path={e.image_path} alt={e.title} sizes="(max-width: 640px) 100vw, 640px" className="aspect-[4/3] rounded-card" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          {live ? (
            <LiveBadge className="bg-white/95" />
          ) : (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink">
              {CATEGORY_LABEL[e.category] ?? "Evento"}
            </span>
          )}
          {nearby && (
            <span className="group/near relative" aria-label="Sugerencia en base a tu cercanía" title="Sugerencia en base a tu cercanía">
              <span className="flex items-center gap-1 rounded-full bg-ink/85 px-2 py-1 text-[11px] font-semibold text-white">
                <Navigation size={11} className="fill-white" /> Cerca
              </span>
              <span role="tooltip" className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-10 whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white opacity-0 shadow-float transition group-hover/near:opacity-100">
                Sugerencia en base a tu cercanía
              </span>
            </span>
          )}
        </div>
        <SaveButton eventId={e.event_id} variant="card" className="absolute right-3 top-3" />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug">{e.title}</h3>
          <p className="mt-1 text-[14px] text-ink-2">
            {live ? (e.ends_at ? `Ahora · termina ${fmtTime(e.ends_at)}` : "Ahora · todo el día") : fmtWhenShort(e.starts_at, e.is_all_day)}
          </p>
          <p className="truncate text-[14px] text-ink-2">
            {e.place_name ? `${e.place_name} · ` : ""}{e.municipality_name}{hideDistance ? "" : ` · ${fmtDistance(e.distance_m)}`}
          </p>
        </div>
        <PriceTag isFree={e.is_free} min={e.price_min} max={e.price_max} className="mt-0.5 shrink-0" />
      </div>
    </Link>
  );
  return vt ? <ViewTransition name={vt} share="slide-move" default="none">{card}</ViewTransition> : card;
}

/** Tarjeta del carrusel "Sucediendo ahora" */
export function LiveCard({ e }: { e: NearRow }) {
  return (
    <Link href={`/evento/${e.slug}`} className="w-[240px] shrink-0 snap-start">
      <div className="relative">
        <Flyer path={e.image_path} alt={e.title} sizes="240px" className="aspect-[4/3] rounded-card" />
        {e.ends_at && (
          <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white">
            Termina {fmtTime(e.ends_at)}
          </span>
        )}
      </div>
      <h3 className="mt-2 line-clamp-1 text-[15px] font-semibold">{e.title}</h3>
      <p className="truncate text-[13px] text-ink-2">
        {e.place_name ? `${e.place_name} · ` : ""}{e.municipality_name} · {fmtDistance(e.distance_m)}
      </p>
    </Link>
  );
}

/** Tarjeta compacta horizontal (mapa, "Más cerca de aquí") */
export function CompactCard({ e, active, href }: { e: NearRow; active?: boolean; href?: string }) {
  return (
    <Link
      href={href ?? `/evento/${e.slug}`}
      scroll={!href}
      className={`flex w-[300px] shrink-0 snap-center gap-3 rounded-card border bg-white p-3 shadow-soft ${active ? "border-ink" : "border-line"}`}
    >
      <Flyer path={e.image_path} alt={e.title} sizes="96px" className="h-[84px] w-[96px] shrink-0 rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-[15px] font-semibold">{e.title}</h3>
        <p className="mt-0.5 text-[13px] text-ink-2">{fmtWhenShort(e.starts_at, e.is_all_day)}</p>
        <p className="truncate text-[13px] text-ink-2">{e.municipality_name} · {fmtDistance(e.distance_m)}</p>
        <div className="mt-1"><PriceTag isFree={e.is_free} min={e.price_min} max={e.price_max} className="!text-[14px]" /></div>
      </div>
    </Link>
  );
}
