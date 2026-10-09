"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from "lucide-react";

const MIN = 1;
const MAX = 4;

type Props = { src: string; alt: string; children: React.ReactNode; className?: string };

/**
 * Envuelve una imagen: al tocarla abre el visor a tamaño completo con zoom y arrastre.
 * Con `gallery` el visor pasa entre todas las fotos; `onClosed` recibe en cuál se quedó.
 */
export function ZoomableImage({ src, alt, children, className, eventId, gallery, onClosed }: Props & {
  eventId?: string; gallery?: string[]; onClosed?: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ver imagen completa" data-track={eventId ? "flyer_zoom" : undefined} data-event={eventId} className={className ?? "block h-full w-full cursor-zoom-in"}>
        {children}
      </button>
      {open && <ImageViewer src={src} alt={alt} gallery={gallery} onClose={(i) => { setOpen(false); onClosed?.(i); }} />}
    </>
  );
}

export function ImageViewer({ src, alt, gallery, onClose }: { src: string; alt: string; gallery?: string[]; onClose: (index: number) => void }) {
  const images = gallery?.length ? gallery : [src];
  const [index, setIndex] = useState(() => Math.max(0, images.indexOf(src)));
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const pinched = useRef(false);
  const lastTap = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = images.length;
  const current = images[index];
  const close = useCallback(() => onClose(index), [onClose, index]);

  const reset = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }); }, []);
  const zoomTo = useCallback((next: number) => {
    const s = Math.min(MAX, Math.max(MIN, next));
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  }, []);
  const go = useCallback((d: number) => {
    const next = index + d;
    if (next < 0 || next >= n) return;
    setIndex(next);
    setLoaded(false);
    reset();
  }, [index, n, reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "+" || e.key === "=") zoomTo(scale * 1.5);
      if (e.key === "-") zoomTo(scale / 1.5);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [close, scale, zoomTo, go]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomTo(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }

  function onPointerDown(e: React.PointerEvent) {
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    if (!e.isPrimary) return;
    pinched.current = false;
    if (scale > 1) {
      drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      setDragging(true);
    } else {
      start.current = { x: e.clientX, y: e.clientY };
      setDragging(true);
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!e.isPrimary) return;
    if (drag.current) {
      setPos({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
    } else if (start.current && n > 1 && !pinched.current) {
      // la foto sigue al dedo; en los extremos se resiste
      const dx = e.clientX - start.current.x;
      const edge = (dx > 0 && index === 0) || (dx < 0 && index === n - 1);
      setSwipeX(edge ? dx / 3 : dx);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!e.isPrimary) return;
    if (!drag.current && start.current && !pinched.current) {
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      // deslizar de lado cambia de foto; hacia abajo (sin zoom) cierra
      if (n > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx)) close();
    }
    drag.current = null;
    start.current = null;
    setSwipeX(0);
    setDragging(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale };
      pinched.current = true;
      setSwipeX(0);
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
      onClick={close}
      onWheel={onWheel}
      style={{ touchAction: "none" }}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top),12px)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 text-[12px] font-medium">
          {n > 1 && <span className="rounded-full bg-white/10 px-3 py-1.5 tabular-nums">{index + 1} / {n}</span>}
          <span className="rounded-full bg-white/10 px-3 py-1.5">{Math.round(scale * 100)}%</span>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Alejar" onClick={() => zoomTo(scale / 1.5)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Minus size={18} /></button>
          <button type="button" aria-label="Acercar" onClick={() => zoomTo(scale * 1.5)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Plus size={18} /></button>
          <a href={current} download target="_blank" rel="noreferrer" aria-label="Descargar" className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Download size={18} /></a>
          <button type="button" aria-label="Cerrar" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink"><X size={18} /></button>
        </div>
      </div>

      {n > 1 && index > 0 && (
        <button type="button" aria-label="Foto anterior" onClick={(e) => { e.stopPropagation(); go(-1); }} className={NAV + " left-3"}><ChevronLeft size={22} /></button>
      )}
      {n > 1 && index < n - 1 && (
        <button type="button" aria-label="Foto siguiente" onClick={(e) => { e.stopPropagation(); go(1); }} className={NAV + " right-3"}><ChevronRight size={22} /></button>
      )}
      {/* las vecinas se bajan antes para que el cambio sea inmediato */}
      {[images[index - 1], images[index + 1]].filter(Boolean).map((s) => (
        // eslint-disable-next-line @next/next/no-img-element -- solo precarga
        <img key={s} src={s} alt="" hidden />
      ))}

      {!loaded && <div className="absolute text-[13px] text-white/70">Cargando imagen…</div>}
      {/* eslint-disable-next-line @next/next/no-img-element -- tamaño real, sin optimizar */}
      <img
        key={current}
        src={current}
        alt={n > 1 ? `${alt} · ${index + 1} de ${n}` : alt}
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
          transform: `translate(${pos.x + swipeX}px, ${pos.y}px) scale(${scale})`,
          transition: dragging ? "none" : "transform 120ms ease-out",
          cursor: scale > 1 ? "grab" : "zoom-in",
          opacity: loaded ? 1 : 0,
        }}
      />
      <p className="pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),12px)] text-[12px] text-white/60">
        {n > 1 ? "Desliza de lado para ver más · hacia abajo para cerrar" : "Doble toque para acercar · desliza hacia abajo para cerrar"}
      </p>
    </div>
  );
}

const NAV = "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20";
