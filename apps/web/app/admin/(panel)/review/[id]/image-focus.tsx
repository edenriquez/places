"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Heart } from "lucide-react";
import clsx from "clsx";
import { focusStyle } from "@/lib/format";

export type Focus = { x: number; y: number };

const CARD = 4 / 3;
const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Qué parte del flyer queda a la vista en una caja `box` (ancho/alto) con object-cover y object-position
 * x% y%: el sobrante se reparte según el porcentaje. Devuelve el rectángulo visible en % del flyer.
 */
function visibleRect(ratio: number, box: number, f: Focus) {
  if (ratio < box) {
    const h = (ratio / box) * 100;
    return { left: 0, width: 100, top: ((100 - h) * f.y) / 100, height: h };
  }
  const w = (box / ratio) * 100;
  return { top: 0, height: 100, left: ((100 - w) * f.x) / 100, width: w };
}

/** El object-position que deja el recuadro visible centrado en (cx, cy), sin salirse del flyer. */
function focusAt(ratio: number, box: number, cx: number, cy: number, prev: Focus): Focus {
  if (ratio < box) {
    const h = (ratio / box) * 100;
    return { x: prev.x, y: h >= 100 ? 50 : clamp(((cy - h / 2) / (100 - h)) * 100) };
  }
  const w = (box / ratio) * 100;
  return { x: w >= 100 ? 50 : clamp(((cx - w / 2) / (100 - w)) * 100), y: prev.y };
}

/** Toca o arrastra sobre el flyer para elegir qué parte se ve en las tarjetas; las flechas lo mueven de 5 en 5. */
function Picker({ src, value, onChange, ratio, onRatio }: { src: string; value: Focus; onChange: (f: Focus) => void; ratio: number | null; onRatio: (r: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const at = (e: React.PointerEvent) => {
    if (!ratio) return;
    const r = ref.current!.getBoundingClientRect();
    onChange(focusAt(ratio, CARD, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100, value));
  };
  const rect = ratio ? visibleRect(ratio, CARD, value) : null;
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Punto de enfoque del flyer"
      aria-valuetext={`${value.x}% horizontal, ${value.y}% vertical`}
      aria-valuenow={value.y}
      onPointerDown={(e) => {
        at(e);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      }}
      onPointerMove={(e) => { if (e.buttons) at(e); }}
      onKeyDown={(e) => {
        const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
        if (!d) return;
        e.preventDefault();
        onChange({ x: clamp(value.x + d[0]), y: clamp(value.y + d[1]) });
      }}
      className="relative mx-auto w-fit cursor-crosshair touch-none select-none overflow-hidden rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- se necesita el tamaño natural para medir el recorte */}
      <img src={src} alt="" draggable={false} onLoad={(e) => onRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} className="block max-h-[340px] w-auto max-w-full" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-[6px] border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
        />
      )}
    </div>
  );
}

function Crop({ src, focus, className, sizes }: { src: string; focus: Focus; className: string; sizes: string }) {
  return (
    <div className={clsx("relative overflow-hidden bg-bg-2", className)}>
      <Image src={src} alt="" fill sizes={sizes} className="object-cover" style={focusStyle(focus.x, focus.y)} />
    </div>
  );
}

/**
 * Ajuste del recorte del flyer con vista previa: la tarjeta de la lista (4:3), el encabezado del evento en
 * el celular (4:3, sin esquinas) y la miniatura del mapa (96×84). En el detalle de escritorio el flyer se ve
 * completo, así que no cambia.
 */
export function ImageFocus({ src, value, onChange, title, when, place, category, price }: {
  src: string; value: Focus; onChange: (f: Focus) => void;
  title: string; when: string; place: string; category: string; price: string;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  const fits = ratio != null && Math.abs(ratio - CARD) < 0.02;
  const vertical = ratio == null || ratio < CARD;
  const presets: { label: string; f: Focus }[] = vertical
    ? [{ label: "Arriba", f: { x: 50, y: 0 } }, { label: "Centro", f: { x: 50, y: 50 } }, { label: "Abajo", f: { x: 50, y: 100 } }]
    : [{ label: "Izquierda", f: { x: 0, y: 50 } }, { label: "Centro", f: { x: 50, y: 50 } }, { label: "Derecha", f: { x: 100, y: 50 } }];

  return (
    <section className="mt-5 rounded-card border border-line p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold">Recorte en el sitio</h2>
        <span className="text-[12px] tabular-nums text-ink-3">{value.x}% · {value.y}%</span>
      </div>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {fits ? "El flyer ya es 4:3: se ve completo en las tarjetas." : "Toca o arrastra sobre el flyer para elegir qué parte se ve. Lo de fuera del recuadro se corta en las tarjetas."}
      </p>

      <div className="mt-3"><Picker src={src} value={value} onChange={onChange} ratio={ratio} onRatio={setRatio} /></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.f)}
            className={clsx("rounded-full border px-3 py-1.5 text-[13px] font-medium", value.x === p.f.x && value.y === p.f.y ? "border-ink bg-ink text-white" : "border-line-2")}>
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-2">Así se verá</p>
      <div className="mt-2 space-y-5">
        <figure>
          <figcaption className="mb-1.5 text-[12px] text-ink-3">Tarjeta en Explorar</figcaption>
          <div className="w-[300px]">
            <div className="relative">
              <Crop src={src} focus={value} sizes="300px" className="aspect-[4/3] rounded-card" />
              <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold">{category}</span>
              <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90"><Heart size={16} /></span>
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-[16px] font-semibold leading-snug">{title || "Título del evento"}</p>
                <p className="mt-1 text-[14px] text-ink-2">{when}</p>
                <p className="truncate text-[14px] text-ink-2">{place}</p>
              </div>
              {price && <span className="mt-0.5 shrink-0 text-[15px] font-semibold">{price}</span>}
            </div>
          </div>
        </figure>
        <div className="flex flex-wrap items-start gap-6">
          <figure>
            <figcaption className="mb-1.5 text-[12px] text-ink-3">Evento en el celular</figcaption>
            <Crop src={src} focus={value} sizes="220px" className="aspect-[4/3] w-[220px]" />
          </figure>
          <figure>
            <figcaption className="mb-1.5 text-[12px] text-ink-3">Miniatura (mapa)</figcaption>
            <div className="flex w-[220px] gap-3 rounded-card border border-line bg-white p-3 shadow-soft">
              <Crop src={src} focus={value} sizes="96px" className="h-[84px] w-[96px] shrink-0 rounded-[12px]" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{title || "Título"}</p>
                <p className="mt-0.5 truncate text-[12px] text-ink-2">{when}</p>
              </div>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
