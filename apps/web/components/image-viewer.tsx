"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Minus, Plus, X } from "lucide-react";

const MIN = 1;
const MAX = 4;

type Props = { src: string; alt: string; children: React.ReactNode; className?: string };

/** Envuelve una imagen: al tocarla abre el visor a tamaño completo con zoom y arrastre. */
export function ZoomableImage({ src, alt, children, className, eventId }: Props & { eventId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ver imagen completa" data-track={eventId ? "flyer_zoom" : undefined} data-event={eventId} className={className ?? "block h-full w-full cursor-zoom-in"}>
        {children}
      </button>
      {open && <ImageViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  const startY = useRef<number | null>(null);

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);
  const zoomTo = useCallback((next: number) => {
    const s = Math.min(MAX, Math.max(MIN, next));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomTo(scale * 1.5);
      if (e.key === "-") zoomTo(scale / 1.5);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, scale, zoomTo]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    if (scale > 1) {
      drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      setDragging(true);
    } else startY.current = e.clientY;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (drag.current) {
      setPos({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    // deslizar hacia abajo sin zoom cierra
    if (!drag.current && startY.current != null && e.clientY - startY.current > 110) onClose();
    drag.current = null;
    startY.current = null;
    setDragging(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomTo(pinch.current.scale * (d / pinch.current.dist));
    }
  }
  function onTouchEnd() { pinch.current = null; }

  function onImageClick(e: React.MouseEvent) {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTap.current < 320) {
      if (scale > 1) reset();
      else zoomTo(2.5);
    }
    lastTap.current = now;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 text-white"
      onClick={onClose}
      onWheel={onWheel}
      style={{ touchAction: "none" }}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),12px)]" onClick={(e) => e.stopPropagation()}>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium">{Math.round(scale * 100)}%</span>
        <div className="flex gap-2">
          <button type="button" aria-label="Alejar" onClick={() => zoomTo(scale / 1.5)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Minus size={18} /></button>
          <button type="button" aria-label="Acercar" onClick={() => zoomTo(scale * 1.5)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Plus size={18} /></button>
          <a href={src} download target="_blank" rel="noreferrer" aria-label="Descargar" className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Download size={18} /></a>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink"><X size={18} /></button>
        </div>
      </div>

      {!loaded && <div className="absolute text-[13px] text-white/70">Cargando imagen…</div>}
      {/* eslint-disable-next-line @next/next/no-img-element -- tamaño real, sin optimizar */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onClick={onImageClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="max-h-[100dvh] max-w-[100vw] select-none object-contain"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transition: dragging ? "none" : "transform 120ms ease-out",
          cursor: scale > 1 ? "grab" : "zoom-in",
          opacity: loaded ? 1 : 0,
        }}
      />
      <p className="pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),12px)] text-[12px] text-white/60">
        Doble toque para acercar · desliza hacia abajo para cerrar
      </p>
    </div>
  );
}
