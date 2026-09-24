"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Loader2, MoveRight, X } from "lucide-react";
import clsx from "clsx";
import { EXPLORE, radiusLabel } from "@/lib/location";

type Props = {
  /** radio vigente en km (EXPLORE = toda la región) */
  value: number;
  /** pasos de izquierda a derecha; el último suele ser EXPLORE */
  steps: number[];
  /** nombre del centro ("Tlalmanalco", "tu ubicación") para el texto de apoyo */
  place: string;
  /** mientras arrastra: el mapa dibuja el área y se acerca/aleja, sin buscar todavía */
  onPreview: (km: number) => void;
  /** al soltar (o tras una pausa con teclado): se guarda y se busca */
  onCommit: (km: number) => void;
  pending?: boolean;
  /** escritorio: arranca abierto; móvil: arranca como píldora */
  defaultOpen?: boolean;
  /** móvil: se cierra solo tras confirmar */
  closeOnCommit?: boolean;
};

const THUMB = 26; // px, igual que .el-range en globals.css

/** Deslizador de "qué tan lejos": a la derecha, más tiempo de camino y más kilómetros cubiertos. */
export function RadiusSlider({ value, steps, place, onPreview, onCommit, pending, defaultOpen, closeOnCommit }: Props) {
  const committedIdx = Math.max(0, steps.indexOf(value));
  const [idx, setIdx] = useState(committedIdx);
  const [open, setOpen] = useState(!!defaultOpen);
  const dragging = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const last = steps.length - 1;
  const km = steps[idx];
  const explore = km === EXPLORE;

  // si el radio cambia desde fuera (otra búsqueda), el deslizador lo sigue
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setIdx(committedIdx);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  // abierto: se colapsa cuando el foco o un clic salen del control (mapa, lista, Tab); arrastrando, no
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const t = (e as FocusEvent).relatedTarget ?? e.target;
      if (dragging.current || (t instanceof Node && rootRef.current?.contains(t))) return;
      if (e.type === "focusout" && !(e as FocusEvent).relatedTarget) return; // el foco se fue a la nada (clic en el mapa): lo resuelve pointerdown
      setOpen(false);
    };
    const root = rootRef.current;
    document.addEventListener("pointerdown", outside, true);
    root?.addEventListener("focusout", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      root?.removeEventListener("focusout", outside);
    };
  }, [open]);

  function commit(i: number) {
    clearTimeout(timer.current);
    if (i === committedIdx) return;
    onCommit(steps[i]);
    if (closeOnCommit) timer.current = setTimeout(() => setOpen(false), 700);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-full bg-white pl-3.5 pr-3 text-[14px] font-semibold shadow-float"
        aria-expanded={false}
      >
        {pending ? <Loader2 size={16} className="animate-spin text-ink-2" /> : <Clock size={16} className="text-ink-2" />}
        {value === EXPLORE ? "Toda la región" : `a ${radiusLabel(value)}`}
        {value !== EXPLORE && <span className="font-normal text-ink-2">· ≈{value} km</span>}
        <ChevronDown size={16} className="text-ink-2" />
      </button>
    );
  }

  const pct = last ? idx / last : 0;
  return (
    <div ref={rootRef} className="w-[min(360px,calc(100vw-32px))] rounded-[20px] bg-white p-4 shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink-2">¿Hasta dónde te mueves?</p>
          <p key={idx} className="anim-text-in text-[22px] font-bold leading-tight">{explore ? "Toda la región" : `a ${radiusLabel(km)}`}</p>
          <p className="truncate text-[13px] text-ink-2">
            {explore ? "Sin límite de distancia" : `≈ ${km} km a la redonda de ${place}`}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Contraer" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-2 hover:bg-line">
          <X size={16} />
        </button>
      </div>

      <div className="relative mt-3 h-7">
        {/* riel y parte recorrida (el pulgar nativo del range va encima) */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-bg-2" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent transition-[width] duration-150"
          style={{ width: `calc(${pct} * (100% - ${THUMB}px) + ${THUMB / 2}px)` }}
        />
        {steps.map((_, i) => (
          <span
            key={i}
            className={clsx("absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full", i <= idx ? "bg-white/80" : "bg-line-2")}
            style={{ left: `calc(${last ? i / last : 0} * (100% - ${THUMB}px) + ${THUMB / 2}px)` }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={idx}
          aria-label="Tiempo de camino"
          aria-valuetext={explore ? "Toda la región" : `${radiusLabel(km)}, unos ${km} kilómetros`}
          className="el-range absolute inset-0"
          onPointerDown={() => { dragging.current = true; }}
          onPointerUp={(e) => { dragging.current = false; commit(Number(e.currentTarget.value)); }}
          onChange={(e) => {
            const i = Number(e.target.value);
            setIdx(i);
            onPreview(steps[i]);
            // teclado o toque sin arrastre: se confirma tras una pausa
            if (!dragging.current) {
              clearTimeout(timer.current);
              timer.current = setTimeout(() => commit(i), 600);
            }
          }}
        />
      </div>

      {/* etiquetas bajo cada paso; tocar una salta ahí */}
      <div className="relative mt-1 h-4 text-[11px] font-medium">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { setIdx(i); onPreview(s); commit(i); }}
            className={clsx("absolute -translate-x-1/2 whitespace-nowrap transition-colors", i === idx ? "text-ink" : "text-ink-3 hover:text-ink-2")}
            style={{ left: `calc(${last ? i / last : 0} * (100% - ${THUMB}px) + ${THUMB / 2}px)` }}
          >
            {s === EXPLORE ? "Todo" : radiusLabel(s, true)}
          </button>
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3" aria-live="polite">
        {pending ? (
          <><Loader2 size={13} className="animate-spin" /> Buscando eventos…</>
        ) : (
          <>Desliza a la derecha: más tiempo, más kilómetros <MoveRight size={13} /></>
        )}
      </p>
    </div>
  );
}
