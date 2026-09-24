import Link from "next/link";
import clsx from "clsx";
import { Music, PartyPopper, Store, Palette, UtensilsCrossed, Sparkles, Mountain, Users } from "lucide-react";

export const CATEGORIES = [
  { key: "concierto", label: "Conciertos", icon: Music },
  { key: "feria", label: "Ferias", icon: PartyPopper },
  { key: "mercado", label: "Mercados", icon: Store },
  { key: "taller", label: "Talleres", icon: Palette },
  { key: "gastronomia", label: "Comida", icon: UtensilsCrossed },
  { key: "fiesta_patronal", label: "Fiestas", icon: Sparkles },
  { key: "deporte", label: "Al aire libre", icon: Mountain },
  { key: "infantil", label: "Familia", icon: Users },
] as const;

export function CategoryRow({ active, range, basePath = "/" }: { active?: string; range: string; basePath?: string }) {
  return (
    <div className="no-scrollbar mt-4 flex gap-6 overflow-x-auto px-5 lg:justify-between lg:gap-3">
      {CATEGORIES.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        const href = isActive ? `${basePath}?r=${range}` : `${basePath}?r=${range}&c=${key}`;
        return (
          <Link key={key} href={href} data-track="filter" data-label={`categoria:${key}`} className={clsx("flex shrink-0 flex-col items-center gap-1.5 pb-2 text-[12px] font-medium", isActive ? "border-b-2 border-ink text-ink" : "text-ink-2")}>
            <Icon size={22} strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
