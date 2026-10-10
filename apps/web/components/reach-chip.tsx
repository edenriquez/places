"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import clsx from "clsx";
import { EXPLORE, radiusLabel } from "@/lib/location";

type Props = {
  /** alcance vigente en km (EXPLORE = toda la región); lo decide el zoom del mapa */
  km: number;
  steps: number[];
  /** "tu ubicación" o el nombre del pueblo */
  place: string;
  /** cuántos eventos o planes quedan dentro, y de qué */
  count: number;
  noun: [string, string];
  /** tocar un paso: el mapa se acerca o aleja hasta ahí */
  onPick: (km: number) => void;
};

/**
 * Mapa móvil: hasta dónde se está viendo. Es una píldora; cuando el zoom cruza a otro paso se despliega un
 * momento ("Ahora estás a 1 h de tu ubicación") y vuelve a cerrarse. Tocarla la abre con los pasos para saltar.
 */
export function ReachChip({ km, steps, place, count, noun, onPick }: Props) {
  const [open, setOpen] = useState<null | "auto" | "user">(null);
  const [animate, setAnimate] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const [seen, setSeen] = useState(km);
  if (seen !== km) {
    setSeen(km);
    if (open !== "user") setOpen("auto");
    setAnimate(true);
  }

  useEffect(() => {
    if (open !== "auto") return;
    const t = setTimeout(() => setOpen(null), 2600);
    return () => clearTimeout(t);
  }, [open, km]);

  useEffect(() => {
    if (open !== "user") return;
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node && rootRef.current?.contains(e.target))) setOpen(null);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);

  const all = km === EXPLORE;
  const what = `${count} ${count === 1 ? noun[0] : noun[1]}`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen("user"); setAnimate(true); }}
        aria-expanded={false}
        className={clsx("flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-white pl-3 pr-3.5 text-[13px] font-semibold shadow-float", animate && "reach-close")}
      >
        <Clock size={15} className="text-ink-2" />
        {all ? "Toda la región" : `a ${radiusLabel(km, true)}`}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="reach-open w-[min(340px,calc(100vw-32px))] rounded-[20px] bg-white p-4 shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" role="status" aria-live="polite">
          <p className="text-[12px] font-medium text-ink-2">¿Hasta dónde te mueves?</p>
          <p key={km} className="anim-text-in text-[22px] font-bold leading-tight">{all ? "Ahora ves toda la región" : `Ahora estás a ${radiusLabel(km)}`}</p>
          <p className="truncate text-[13px] text-ink-2">{all ? `Sin límite de distancia · ${what}` : `de ${place} · ≈ ${km} km · ${what}`}</p>
        </div>
        {open === "user" && (
          <button type="button" onClick={() => setOpen(null)} aria-label="Cerrar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-2">
            <X size={16} />
          </button>
        )}
      </div>
      {open === "user" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((s) => (
            <button key={s} type="button" onClick={() => onPick(s)} aria-pressed={s === km}
              className={clsx("rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors", s === km ? "bg-ink text-white" : "bg-bg-2 text-ink")}>
              {s === EXPLORE ? "Todo" : radiusLabel(s, true)}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-ink-3">Acerca o aleja el mapa para cambiarlo</p>
      )}
    </div>
  );
}
