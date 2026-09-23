"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import clsx from "clsx";

type Snap = "peek" | "full";
const HEIGHT: Record<Snap, string> = { peek: "56dvh", full: "92dvh" };

/**
 * Hoja inferior (móvil). Abre a media altura sobre el mapa; se arrastra desde la manija:
 * hacia arriba se expande, hacia abajo se contrae y, desde media altura, se cierra.
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
      else if (d > 80) {
        if (snap === "full") setSnap("peek");
        else close();
      }
      else if (Math.abs(d) < 6) setSnap(snap === "full" ? "peek" : "full"); // toque en la manija: alterna
    },
  };

  return (
    <section
      role="dialog"
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
  );
}
