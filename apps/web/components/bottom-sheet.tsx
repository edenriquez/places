"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, X } from "lucide-react";
import clsx from "clsx";

type Snap = "mini" | "peek" | "full";
const HEIGHT: Record<Exclude<Snap, "mini">, string> = { peek: "56dvh", full: "92dvh" };

/**
 * Hoja inferior (móvil). Abre a media altura sobre el mapa; se arrastra desde la manija:
 * hacia arriba se expande, hacia abajo se contrae y, desde media altura, se minimiza.
 * Abierta bloquea el fondo; tocar fuera la minimiza a una barra con el título sobre la navegación.
 */
export function BottomSheet({ closeHref, label, children }: { closeHref: string; label: string; children: React.ReactNode }) {
  const [snap, setSnap] = useState<Snap>("peek");
  const [drag, setDrag] = useState(0);
  const [closing, setClosing] = useState(false);
  const start = useRef<number | null>(null);
  const router = useRouter();

  function close() {
    setClosing(true);
    setTimeout(() => router.push(closeHref, { scroll: false }), 180);
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { start.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); },
    onPointerMove: (e: React.PointerEvent) => { if (start.current != null) setDrag(e.clientY - start.current); },
    onPointerUp: () => {
      const d = drag;
      start.current = null;
      setDrag(0);
      if (d < -60) setSnap("full");
      else if (d > 80) setSnap(snap === "full" ? "peek" : "mini");
      else if (Math.abs(d) < 6) setSnap(snap === "full" ? "peek" : "full"); // toque en la manija: alterna
    },
  };

  if (snap === "mini") {
    return (
      <section
        role="dialog"
        aria-label={label}
        className="sheet-in fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[calc(640px-24px)] items-center gap-2 rounded-card bg-white py-2 pl-4 pr-2 shadow-float"
      >
        <button type="button" onClick={() => setSnap("peek")} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
          <ChevronUp size={18} className="shrink-0 text-ink-2" />
          <span className="truncate text-[15px] font-semibold">{label}</span>
        </button>
        <button type="button" onClick={close} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg-2">
          <X size={18} />
        </button>
      </section>
    );
  }

  return (
    <>
    {/* abierta: el fondo no responde; tocarlo minimiza la hoja */}
    <div aria-hidden onClick={() => setSnap("mini")} className={clsx("fixed inset-0 z-40 bg-black/25 transition-opacity duration-300", closing && "opacity-0")} />
    <section
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-screen-sm flex-col rounded-t-[20px] bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.18)]",
        drag === 0 && "transition-[height,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        closing ? "translate-y-full" : "sheet-in",
      )}
      style={{ height: `max(160px, calc(${HEIGHT[snap]} - ${drag}px))` }}
    >
      <div {...handlers} className="relative shrink-0 cursor-grab touch-none pb-2 pt-2.5 active:cursor-grabbing">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line-2" />
        <button type="button" onClick={close} onPointerDown={(e) => e.stopPropagation()} aria-label="Cerrar" className="absolute right-3 top-2 grid h-9 w-9 place-items-center rounded-full bg-bg-2">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
    </section>
    </>
  );
}
