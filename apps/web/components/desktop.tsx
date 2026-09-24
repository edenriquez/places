"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Heart, Map, User } from "lucide-react";
import clsx from "clsx";
import { useSession } from "./auth/session-provider";

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
  const { user, ready, openLogin } = useSession();
  const avatar: string | undefined = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  // Explorar ⇄ Mapa conserva rango y categoría: son la misma lista, una con mapa y otra sin él
  const params = new URLSearchParams(useSearchParams().toString());
  params.delete("e");
  const qs = params.toString();
  const keep = (href: string) => (qs && (href === "/" || href === "/mapa") ? `${href}?${qs}` : href);
  return (
    <header className="sticky top-0 z-40 hidden h-[76px] grid-cols-[minmax(max-content,1fr)_minmax(0,560px)_minmax(max-content,1fr)] items-center gap-6 border-b border-line bg-white/95 px-8 backdrop-blur lg:grid">
      <Link href="/" className="justify-self-start font-[family-name:var(--font-jakarta)] text-[20px] font-extrabold tracking-tight text-accent">entrelugares</Link>
      <div className="w-full">{children}</div>
      <nav className="flex items-center gap-1 justify-self-end">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={keep(href)} className={clsx("flex items-center gap-2 rounded-full px-3 py-2 text-[14px] font-medium hover:bg-bg-2", active ? "text-ink" : "text-ink-2")}>
              {href === "/perfil" && avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar externo de Google
                <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-[22px] w-[22px] rounded-full object-cover" />
              ) : (
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
              )}
              {label}
            </Link>
          );
        })}
        {ready && !user && (
          <button type="button" onClick={() => openLogin()} className="ml-2 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white hover:bg-ink/90">
            Entrar
          </button>
        )}
      </nav>
    </header>
  );
}
