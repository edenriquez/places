import Link from "next/link";
import clsx from "clsx";

const TABS = [
  { key: "general", href: "/admin/metricas", label: "General" },
  { key: "comportamiento", href: "/admin/metricas/comportamiento", label: "Comportamiento" },
] as const;

/** General (uso, cuentas, adquisición) ⇄ Comportamiento (qué buscan, dónde y si hay oferta). Conserva el rango. */
export function MetricsTabs({ active, range }: { active: (typeof TABS)[number]["key"]; range: string }) {
  return (
    <nav className="mt-4 flex gap-5 border-b border-line text-[14px]">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`${t.href}?r=${range}`}
          className={clsx("-mb-px border-b-2 pb-2 font-medium", active === t.key ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
