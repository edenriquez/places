"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Map, User } from "lucide-react";
import clsx from "clsx";

const ITEMS = [
  { href: "/", label: "Explorar", icon: Compass },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/guardados", label: "Guardados", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={clsx("flex flex-col items-center gap-1 py-1 text-[11px] font-medium", active ? "text-accent" : "text-ink-2")}>
                <Icon size={24} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
