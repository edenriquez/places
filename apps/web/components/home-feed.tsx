"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Infinity as Always } from "lucide-react";

export type Tab = "ahora" | "proximos" | "dia";

/**
 * Vistas apiladas, Ahora ⇄ Próximos ⇄ Cualquier día: se cambia tocando la pestaña o deslizando de lado.
 * Sin `now` (nada en vivo) o sin `anyDay` (sin experiencias cerca) esa pestaña no aparece.
 * "Cualquier día" queda en la URL (?v=dia) para que al volver de una experiencia siga abierta.
 */
export function HomeFeed({ liveCount, initial, now, upcoming, anyDay }: {
  liveCount: number;
  initial: Tab;
  now?: React.ReactNode;
  upcoming: React.ReactNode;
  anyDay?: React.ReactNode;
}) {
  const tabs = (["ahora", "proximos", "dia"] as const).filter((t) => (t === "ahora" ? !!now : t === "dia" ? !!anyDay : true));
  const [picked, setTab] = useState<Tab>(initial);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // un filtro puede dejar vacía la pestaña elegida (nada en vivo de música): se cae a Próximos
  const tab = tabs.includes(picked) ? picked : "proximos";

  function go(next: Tab) {
    if (next === tab || !tabs.includes(next)) return;
    setDir(tabs.indexOf(next) > tabs.indexOf(tab) ? "right" : "left");
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "dia") url.searchParams.set("v", "dia");
    else url.searchParams.delete("v");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: Math.min(window.scrollY, 120), behavior: "smooth" });
  }

  const btn = (t: Tab) => clsx("flex items-center justify-center gap-1 rounded-full py-2 transition", tab === t ? "bg-white shadow-soft" : "text-ink-2");

  return (
    <div
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        // no robar el gesto a carruseles horizontales (chips, categorías)
        if ((e.target as HTMLElement).closest(".overflow-x-auto")) return;
        const next = tabs[tabs.indexOf(tab) + (dx < 0 ? 1 : -1)];
        if (next) go(next);
      }}
    >
      <div className="sticky top-0 z-20 bg-white/95 px-5 pb-2 pt-4 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
        <div role="tablist" className={clsx("grid rounded-full bg-bg-2 p-1 text-[14px] font-semibold", tabs.length === 3 ? "grid-cols-[1fr_1fr_1.4fr]" : "grid-cols-2")}>
          {now && (
            <button role="tab" aria-selected={tab === "ahora"} type="button" onClick={() => go("ahora")} className={btn("ahora")}>
              <span className="relative inline-block h-2 w-2 rounded-full bg-live live-dot" />
              Ahora <span className="text-ink-2">{liveCount}</span>
            </button>
          )}
          <button role="tab" aria-selected={tab === "proximos"} type="button" onClick={() => go("proximos")} className={btn("proximos")}>
            Próximos
          </button>
          {anyDay && (
            <button role="tab" aria-selected={tab === "dia"} type="button" onClick={() => go("dia")} data-track="filter" data-label="vista:cualquier-dia" className={btn("dia")}>
              <Always size={15} strokeWidth={2.4} aria-hidden className={tab === "dia" ? "text-[#17734a]" : undefined} />
              <span className="whitespace-nowrap">Cualquier día</span>
            </button>
          )}
        </div>
      </div>
      <div key={tab} className={clsx(dir === "right" && "feed-from-right", dir === "left" && "feed-from-left")}>
        {tab === "ahora" ? now : tab === "dia" ? anyDay : upcoming}
      </div>
    </div>
  );
}
