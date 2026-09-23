"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, CalendarDays, ClipboardCheck, Rss, Upload } from "lucide-react";

const ITEMS = [
  { href: "/admin/upload", label: "Subir", icon: Upload },
  { href: "/admin/review", label: "Revisión", icon: ClipboardCheck },
  { href: "/admin/sources", label: "Fuentes", icon: Rss },
  { href: "/admin/events", label: "Eventos", icon: CalendarDays },
  { href: "/admin/jobs", label: "Tareas", icon: Activity },
];

export function AdminNav({ pending, inline }: { pending: number; inline?: boolean }) {
  const path = usePathname();
  return (
    <nav className={clsx(inline ? "flex gap-1" : "mt-6 flex flex-col gap-1")}>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-control px-3 py-2 text-[14px] font-medium",
              active ? "bg-accent-soft text-accent" : "text-ink hover:bg-bg-2",
            )}
          >
            <Icon size={18} />
            {!inline && <span className="flex-1">{label}</span>}
            {href === "/admin/review" && pending > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
