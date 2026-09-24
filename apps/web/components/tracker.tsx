"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { TrackType } from "@/lib/analytics";
import { track } from "@/lib/track";

/**
 * Vistas en cada cambio de ruta y clics en cualquier elemento con data-track (los CTAs pueden seguir
 * siendo server components: basta con `data-track="maps" data-event={id}`).
 */
export function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const key = `${pathname}?${search}`;
    if (last.current === key) return; // StrictMode monta dos veces en dev
    last.current = key;
    track("pageview");
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const { track: type, event, label } = el.dataset;
      track(type as TrackType, { event, props: label ? { label } : undefined });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
