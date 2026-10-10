import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { Flyer } from "@/components/event-card";
import { fmtWhenShort } from "@/lib/format";
import { spotsLeft, targetHref, whoGoes, type GroupPlan } from "@/lib/group-plans";
import { Avatars } from "./avatars";
import { JoinButton } from "./join-button";

/** Tarjeta del carrusel del mapa en modo "Planes": a qué van, cuándo, quién lo armó y sumarse. */
export function PlanMapCard({ p, active, href, eager }: { p: GroupPlan; active?: boolean; href?: string; eager?: boolean }) {
  const t = p.target;
  const left = spotsLeft(p);
  return (
    <article className={`w-[300px] shrink-0 rounded-card border bg-white p-3 shadow-soft ${active ? "border-ink" : "border-line"}`}>
      <Link href={href ?? targetHref(t)} scroll={!href} className="flex gap-3">
        <Flyer path={t.image_path} focus={{ x: t.image_focus_x, y: t.image_focus_y }} alt={t.title} sizes="72px" className="h-[64px] w-[72px] shrink-0 rounded-[12px]" eager={eager} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-accent">{fmtWhenShort(p.starts_at, p.is_all_day)}</p>
          <h3 className="line-clamp-1 text-[15px] font-semibold">{t.title}</h3>
          <p className="flex items-center gap-1 truncate text-[12px] text-ink-2">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{p.meeting_point ? `Se ven en ${p.meeting_point}` : `${t.place_name ? `${t.place_name} · ` : ""}${t.municipality_name}`}</span>
          </p>
        </div>
      </Link>
      <div className="mt-2.5 flex items-center gap-2">
        <Avatars people={p.people} total={p.going} size={24} max={3} />
        <span className="min-w-0 flex-1 text-[12px] leading-tight text-ink-2">
          {p.host ? whoGoes(p) : `${p.going} ${p.going === 1 ? "persona va" : "personas van"}`}
          {!p.role && left <= 3 ? ` · ${left === 1 ? "1 lugar" : `${left} lugares`}` : ""}
        </span>
        {p.role ? (
          <Link href={p.code ? `/plan/${p.code}` : targetHref(t)} className="flex shrink-0 items-center gap-1 rounded-full bg-bg-2 px-3 py-1.5 text-[13px] font-semibold">
            <Check size={14} /> {p.role === "host" ? "Tu plan" : "Ya vas"}
          </Link>
        ) : (
          <JoinButton planId={p.id} eventId={t.kind === "event" ? t.id : undefined} label="Me apunto" className="shrink-0 !px-3 !py-1.5 text-[13px]" />
        )}
      </div>
    </article>
  );
}
