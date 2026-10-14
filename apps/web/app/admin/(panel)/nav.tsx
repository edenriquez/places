"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, BarChart3, CalendarDays, ChevronDown, ClipboardCheck, Compass, Upload, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

const ITEMS: Item[] = [
  { href: "/admin/metricas", label: "Métricas", icon: BarChart3 },
  { href: "/admin/events", label: "Eventos", icon: CalendarDays },
  { href: "/admin/experiencias", label: "Experiencias", icon: Compass },
];
const REVIEW: Item = { href: "/admin/review", label: "Revisión", icon: ClipboardCheck };
// la captura (subir flyers y ver las tareas de la Mac) vive plegada dentro de Revisión
const REVIEW_SUB: Item[] = [
  { href: "/admin/upload", label: "Subir", icon: Upload },
  { href: "/admin/jobs", label: "Tareas", icon: Activity },
];

export function AdminNav({ pending, inline }: { pending: number; inline?: boolean }) {
  const path = usePathname();
  const inSub = REVIEW_SUB.some((i) => path.startsWith(i.href));
  // abierto si estás en Subir o Tareas, hasta que lo pliegues a mano
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? inSub;
  const badge = pending > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{pending}</span>;

  // en el encabezado del teléfono solo caben íconos: todo en una fila, en el mismo orden
  if (inline) {
    return (
      <nav className="flex gap-1">
        {[...ITEMS, REVIEW, ...REVIEW_SUB].map((i) => <NavLink key={i.href} item={i} path={path} inline extra={i === REVIEW && badge} />)}
      </nav>
    );
  }

  return (
    <nav className="mt-6 flex flex-col gap-1">
      {ITEMS.map((i) => <NavLink key={i.href} item={i} path={path} />)}
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1"><NavLink item={REVIEW} path={path} extra={badge} /></div>
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-controls="admin-nav-review"
          aria-label={expanded ? "Ocultar Subir y Tareas" : "Mostrar Subir y Tareas"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-bg-2 hover:text-ink"
        >
          <ChevronDown size={16} aria-hidden className={clsx("transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && (
        <div id="admin-nav-review" className="ml-5 flex flex-col gap-1 border-l border-line pl-2">
          {REVIEW_SUB.map((i) => <NavLink key={i.href} item={i} path={path} />)}
        </div>
      )}
    </nav>
  );
}

function NavLink({ item: { href, label, icon: Icon }, path, inline, extra }: { item: Item; path: string; inline?: boolean; extra?: React.ReactNode }) {
  const active = path.startsWith(href);
  return (
    <Link
      href={href}
      aria-label={inline ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex items-center gap-3 rounded-control px-3 py-2 text-[14px] font-medium",
        active ? "bg-accent-soft text-accent" : "text-ink hover:bg-bg-2",
      )}
    >
      <Icon size={18} aria-hidden />
      {!inline && <span className="flex-1">{label}</span>}
      {extra}
    </Link>
  );
}
