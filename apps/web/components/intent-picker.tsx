import Link from "next/link";
import clsx from "clsx";
import { Mountain, Music, Palette, PartyPopper, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { INTENTS, type IntentKey } from "@/lib/intents";
import { LinkPending } from "./link-pending";

const ICON: Record<IntentKey, LucideIcon> = {
  musica: Music, fiesta: PartyPopper, comida: UtensilsCrossed, naturaleza: Mountain, familia: Users, cultura: Palette,
};
const TINT: Record<IntentKey, string> = {
  musica: "bg-[#fff0f3] text-[#e0234e]", fiesta: "bg-[#fff4e5] text-[#d9730d]", comida: "bg-[#fdf0ea] text-[#c2410c]",
  naturaleza: "bg-[#eaf6ec] text-[#15803d]", familia: "bg-[#eaf3fd] text-[#2563eb]", cultura: "bg-[#f3eefc] text-[#7c3aed]",
};

/** La pregunta principal de la portada: se elige un plan, no una categoría. Volver a tocar la activa la quita. */
export function IntentPicker({ active, range, basePath = "/", compact }: { active?: string; range: string; basePath?: string; compact?: boolean }) {
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
          const on = active === it.key;
          const href = on ? `${basePath}?r=${range}` : `${basePath}?r=${range}&i=${it.key}`;
          return (
            <Link
              key={it.key}
              href={href}
              scroll={false}
              data-track="filter"
              data-label={`intencion:${it.key}`}
              aria-current={on ? "true" : undefined}
              className={clsx(
                "relative isolate flex flex-col items-start gap-2 rounded-card border p-3 transition",
                on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink-3",
              )}
            >
              <span className={clsx("grid h-9 w-9 place-items-center rounded-full", on ? "bg-white/15 text-white" : TINT[it.key])}>
                <Icon size={19} strokeWidth={2} />
              </span>
              <span className="text-[14px] font-semibold leading-none">{it.label}</span>
              <span className={clsx("hidden text-[12px] leading-snug lg:block", on ? "text-white/70" : "text-ink-2")}>{it.hint}</span>
              <LinkPending className="-inset-px -z-10 rounded-card bg-bg-2 ring-2 ring-ink" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
