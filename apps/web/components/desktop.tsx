"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Heart, Map, User } from "lucide-react";
import clsx from "clsx";

const LG = "(min-width: 1024px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(LG);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** true solo en escritorio; en el servidor y en móvil, false (así el mapa del split no se monta en teléfonos). */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(LG).matches, () => false);
}

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  return useIsDesktop() ? <>{children}</> : null;
}

/** Lo contrario: evita montar el mapa de pantalla completa de móvil en escritorio. */
export function MobileOnly({ children }: { children: React.ReactNode }) {
  return useIsDesktop() ? null : <>{children}</>;
}

const NAV = [
  { href: "/", label: "Explorar", icon: Compass },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/guardados", label: "Guardados", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function DesktopHeader({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // Explorar ⇄ Mapa conserva rango y categoría: son la misma lista, una con mapa y otra sin él
  const params = new URLSearchParams(useSearchParams().toString());
  params.delete("e");
  const qs = params.toString();
  const keep = (href: string) => (qs && (href === "/" || href === "/mapa") ? `${href}?${qs}` : href);
  return (
    <header className="sticky top-0 z-40 hidden h-[76px] items-center gap-6 border-b border-line bg-white/95 px-8 backdrop-blur lg:flex">
      <Link href="/" className="shrink-0 font-[family-name:var(--font-jakarta)] text-[20px] font-extrabold tracking-tight text-accent">entrelugares</Link>
      <div className="mx-auto w-full max-w-[560px]">{children}</div>
      <nav className="flex shrink-0 items-center gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={keep(href)} className={clsx("flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium hover:bg-bg-2", active ? "text-ink" : "text-ink-2")}>
              <Icon size={18} strokeWidth={active ? 2.4 : 1.8} /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
