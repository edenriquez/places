"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

type Tab = "ahora" | "proximos";

/** Dos vistas apiladas, Ahora ⇄ Próximos: se cambia tocando la pestaña o deslizando de lado. */
export function HomeFeed({ liveCount, initial, now, upcoming }: { liveCount: number; initial: Tab; now: React.ReactNode; upcoming: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>(initial);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  function go(next: Tab) {
    if (next === tab) return;
    setDir(next === "proximos" ? "right" : "left");
    setTab(next);
    window.scrollTo({ top: Math.min(window.scrollY, 120), behavior: "smooth" });
  }

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
        go(dx < 0 ? "proximos" : "ahora");
      }}
    >
      <div className="sticky top-0 z-20 bg-white/95 px-5 pb-2 pt-4 backdrop-blur lg:top-[76px]">
        <div role="tablist" className="grid grid-cols-2 rounded-full bg-bg-2 p-1 text-[14px] font-semibold">
          <button role="tab" aria-selected={tab === "ahora"} type="button" onClick={() => go("ahora")} className={clsx("flex items-center justify-center gap-2 rounded-full py-2 transition", tab === "ahora" ? "bg-white shadow-soft" : "text-ink-2")}>
            <span className="relative inline-block h-2 w-2 rounded-full bg-live live-dot" />
            Ahora <span className="text-ink-2">{liveCount}</span>
          </button>
          <button role="tab" aria-selected={tab === "proximos"} type="button" onClick={() => go("proximos")} className={clsx("rounded-full py-2 transition", tab === "proximos" ? "bg-white shadow-soft" : "text-ink-2")}>
            Próximos
          </button>
        </div>
      </div>
      <div key={tab} className={clsx(dir === "right" && "feed-from-right", dir === "left" && "feed-from-left")}>
        {tab === "ahora" ? now : upcoming}
      </div>
    </div>
  );
}
