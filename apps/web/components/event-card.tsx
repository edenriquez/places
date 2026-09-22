import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { CATEGORY_LABEL, type NearRow } from "@/lib/types";
import { flyerUrl, fmtDistance, fmtTime, fmtWhenShort } from "@/lib/format";
import { PriceTag } from "./ui";

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
export function EventCard({ e }: { e: NearRow }) {
  return (
    <Link href={`/evento/${e.slug}`} className="block px-5 py-3">
      <div className="relative">
        <Flyer path={e.image_path} alt={e.title} sizes="(max-width: 640px) 100vw, 640px" className="aspect-[4/3] rounded-card" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink">
          {CATEGORY_LABEL[e.category] ?? "Evento"}
        </span>
        <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink">
          <Heart size={18} />
        </span>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug">{e.title}</h3>
          <p className="mt-1 text-[14px] text-ink-2">{fmtWhenShort(e.starts_at, e.is_all_day)}</p>
          <p className="truncate text-[14px] text-ink-2">
            {e.place_name ? `${e.place_name} · ` : ""}{e.municipality_name} · {fmtDistance(e.distance_m)}
          </p>
        </div>
        <PriceTag isFree={e.is_free} min={e.price_min} max={e.price_max} className="mt-0.5 shrink-0" />
      </div>
    </Link>
  );
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
export function CompactCard({ e, active }: { e: NearRow; active?: boolean }) {
  return (
    <Link
      href={`/evento/${e.slug}`}
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
