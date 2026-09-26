"use client";

import { useEffect, useRef } from "react";
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

const SNAP_MS = 120; // sin scroll durante este tiempo -> la barra termina de esconderse o de salir

/**
 * La barra acompaña al scroll: baja los mismos píxeles que se desplaza la página y sube igual.
 * Al detenerse el scroll, remata hacia el estado más cercano (visible u oculta).
 * Solo scroll de la ventana; se escribe el transform directo en el nodo para no re-renderizar por frame.
 */
function useFollowScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastY = window.scrollY;
    let offset = 0;            // px que la barra lleva fuera de pantalla (0 = visible, alto = oculta)
    let raf: number | null = null;
    let snap: ReturnType<typeof setTimeout> | null = null;

    const apply = (px: number, animate: boolean) => {
      el.style.transition = animate ? "transform 160ms ease-out" : "none";
      el.style.transform = px ? `translateY(${px}px)` : "";
    };

    const onScroll = () => {
      if (snap) { clearTimeout(snap); snap = null; }
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const h = el.offsetHeight;
        const delta = y - lastY;
        // rebote de iOS arriba/abajo: la barra no se mueve
        if (y >= 0 && y <= max) {
          offset = Math.min(h, Math.max(0, offset + delta));
          if (y === 0) offset = 0;
          apply(offset, false);
        }
        lastY = Math.min(Math.max(y, 0), Math.max(max, 0));
        snap = setTimeout(() => {
          if (offset > 0 && offset < h) {
            offset = offset > h / 2 ? h : 0;
            apply(offset, true);
          }
        }, SNAP_MS);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
      if (snap) clearTimeout(snap);
    };
  }, []);

  return ref;
}

export function BottomNav() {
  const path = usePathname();
  // key por ruta: al navegar la barra vuelve a mostrarse y el estado de scroll se reinicia
  return <Nav key={path} path={path} />;
}

function Nav({ path }: { path: string }) {
  const ref = useFollowScroll<HTMLElement>();
  return (
    <nav
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-40 border-t lg:hidden border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 will-change-transform"
    >
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
