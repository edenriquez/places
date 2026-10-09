"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Mountain, Music, Palette, PartyPopper, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { INTENTS, intentByKey, type IntentKey } from "@/lib/intents";

const ICON: Record<IntentKey, LucideIcon> = {
  musica: Music, fiesta: PartyPopper, comida: UtensilsCrossed, naturaleza: Mountain, familia: Users, cultura: Palette,
};
const TINT: Record<IntentKey, string> = {
  musica: "bg-[#fff0f3] text-[#e0234e]", fiesta: "bg-[#fff4e5] text-[#d9730d]", comida: "bg-[#fdf0ea] text-[#c2410c]",
  naturaleza: "bg-[#eaf6ec] text-[#15803d]", familia: "bg-[#eaf3fd] text-[#2563eb]", cultura: "bg-[#f3eefc] text-[#7c3aed]",
};

/** Categorías del catálogo que cumplen el filtro; undefined = todas. */
export const catsOf = (intent?: string, category?: string): readonly string[] | undefined =>
  intentByKey(intent)?.cats ?? (category ? [category] : undefined);

/** ?i= es una intención ("música" = conciertos + danza); ?c= una sola categoría (enlaces viejos y el mapa). */
export function useCategoryFilter() {
  const q = useSearchParams();
  const intent = intentByKey(q.get("i") ?? undefined)?.key;
  const category = intent ? undefined : (q.get("c") ?? undefined);
  return { intent, category, cats: catsOf(intent, category) };
}

/**
 * La pregunta principal de la portada: se elige un plan, no una categoría. Volver a tocar la activa la quita.
 * La lista ya está en la página: el toque solo cambia la URL (pushState) y se filtra al instante, sin ir al servidor.
 */
export function IntentPicker({ compact }: { compact?: boolean }) {
  const path = usePathname();
  const q = useSearchParams();
  const { intent } = useCategoryFilter();
  const hrefFor = (key: string) => {
    const next = new URLSearchParams(q);
    next.delete("c");
    if (key === intent) next.delete("i");
    else next.set("i", key);
    const s = next.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <section className="px-5 pt-5">
      {!compact && (
        <>
          <h2 className="text-[22px] font-bold leading-tight">¿Qué quieres hacer este fin?</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">Elige y te mostramos lo que hay cerca de ti</p>
        </>
      )}
      <div className={clsx("mt-3 grid grid-cols-3 gap-2 lg:grid-cols-6", compact && "mt-0")}>
        {INTENTS.map((it) => {
          const Icon = ICON[it.key];
          const on = intent === it.key;
          const href = hrefFor(it.key);
          return (
            <Link
              key={it.key}
              href={href}
              prefetch={false}
              scroll={false}
              onNavigate={(e) => {
                e.preventDefault();
                window.history.pushState(null, "", href);
              }}
              data-track="filter"
              data-label={`intencion:${it.key}`}
              aria-current={on ? "true" : undefined}
              className={clsx(
                "flex touch-manipulation flex-col items-start gap-2 rounded-card border p-3 transition-colors duration-150",
                on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink-3",
              )}
            >
              <span className={clsx("grid h-9 w-9 place-items-center rounded-full", on ? "bg-white/15 text-white" : TINT[it.key])}>
                <Icon size={19} strokeWidth={2} />
              </span>
              <span className="text-[14px] font-semibold leading-none">{it.label}</span>
              <span className={clsx("hidden text-[12px] leading-snug lg:block", on ? "text-white/70" : "text-ink-2")}>{it.hint}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
